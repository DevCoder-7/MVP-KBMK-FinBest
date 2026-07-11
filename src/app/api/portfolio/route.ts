import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'
import {
  calcNAV,
  calcAllocationByType,
  calcSectorConcentration,
} from '@/lib/utils-finance'
import { getLiveMarketSnapshot, livePriceFor } from '@/lib/market-data'

/**
 * GET /api/portfolio
 * Returns detailed holdings with P&L, sector breakdown, allocation by type,
 * realized/unrealized gains, and transaction history.
 * Implements PRD FR-4.2: daftar posisi dengan P&L realized/unrealized, sektor, dan bobot
 */
export async function GET() {
  try {
    const user = await getDefaultUser()

    const [holdings, transactions, target] = await Promise.all([
      db.holding.findMany({
        where: { userId: user.id },
        include: { asset: true },
      }),
      db.transaction.findMany({
        where: { userId: user.id, status: 'EXECUTED' },
        include: { asset: true },
        orderBy: { executedAt: 'desc' },
      }),
      db.targetAllocation.findUnique({ where: { userId: user.id } }),
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
          price5dAgo: live.price5dAgo,
          marketQuote: live.quote,
        },
      }
    })

    const nav = calcNAV(liveHoldings)
    const allocation = calcAllocationByType(liveHoldings)
    const sectorConcentration = calcSectorConcentration(liveHoldings)

    // Build detailed positions with P&L
    const positions = liveHoldings
      .map((h) => {
        const marketValue = h.quantity * h.asset.price
        const costBasis = h.quantity * h.avgCost
        const unrealizedPnl = marketValue - costBasis
        const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0
        const weight = nav > 0 ? (marketValue / nav) * 100 : 0
        const dayChange =
          h.asset.prevPrice > 0
            ? ((h.asset.price - h.asset.prevPrice) / h.asset.prevPrice) * 100
            : 0
        const fiveDayChange =
          h.asset.price5dAgo > 0
            ? ((h.asset.price - h.asset.price5dAgo) / h.asset.price5dAgo) * 100
            : 0

        // Calculate realized P&L from SELL transactions for this asset
        const assetSells = transactions.filter(
          (t) => t.assetId === h.assetId && t.side === 'SELL'
        )
        const realizedPnl = assetSells.reduce((sum, t) => {
          return sum + (t.price - h.avgCost) * t.quantity
        }, 0)

        return {
          id: h.id,
          assetId: h.assetId,
          ticker: h.asset.ticker,
          name: h.asset.name,
          type: h.asset.type,
          sector: h.asset.sector || 'Lainnya',
          quantity: h.quantity,
          avgCost: h.avgCost,
          currentPrice: h.asset.price,
          marketValue,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPct,
          realizedPnl,
          weight,
          dayChange,
          fiveDayChange,
          volatility30d: h.asset.volatility30d,
          marketQuote: h.asset.marketQuote,
        }
      })
      .sort((a, b) => b.marketValue - a.marketValue)

    const totalRealizedPnl = positions.reduce((s, p) => s + p.realizedPnl, 0)
    const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0)
    const totalCost = positions.reduce((s, p) => s + p.costBasis, 0)

    // Sector breakdown with values
    const sectorBreakdown = Object.entries(sectorConcentration)
      .map(([sector, pct]) => {
        const sectorValue = liveHoldings
          .filter((h) => (h.asset.sector || 'Lainnya') === sector)
          .reduce((s, h) => s + h.quantity * h.asset.price, 0)
        return {
          sector,
          percentage: pct,
          value: sectorValue,
          positionCount: liveHoldings.filter(
            (h) => (h.asset.sector || 'Lainnya') === sector
          ).length,
          overLimit: pct > 25,
        }
      })
      .sort((a, b) => b.value - a.value)

    // Allocation by type with target comparison
    const allocationComparison = [
      { type: 'SAHAM', label: 'Saham', actual: allocation['SAHAM'] || 0, target: target?.saham ?? 0 },
      { type: 'OBLIGASI', label: 'Obligasi', actual: allocation['OBLIGASI'] || 0, target: target?.obligasi ?? 0 },
      { type: 'REKSADANA', label: 'Reksa Dana', actual: allocation['REKSADANA'] || 0, target: target?.reksadana ?? 0 },
      { type: 'EMAS', label: 'Emas', actual: allocation['EMAS'] || 0, target: target?.emas ?? 0 },
      { type: 'KAS', label: 'Kas', actual: allocation['KAS'] || 0, target: target?.kas ?? 0 },
    ]

    // Transaction history grouped by month
    const txByMonth: Record<string, { buys: number; sells: number; value: number }> = {}
    for (const tx of transactions) {
      const monthKey = new Date(tx.executedAt).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
      })
      if (!txByMonth[monthKey]) txByMonth[monthKey] = { buys: 0, sells: 0, value: 0 }
      if (tx.side === 'BUY') txByMonth[monthKey].buys += 1
      else txByMonth[monthKey].sells += 1
      txByMonth[monthKey].value += tx.quantity * tx.price
    }

    return NextResponse.json({
      user: { id: user.id, name: user.name, riskProfile: user.riskProfile },
      summary: {
        nav,
        totalCost,
        totalUnrealizedPnl,
        totalUnrealizedPnlPct: totalCost > 0 ? (totalUnrealizedPnl / totalCost) * 100 : 0,
        totalRealizedPnl,
        positionCount: positions.length,
        sectorCount: sectorBreakdown.length,
      },
      positions,
      sectorBreakdown,
      allocationComparison,
      targetAllocation: target
        ? { saham: target.saham, obligasi: target.obligasi, reksadana: target.reksadana, kas: target.kas, emas: target.emas }
        : null,
      transactions: transactions.slice(0, 20).map((t) => ({
        id: t.id,
        ticker: t.asset.ticker,
        name: t.asset.name,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        total: t.quantity * t.price,
        executedAt: t.executedAt,
      })),
      transactionSummary: {
        total: transactions.length,
        buys: transactions.filter((t) => t.side === 'BUY').length,
        sells: transactions.filter((t) => t.side === 'SELL').length,
        byMonth: Object.entries(txByMonth).map(([month, data]) => ({ month, ...data })),
      },
      marketData,
    })
  } catch (error) {
    console.error('GET /api/portfolio error:', error)
    return NextResponse.json({ error: 'Gagal memuat data portofolio' }, { status: 500 })
  }
}
