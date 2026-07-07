import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'
import {
  calcNAV,
  formatDate,
  formatIDR,
  formatPct,
} from '@/lib/utils-finance'
import { createSimplePdf } from '@/lib/simple-pdf'

/**
 * GET /api/dashboard/report?month=YYYY-MM&userId=...
 * Menghasilkan file PDF laporan bulanan.
 *
 * Output: file PDF yang dapat diunduh (Content-Disposition: attachment).
 * Berisi: ringkasan NAV, peristiwa penting, transaksi, traction score avg,
 * top/bottom performers, behavior notes, dan rekomendasi.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month') // YYYY-MM
    const userIdParam = searchParams.get('userId')

    let user
    if (userIdParam) {
      user = await db.userProfile.findUnique({ where: { id: userIdParam } })
    }
    if (!user) {
      user = await getDefaultUser()
    }

    // Parse month (default: bulan ini)
    const now = new Date()
    let monthYear: string
    let monthStart: Date
    let monthEnd: Date
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number)
      monthStart = new Date(y, m - 1, 1)
      monthEnd = new Date(y, m, 0, 23, 59, 59)
      monthYear = new Intl.DateTimeFormat('id-ID', {
        month: 'long',
        year: 'numeric',
      }).format(monthStart)
    } else {
      monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      monthYear = new Intl.DateTimeFormat('id-ID', {
        month: 'long',
        year: 'numeric',
      }).format(monthStart)
    }

    // Fetch data
    const [holdings, transactions, tractionChecks, behaviorMetrics, insights] =
      await Promise.all([
        db.holding.findMany({
          where: { userId: user.id },
          include: { asset: true },
        }),
        db.transaction.findMany({
          where: {
            userId: user.id,
            status: 'EXECUTED',
            executedAt: { gte: monthStart, lte: monthEnd },
          },
          include: { asset: true },
          orderBy: { executedAt: 'desc' },
        }),
        db.tractionCheck.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: monthStart, lte: monthEnd },
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.behaviorMetric.findMany({
          where: {
            userId: user.id,
            date: { gte: monthStart, lte: monthEnd },
          },
          orderBy: { date: 'asc' },
        }),
        db.insight.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: monthStart, lte: monthEnd },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ])

    // Calculate NAV summary
    const currentNav = calcNAV(holdings)
    const cost = holdings.reduce((s, h) => s + h.quantity * h.avgCost, 0)
    const totalPnl = currentNav - cost
    const totalPnlPct = cost > 0 ? (totalPnl / cost) * 100 : 0

    // Compute per-position P&L %
    const positionPerf = holdings
      .map((h) => {
        const mv = h.quantity * h.asset.price
        const c = h.quantity * h.avgCost
        const pnl = mv - c
        const pnlPct = c > 0 ? (pnl / c) * 100 : 0
        return {
          ticker: h.asset.ticker,
          name: h.asset.name,
          type: h.asset.type,
          marketValue: mv,
          pnl,
          pnlPct,
        }
      })
      .sort((a, b) => b.pnlPct - a.pnlPct)

    const topPerformers = positionPerf.slice(0, 3)
    const bottomPerformers = positionPerf.slice(-3).reverse()

    // Traction score avg
    const tractionScoreAvg =
      behaviorMetrics.length > 0
        ? Math.round(
            behaviorMetrics.reduce((s, b) => s + b.tractionScore, 0) /
              behaviorMetrics.length
          )
        : 0
    const txCountMonth = behaviorMetrics.reduce(
      (s, b) => s + b.transactionCount,
      0
    )
    const impulsiveCountMonth = behaviorMetrics.reduce(
      (s, b) => s + b.impulsiveCount,
      0
    )

    // Peristiwa penting (insight kritis & warning)
    const criticalEvents = insights
      .filter((i) => i.severity === 'critical' || i.severity === 'warning')
      .map((i) => ({
        date: i.createdAt,
        type: i.type,
        severity: i.severity,
        title: i.title,
        description: i.description,
      }))

    // Behavior notes
    const behaviorNotes: string[] = []
    if (tractionScoreAvg >= 80) {
      behaviorNotes.push(
        `Traction Score rata-rata ${tractionScoreAvg}/100 (GREEN) — disiplin investasi sangat baik.`
      )
    } else if (tractionScoreAvg >= 60) {
      behaviorNotes.push(
        `Traction Score rata-rata ${tractionScoreAvg}/100 (YELLOW) — perlu perhatian pada pola transaksi.`
      )
    } else {
      behaviorNotes.push(
        `Traction Score rata-rata ${tractionScoreAvg}/100 (RED/ORANGE) — sebaiknya kurangi transaksi impulsif.`
      )
    }
    const impulsiveRatio =
      txCountMonth > 0 ? (impulsiveCountMonth / txCountMonth) * 100 : 0
    behaviorNotes.push(
      `Rasio transaksi impulsif: ${impulsiveRatio.toFixed(1)}% (${impulsiveCountMonth}/${txCountMonth} transaksi).`
    )
    if (tractionChecks.filter((t) => t.overridden).length > 0) {
      behaviorNotes.push(
        `Terdapat ${tractionChecks.filter((t) => t.overridden).length} override atas peringatan Traction — evaluasi motif override.`
      )
    }

    // Rekomendasi
    const recommendations: string[] = []
    if (totalPnlPct < 0) {
      recommendations.push(
        'Portofolio dalam posisi rugi — tinjau thesis investasi dan hindari cut-loss emosional.'
      )
    }
    if (impulsiveRatio > 20) {
      recommendations.push(
        'Rasio transaksi impulsif tinggi — pertimbangkan jeda cooling-off lebih sering sebelum eksekusi.'
      )
    }
    if (tractionScoreAvg < 60) {
      recommendations.push(
        'Aktifkan notifikasi Traction Score untuk pengingat disiplin transaksi.'
      )
    }
    if (recommendations.length === 0) {
      recommendations.push(
        'Pertahankan disiplin investasi dan lakukan rebalancing berkala sesuai alokasi target.'
      )
    }

    const report = {
      meta: {
        generatedAt: new Date().toISOString(),
        period: monthYear,
        monthParam: monthParam ?? now.toISOString().slice(0, 7),
        user: {
          name: user.name,
          email: user.email,
          riskProfile: user.riskProfile,
          horizonYears: user.horizonYears,
        },
      },
      navSummary: {
        currentValue: currentNav,
        costBasis: cost,
        totalPnl,
        totalPnlPct,
        formatted: {
          currentValue: formatIDR(currentNav),
          costBasis: formatIDR(cost),
          totalPnl: formatIDR(totalPnl),
          totalPnlPct: formatPct(totalPnlPct),
        },
      },
      transactionCount: transactions.length,
      tractionScoreAvg,
      behavior: {
        txCount: txCountMonth,
        impulsiveCount: impulsiveCountMonth,
        impulsiveRatio: Number(impulsiveRatio.toFixed(2)),
        notes: behaviorNotes,
      },
      topPerformers: topPerformers.map((p) => ({
        ticker: p.ticker,
        name: p.name,
        type: p.type,
        pnlPct: Number(p.pnlPct.toFixed(2)),
      })),
      bottomPerformers: bottomPerformers.map((p) => ({
        ticker: p.ticker,
        name: p.name,
        type: p.type,
        pnlPct: Number(p.pnlPct.toFixed(2)),
      })),
      criticalEvents,
      transactions: transactions.map((t) => ({
        date: t.executedAt,
        formattedDate: formatDate(t.executedAt),
        ticker: t.asset.ticker,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        total: t.quantity * t.price,
      })),
      recommendations,
      disclaimer:
        'Laporan ini bersifat edukatif dan informasional, bukan nasihat keuangan berizin. Keputusan & eksekusi investasi sepenuhnya menjadi tanggung jawab Anda. FinBest AI bersifat non-diskrisioner.',
    }

    const pdf = createSimplePdf({
      title: `Laporan Bulanan FinBest - ${report.meta.period}`,
      subtitle: `Dibuat ${formatDate(report.meta.generatedAt)} untuk ${report.meta.user.name}`,
      sections: [
        {
          title: 'Ringkasan NAV',
          lines: [
            `Nilai kini: ${report.navSummary.formatted.currentValue}`,
            `Cost basis: ${report.navSummary.formatted.costBasis}`,
            `P/L total: ${report.navSummary.formatted.totalPnl} (${report.navSummary.formatted.totalPnlPct})`,
            `Profil risiko: ${report.meta.user.riskProfile}, horizon ${report.meta.user.horizonYears} tahun`,
          ],
        },
        {
          title: 'Perilaku Transaksi',
          lines: [
            `Traction Score rata-rata: ${report.tractionScoreAvg}/100`,
            `Transaksi bulan ini: ${report.transactionCount}`,
            `Rasio impulsif: ${report.behavior.impulsiveRatio}% (${report.behavior.impulsiveCount}/${report.behavior.txCount})`,
            ...report.behavior.notes,
          ],
        },
        {
          title: 'Top Performer',
          lines: report.topPerformers.map(
            (p) => `${p.ticker} - ${p.name}: ${p.pnlPct}%`
          ),
        },
        {
          title: 'Bottom Performer',
          lines: report.bottomPerformers.map(
            (p) => `${p.ticker} - ${p.name}: ${p.pnlPct}%`
          ),
        },
        {
          title: 'Peristiwa Penting',
          lines: report.criticalEvents.length
            ? report.criticalEvents.map(
                (event) => `${formatDate(event.date)} - ${event.title}: ${event.description}`
              )
            : ['Tidak ada peristiwa kritis pada periode ini.'],
        },
        {
          title: 'Transaksi',
          lines: report.transactions.length
            ? report.transactions.map(
                (t) =>
                  `${t.formattedDate} - ${t.side} ${t.ticker} ${t.quantity} lembar @ ${formatIDR(t.price)}`
              )
            : ['Tidak ada transaksi pada periode ini.'],
        },
        {
          title: 'Rekomendasi Perilaku',
          lines: report.recommendations,
        },
      ],
      footer: report.disclaimer,
    })

    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="finbest-laporan-${monthParam ?? now.toISOString().slice(0, 7)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/dashboard/report error:', error)
    return NextResponse.json(
      { error: 'Gagal membuat laporan bulanan' },
      { status: 500 }
    )
  }
}
