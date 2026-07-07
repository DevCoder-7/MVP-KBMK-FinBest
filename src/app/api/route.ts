import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'
import {
  calcNAV,
  calcAllocationByType,
  calcSectorConcentration,
} from '@/lib/utils-finance'
import { getLiveMarketSnapshot, livePriceFor } from '@/lib/market-data'

/** GET /api - bootstrap data: user, summary, allocation, recent activity */
export async function GET() {
  try {
    const user = await getDefaultUser()

    const [holdings, target, goals, insights, recentTx, behavior] = await Promise.all([
      db.holding.findMany({
        where: { userId: user.id },
        include: { asset: true },
      }),
      db.targetAllocation.findUnique({ where: { userId: user.id } }),
      db.goal.findMany({ where: { userId: user.id } }),
      db.insight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.transaction.findMany({
        where: { userId: user.id, status: 'EXECUTED' },
        include: { asset: true },
        orderBy: { executedAt: 'desc' },
        take: 8,
      }),
      db.behaviorMetric.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ])

    const marketData = await getLiveMarketSnapshot(holdings.map((h) => h.asset))
    const liveHoldings = holdings.map((h) => {
      const live = livePriceFor(h.asset, marketData)
      return {
        ...h,
        asset: {
          ...h.asset,
          price: live.price,
          prevPrice: live.prevPrice,
        },
      }
    })

    const nav = calcNAV(liveHoldings)
    const cost = liveHoldings.reduce((s, h) => s + h.quantity * h.avgCost, 0)
    const totalPnl = nav - cost
    const totalPnlPct = cost > 0 ? (totalPnl / cost) * 100 : 0
    const allocation = calcAllocationByType(liveHoldings)
    const sectorConcentration = calcSectorConcentration(liveHoldings)

    // Calculate 30-day average Traction Score
    const avgTractionScore =
      behavior.length > 0
        ? Math.round(
            behavior.reduce((s, b) => s + b.tractionScore, 0) / behavior.length
          )
        : 0

    // YTD return (simulated: based on PnL pct + market benchmark)
    const ytdReturn = totalPnlPct
    const benchmarkReturn = 8.4 // IHSG YTD simulated
    const performanceGap = ytdReturn - benchmarkReturn

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        riskScore: user.riskScore,
        riskProfile: user.riskProfile,
        horizonYears: user.horizonYears,
        annualIncome: user.annualIncome,
      },
      summary: {
        nav,
        cost,
        totalPnl,
        totalPnlPct,
        ytdReturn,
        benchmarkReturn,
        performanceGap,
        avgTractionScore,
        holdingCount: holdings.length,
        transactionCount30d: behavior.reduce((s, b) => s + b.transactionCount, 0),
        impulsiveCount30d: behavior.reduce((s, b) => s + b.impulsiveCount, 0),
      },
      allocation: {
        actual: allocation,
        target: target
          ? {
              SAHAM: target.saham,
              OBLIGASI: target.obligasi,
              REKSADANA: target.reksadana,
              KAS: target.kas,
              EMAS: target.emas,
            }
          : null,
      },
      sectorConcentration,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        progress: g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0,
        horizonYears: g.horizonYears,
        monthlyContribution: g.monthlyContribution,
        priority: g.priority,
      })),
      insights,
      recentTransactions: recentTx.map((tx) => ({
        id: tx.id,
        ticker: tx.asset.ticker,
        name: tx.asset.name,
        side: tx.side,
        quantity: tx.quantity,
        price: tx.price,
        total: tx.quantity * tx.price,
        executedAt: tx.executedAt,
      })),
      behaviorTrend: behavior
        .slice()
        .reverse()
        .map((b) => ({
          date: b.date,
          tractionScore: b.tractionScore,
          transactionCount: b.transactionCount,
          impulsiveCount: b.impulsiveCount,
        })),
      marketData,
    })
  } catch (error) {
    console.error('GET /api error:', error)
    return NextResponse.json(
      { error: 'Gagal memuat data ringkasan' },
      { status: 500 }
    )
  }
}
