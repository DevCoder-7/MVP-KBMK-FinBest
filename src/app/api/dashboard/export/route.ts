import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'
import { createSimplePdf } from '@/lib/simple-pdf'

/**
 * GET /api/dashboard/export?format=pdf|csv
 * Ekspor seluruh data pengguna (UU PDP — hak portabilitas data).
 * - PDF: ringkasan portabilitas data yang mudah dibaca
 * - CSV: flattened transactions + holdings (lebih ringkas, untuk Excel)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const format = (searchParams.get('format') ?? 'pdf').toLowerCase()
    const userIdParam = searchParams.get('userId')

    // Resolve user (default demo user jika userId tidak diberikan)
    let user
    if (userIdParam) {
      user = await db.userProfile.findUnique({ where: { id: userIdParam } })
    }
    if (!user) {
      user = await getDefaultUser()
    }

    const [
      goals,
      targetAllocation,
      holdings,
      transactions,
      tractionChecks,
      chatSessions,
      behaviorMetrics,
      insights,
      assets,
    ] = await Promise.all([
      db.goal.findMany({ where: { userId: user.id } }),
      db.targetAllocation.findUnique({ where: { userId: user.id } }),
      db.holding.findMany({
        where: { userId: user.id },
        include: { asset: true },
      }),
      db.transaction.findMany({
        where: { userId: user.id },
        include: { asset: true },
        orderBy: { executedAt: 'desc' },
      }),
      db.tractionCheck.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      db.chatSession.findMany({
        where: { userId: user.id },
        include: { messages: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.behaviorMetric.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
      }),
      db.insight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      db.asset.findMany(),
    ])

    const exportTimestamp = new Date().toISOString()

    // Build asset lookup (TractionCheck only has assetId, no relation)
    const assetMap = new Map(assets.map((a) => [a.id, a]))

    if (format === 'csv') {
      const rows: string[] = []
      rows.push('# FinBest AI - Data Export (CSV)')
      rows.push(`# User,${csvEscape(user.name)}`)
      rows.push(`# Email,${csvEscape(user.email)}`)
      rows.push(`# Exported At,${exportTimestamp}`)
      rows.push('# Format,CSV (UU PDP No. 27/2022)')
      rows.push('')

      // Holdings
      rows.push('## HOLDINGS')
      rows.push(
        'TICKER,NAME,TYPE,SECTOR,QUANTITY,AVG_COST,CURRENT_PRICE,MARKET_VALUE,COST_BASIS,PNL,PNL_PCT'
      )
      for (const h of holdings) {
        const mv = h.quantity * h.asset.price
        const cost = h.quantity * h.avgCost
        const pnl = mv - cost
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
        rows.push(
          [
            h.asset.ticker,
            csvEscape(h.asset.name),
            h.asset.type,
            h.asset.sector ?? '',
            h.quantity,
            h.avgCost,
            h.asset.price,
            mv,
            cost,
            pnl,
            pnlPct.toFixed(2),
          ].join(',')
        )
      }
      rows.push('')

      // Transactions
      rows.push('## TRANSACTIONS')
      rows.push(
        'EXECUTED_AT,TICKER,NAME,SIDE,QUANTITY,PRICE,TOTAL_VALUE,STATUS'
      )
      for (const t of transactions) {
        rows.push(
          [
            t.executedAt.toISOString(),
            t.asset.ticker,
            csvEscape(t.asset.name),
            t.side,
            t.quantity,
            t.price,
            t.quantity * t.price,
            t.status,
          ].join(',')
        )
      }
      rows.push('')

      // Behavior metrics
      rows.push('## BEHAVIOR_METRICS')
      rows.push('DATE,TRACTION_SCORE,TRANSACTION_COUNT,IMPULSIVE_COUNT')
      for (const b of behaviorMetrics) {
        rows.push(
          [
            b.date.toISOString().slice(0, 10),
            b.tractionScore,
            b.transactionCount,
            b.impulsiveCount,
          ].join(',')
        )
      }
      rows.push('')

      // Insights
      rows.push('## INSIGHTS')
      rows.push('CREATED_AT,TYPE,SEVERITY,TITLE,DESCRIPTION,IS_READ')
      for (const i of insights) {
        rows.push(
          [
            i.createdAt.toISOString(),
            i.type,
            i.severity,
            csvEscape(i.title),
            csvEscape(i.description),
            i.isRead ? 'TRUE' : 'FALSE',
          ].join(',')
        )
      }
      rows.push('')

      // Traction checks (audit trail)
      rows.push('## TRACTION_CHECKS')
      rows.push(
        'CREATED_AT,ASSET_TICKER,SIDE,QUANTITY,PRICE,TRACTION_SCORE,RISK_LEVEL,CONFIRMED,OVERRIDDEN'
      )
      for (const tc of tractionChecks) {
        const tcAsset = assetMap.get(tc.assetId)
        rows.push(
          [
            tc.createdAt.toISOString(),
            tcAsset?.ticker ?? '',
            tc.side,
            tc.quantity,
            tc.price,
            tc.tractionScore,
            tc.riskLevel,
            tc.confirmed ? 'TRUE' : 'FALSE',
            tc.overridden ? 'TRUE' : 'FALSE',
          ].join(',')
        )
      }

      const csv = rows.join('\n')
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="finbest-export-${exportTimestamp.slice(0, 10)}.csv"`,
        },
      })
    }

    // Default: PDF summary
    const payload = {
      meta: {
        exportedAt: exportTimestamp,
        format: 'pdf',
        regulation: 'UU PDP No. 27 Tahun 2022 - Hak Portabilitas Data',
        recordCount: {
          goals: goals.length,
          holdings: holdings.length,
          transactions: transactions.length,
          tractionChecks: tractionChecks.length,
          chatSessions: chatSessions.length,
          behaviorMetrics: behaviorMetrics.length,
          insights: insights.length,
        },
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        riskScore: user.riskScore,
        riskProfile: user.riskProfile,
        horizonYears: user.horizonYears,
        annualIncome: user.annualIncome,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        horizonYears: g.horizonYears,
        monthlyContribution: g.monthlyContribution,
        priority: g.priority,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      targetAllocation: targetAllocation
        ? {
            saham: targetAllocation.saham,
            obligasi: targetAllocation.obligasi,
            reksadana: targetAllocation.reksadana,
            kas: targetAllocation.kas,
            emas: targetAllocation.emas,
            updatedAt: targetAllocation.updatedAt,
          }
        : null,
      holdings: holdings.map((h) => ({
        id: h.id,
        asset: {
          ticker: h.asset.ticker,
          name: h.asset.name,
          type: h.asset.type,
          sector: h.asset.sector,
          price: h.asset.price,
          prevPrice: h.asset.prevPrice,
          volatility30d: h.asset.volatility30d,
        },
        quantity: h.quantity,
        avgCost: h.avgCost,
        marketValue: h.quantity * h.asset.price,
        costBasis: h.quantity * h.avgCost,
        pnl: h.quantity * h.asset.price - h.quantity * h.avgCost,
        pnlPct:
          h.avgCost > 0
            ? ((h.asset.price - h.avgCost) / h.avgCost) * 100
            : 0,
        createdAt: h.createdAt,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        asset: {
          ticker: t.asset.ticker,
          name: t.asset.name,
          type: t.asset.type,
        },
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        total: t.quantity * t.price,
        status: t.status,
        executedAt: t.executedAt,
        createdAt: t.createdAt,
      })),
      tractionChecks: tractionChecks.map((tc) => {
        const tcAsset = assetMap.get(tc.assetId)
        return {
          id: tc.id,
          asset: tcAsset
            ? { ticker: tcAsset.ticker, name: tcAsset.name }
            : null,
          side: tc.side,
          quantity: tc.quantity,
          price: tc.price,
          tractionScore: tc.tractionScore,
          riskLevel: tc.riskLevel,
          coolingOffMs: tc.coolingOffMs,
          rulesTriggered: JSON.parse(tc.rulesTriggered || '[]'),
          reflections: JSON.parse(tc.reflections || '[]'),
          confirmed: tc.confirmed,
          overridden: tc.overridden,
          createdAt: tc.createdAt,
          confirmedAt: tc.confirmedAt,
        }
      }),
      chatSessions: chatSessions.map((cs) => ({
        id: cs.id,
        title: cs.title,
        createdAt: cs.createdAt,
        updatedAt: cs.updatedAt,
        messages: cs.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: JSON.parse(m.citations || '[]'),
          confidence: m.confidence,
          intent: m.intent,
          feedback: m.feedback,
          createdAt: m.createdAt,
        })),
      })),
      behaviorMetrics: behaviorMetrics.map((b) => ({
        id: b.id,
        date: b.date,
        tractionScore: b.tractionScore,
        transactionCount: b.transactionCount,
        impulsiveCount: b.impulsiveCount,
      })),
      insights: insights.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        description: i.description,
        severity: i.severity,
        isRead: i.isRead,
        createdAt: i.createdAt,
      })),
    }

    const pdf = createSimplePdf({
      title: 'Ekspor Data FinBest',
      subtitle: `Dibuat ${exportTimestamp.slice(0, 10)} untuk ${user.name}`,
      sections: [
        {
          title: 'Profil',
          lines: [
            `Nama: ${payload.user.name}`,
            `Email: ${payload.user.email}`,
            `Profil risiko: ${payload.user.riskProfile}`,
            `Horizon: ${payload.user.horizonYears} tahun`,
          ],
        },
        {
          title: 'Ringkasan Rekaman',
          lines: [
            `Goals: ${payload.meta.recordCount.goals}`,
            `Holdings: ${payload.meta.recordCount.holdings}`,
            `Transactions: ${payload.meta.recordCount.transactions}`,
            `Traction checks: ${payload.meta.recordCount.tractionChecks}`,
            `Chat sessions: ${payload.meta.recordCount.chatSessions}`,
            `Behavior metrics: ${payload.meta.recordCount.behaviorMetrics}`,
            `Insights: ${payload.meta.recordCount.insights}`,
          ],
        },
        {
          title: 'Holdings',
          lines: payload.holdings.length
            ? payload.holdings.map(
                (h) =>
                  `${h.asset.ticker} - ${h.asset.name}: ${h.quantity} unit, market value Rp ${Math.round(h.marketValue).toLocaleString('id-ID')}`
              )
            : ['Belum ada holding.'],
        },
        {
          title: 'Transaksi Terbaru',
          lines: payload.transactions.length
            ? payload.transactions.slice(0, 20).map(
                (t) =>
                  `${new Date(t.executedAt).toISOString().slice(0, 10)} - ${t.side} ${t.asset.ticker} ${t.quantity} @ Rp ${Math.round(t.price).toLocaleString('id-ID')}`
              )
            : ['Belum ada transaksi.'],
        },
        {
          title: 'Insights',
          lines: payload.insights.length
            ? payload.insights.slice(0, 20).map(
                (i) => `${i.severity.toUpperCase()} - ${i.title}: ${i.description}`
              )
            : ['Belum ada insight.'],
        },
      ],
      footer:
        'Ekspor ini dibuat untuk hak portabilitas data UU PDP No. 27/2022. Data tetap berada di perangkat dan layanan demo FinBest.',
    })

    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="finbest-export-${exportTimestamp.slice(0, 10)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/dashboard/export error:', error)
    return NextResponse.json(
      { error: 'Gagal mengekspor data' },
      { status: 500 }
    )
  }
}

/** Escape a value for CSV (RFC 4180) */
function csvEscape(value: string | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
