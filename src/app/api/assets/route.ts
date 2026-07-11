/**
 * FinBest AI - Shared asset catalog endpoint
 * GET /api/assets
 * Returns all assets with current price + risk metrics (5d surge, 30d vol).
 * Used by Traction module (Modul 2) for the asset selector; intentionally
 * read-only and shared so other modules can reuse it.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiError } from '@/lib/api-helpers'
import { getLiveMarketSnapshot, livePriceFor } from '@/lib/market-data'

export async function GET() {
  try {
    const assets = await db.asset.findMany({
      orderBy: [{ type: 'asc' }, { ticker: 'asc' }],
    })
    const marketData = await getLiveMarketSnapshot(assets)
    return NextResponse.json({
      assets: assets.map((a) => {
        const live = livePriceFor(a, marketData)
        return {
          id: a.id,
          ticker: a.ticker,
          name: a.name,
          type: a.type,
          sector: a.sector,
          price: live.price,
          prevPrice: live.prevPrice,
          price5dAgo: live.price5dAgo,
          volatility30d: a.volatility30d,
          dayChangePct:
            live.prevPrice > 0
              ? ((live.price - live.prevPrice) / live.prevPrice) * 100
              : 0,
          surge5dPct:
            live.price5dAgo > 0
              ? ((live.price - live.price5dAgo) / live.price5dAgo) * 100
              : 0,
          marketQuote: live.quote,
        }
      }),
      marketData,
    })
  } catch (error) {
    console.error('GET /api/assets error:', error)
    return apiError('Gagal memuat daftar aset.', 500)
  }
}
