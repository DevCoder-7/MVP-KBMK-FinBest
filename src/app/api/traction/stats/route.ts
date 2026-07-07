/**
 * FinBest AI - Modul 2: Traction
 * GET /api/traction/stats
 * Lightweight weekly/30-day KPIs for the dashboard cards.
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

    const cutoff30d = new Date(Date.now() - 30 * 86400000)
    const checks = await db.tractionCheck.findMany({
      where: { userId: user.id, createdAt: { gte: cutoff30d } },
      orderBy: { createdAt: 'desc' },
    })

    const total = checks.length
    const avgScore30d =
      total > 0
        ? Math.round(
            checks.reduce((s, c) => s + c.tractionScore, 0) / total
          )
        : 0

    const impulsiveCount = checks.filter((c) => {
      const rules = safeJSONParse<RulesTriggeredItem[]>(c.rulesTriggered, [])
      return rules.some(
        (r) => r.rule === 'Lonjakan Harga 5 Hari (Impulsif)'
      )
    }).length
    const impulsiveRatio =
      total > 0
        ? Number(((impulsiveCount / total) * 100).toFixed(1))
        : 0

    const completionRate =
      total > 0
        ? Number(
            ((checks.filter((c) => c.confirmed).length / total) * 100).toFixed(
              1
            )
          )
        : 0

    const overrideRate =
      total > 0
        ? Number(
            (
              (checks.filter((c) => c.overridden).length / total) *
              100
            ).toFixed(1)
          )
        : 0

    // Distribution by risk level
    const distribution: Record<string, number> = {
      GREEN: 0,
      YELLOW: 0,
      ORANGE: 0,
      RED: 0,
    }
    for (const c of checks) {
      distribution[c.riskLevel] = (distribution[c.riskLevel] || 0) + 1
    }

    // Trend last 7 days (avg score per day)
    const trend: Array<{ date: string; avgScore: number; count: number }> = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 86400000)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const dayChecks = checks.filter(
        (c) => c.createdAt >= dayStart && c.createdAt < dayEnd
      )
      trend.push({
        date: dayStart.toISOString().slice(0, 10),
        avgScore:
          dayChecks.length > 0
            ? Math.round(
                dayChecks.reduce((s, c) => s + c.tractionScore, 0) /
                  dayChecks.length
              )
            : 0,
        count: dayChecks.length,
      })
    }

    return NextResponse.json({
      avgScore30d,
      impulsiveRatio,
      completionRate,
      overrideRate,
      totalChecks30d: total,
      distribution,
      trend,
      recentChecks: checks.slice(0, 5).map((c) => ({
        id: c.id,
        assetId: c.assetId,
        side: c.side,
        quantity: c.quantity,
        tractionScore: c.tractionScore,
        riskLevel: c.riskLevel,
        confirmed: c.confirmed,
        overridden: c.overridden,
        createdAt: c.createdAt,
        confirmedAt: c.confirmedAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/traction/stats error:', error)
    return apiError('Gagal memuat statistik Traction.', 500)
  }
}
