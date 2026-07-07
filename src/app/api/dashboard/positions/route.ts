import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'
import { getLiveMarketSnapshot, livePriceFor } from '@/lib/market-data'

/**
 * GET /api/dashboard/positions?userId=...&limit=5
 * Mengembalikan daftar posisi portofolio pengguna, diurutkan berdasarkan
 * nilai pasar (untuk preview Top 5 Posisi di Dashboard).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userIdParam = searchParams.get('userId')
    const limit = Math.min(
      Number(searchParams.get('limit') ?? '5'),
      20
    )

    let user
    if (userIdParam) {
      user = await db.userProfile.findUnique({ where: { id: userIdParam } })
    }
    if (!user) {
      user = await getDefaultUser()
    }

    const holdings = await db.holding.findMany({
      where: { userId: user.id },
      include: { asset: true },
    })
    const marketData = await getLiveMarketSnapshot(holdings.map((h) => h.asset))

    const positions = holdings
      .map((h) => {
        const live = livePriceFor(h.asset, marketData)
        const marketValue = h.quantity * live.price
        const cost = h.quantity * h.avgCost
        const pnl = marketValue - cost
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
        return {
          id: h.id,
          ticker: h.asset.ticker,
          name: h.asset.name,
          type: h.asset.type,
          sector: h.asset.sector,
          quantity: h.quantity,
          avgCost: h.avgCost,
          price: live.price,
          marketValue,
          pnl,
          pnlPct,
          marketQuote: live.quote,
        }
      })
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, limit)

    return NextResponse.json({
      positions,
      totalCount: holdings.length,
      marketData,
    })
  } catch (error) {
    console.error('GET /api/dashboard/positions error:', error)
    return NextResponse.json(
      { error: 'Gagal memuat posisi portofolio' },
      { status: 500 }
    )
  }
}
