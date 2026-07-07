/**
 * FinBest AI - Modul 2: Traction
 * GET /api/traction/history
 * Returns all TractionChecks for the demo user (audit trail) plus summary stats.
 *
 * NOTE: TractionCheck has no `asset` relation in the Prisma schema (only
 * `transaction` and `user`), so we fetch assets separately and join in JS.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError } from '@/lib/api-helpers'
import { safeJSONParse } from '@/lib/utils-finance'

interface RulesTriggeredItem {
  rule: string
  detail: string
  penalty: number
}

export async function GET() {
  try {
    const user = await getDefaultUser()

    const [checks, transactions] = await Promise.all([
      db.tractionCheck.findMany({
        where: { userId: user.id },
        include: { transaction: { include: { asset: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.transaction.findMany({
        where: { userId: user.id },
        include: { asset: true },
      }),
    ])

    // Map transactionId → asset (for checks whose transaction is null/missing)
    const txAssetMap = new Map<
      string,
      { id: string; ticker: string; name: string; type: string; sector: string | null }
    >()
    for (const tx of transactions) {
      txAssetMap.set(tx.id, {
        id: tx.asset.id,
        ticker: tx.asset.ticker,
        name: tx.asset.name,
        type: tx.asset.type,
        sector: tx.asset.sector,
      })
    }

    // Resolve every check's asset via its transaction (preferred) or by
    // fetching the asset row directly by assetId.
    const assetIds = Array.from(new Set(checks.map((c) => c.assetId)))
    const assetRows = await db.asset.findMany({
      where: { id: { in: assetIds } },
    })
    const assetMap = new Map<
      string,
      { id: string; ticker: string; name: string; type: string; sector: string | null }
    >()
    for (const a of assetRows) {
      assetMap.set(a.id, {
        id: a.id,
        ticker: a.ticker,
        name: a.name,
        type: a.type,
        sector: a.sector,
      })
    }

    const cutoff30d = new Date(Date.now() - 30 * 86400000)
    const recent = checks.filter((c) => c.createdAt >= cutoff30d)

    const avgScore30d =
      recent.length > 0
        ? Math.round(
            recent.reduce((s, c) => s + c.tractionScore, 0) / recent.length
          )
        : 0

    // Impulsive ratio: share of checks with the impulsive surge rule triggered
    const impulsiveCount = recent.filter((c) => {
      const rules = safeJSONParse<RulesTriggeredItem[]>(c.rulesTriggered, [])
      return rules.some(
        (r) => r.rule === 'Lonjakan Harga 5 Hari (Impulsif)'
      )
    }).length
    const impulsiveRatio =
      recent.length > 0
        ? Number(((impulsiveCount / recent.length) * 100).toFixed(1))
        : 0

    const completionRate =
      recent.length > 0
        ? Number(
            (
              (recent.filter((c) => c.confirmed).length / recent.length) *
              100
            ).toFixed(1)
          )
        : 0

    const overrideRate =
      recent.length > 0
        ? Number(
            (
              (recent.filter((c) => c.overridden).length / recent.length) *
              100
            ).toFixed(1)
          )
        : 0

    return NextResponse.json({
      checks: checks.map((c) => {
        const rules = safeJSONParse<RulesTriggeredItem[]>(
          c.rulesTriggered,
          []
        )
        const reflections = safeJSONParse<
          Array<{ question: string; answer: string }>
        >(c.reflections, [])
        const asset =
          c.transaction?.asset
            ? {
                id: c.transaction.asset.id,
                ticker: c.transaction.asset.ticker,
                name: c.transaction.asset.name,
                type: c.transaction.asset.type,
                sector: c.transaction.asset.sector,
              }
            : assetMap.get(c.assetId) ?? txAssetMap.get(c.transactionId ?? '') ?? {
                id: c.assetId,
                ticker: '—',
                name: 'Aset tidak ditemukan',
                type: '—',
                sector: null,
              }
        return {
          id: c.id,
          asset,
          side: c.side,
          quantity: c.quantity,
          price: c.price,
          transactionValue: c.quantity * c.price,
          tractionScore: c.tractionScore,
          riskLevel: c.riskLevel,
          coolingOffMs: c.coolingOffMs,
          rulesTriggered: rules,
          reflections,
          confirmed: c.confirmed,
          overridden: c.overridden,
          createdAt: c.createdAt,
          confirmedAt: c.confirmedAt,
          transactionId: c.transactionId,
          transactionStatus: c.transaction?.status ?? null,
        }
      }),
      stats: {
        avgScore30d,
        impulsiveRatio,
        completionRate,
        overrideRate,
        totalChecks30d: recent.length,
        totalChecks: checks.length,
      },
    })
  } catch (error) {
    console.error('GET /api/traction/history error:', error)
    return apiError('Gagal memuat audit trail.', 500)
  }
}
