import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/api-helpers'
import { analyzeStock } from '@/lib/ai-service'

/**
 * POST /api/ai-finbest/analyze-stock
 * Direct stock analysis (used for quick analysis without chat)
 * Body: { ticker }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<{ ticker: string }>(req)
    if (!body?.ticker) {
      return NextResponse.json({ error: 'Ticker diperlukan' }, { status: 400 })
    }
    const analysis = await analyzeStock(body.ticker)
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('POST /api/ai-finbest/analyze-stock error:', error)
    return NextResponse.json({ error: 'Gagal menganalisis saham' }, { status: 500 })
  }
}
