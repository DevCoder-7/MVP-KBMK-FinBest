import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'
import { getTierLimits } from '@/lib/ai-provider'

/**
 * GET /api/subscription
 * Returns current user's subscription tier + limits + pricing info
 */
export async function GET() {
  try {
    const user = await getDefaultUser()
    const tier = (user.tier as 'FREE' | 'PRO') || 'FREE'
    const limits = getTierLimits(tier)

    return NextResponse.json({
      tier,
      tierExpiresAt: user.tierExpiresAt,
      limits,
      pricing: {
        FREE: {
          price: 0,
          period: 'selamanya',
          label: 'Gratis',
          features: getTierLimits('FREE').features,
        },
        PRO: {
          price: 99000,
          period: 'bulan',
          label: 'Pro',
          features: getTierLimits('PRO').features,
        },
      },
    })
  } catch (error) {
    console.error('GET /api/subscription error:', error)
    return NextResponse.json({ error: 'Gagal memuat subscription' }, { status: 500 })
  }
}

/**
 * POST /api/subscription
 * Upgrade/downgrade user tier
 * Body: { tier: 'FREE' | 'PRO' }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await req.json().catch(() => ({}))
    const { tier } = body as { tier?: 'FREE' | 'PRO' }

    if (tier !== 'FREE' && tier !== 'PRO') {
      return NextResponse.json({ error: 'Tier tidak valid' }, { status: 400 })
    }

    const updateData: any = { tier }
    if (tier === 'PRO') {
      // Pro for 30 days (in production, integrate with payment gateway)
      updateData.tierExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    } else {
      updateData.tierExpiresAt = null
    }

    const updated = await db.userProfile.update({
      where: { id: user.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      tier: updated.tier,
      tierExpiresAt: updated.tierExpiresAt,
      limits: getTierLimits(updated.tier as 'FREE' | 'PRO'),
    })
  } catch (error) {
    console.error('POST /api/subscription error:', error)
    return NextResponse.json({ error: 'Gagal update subscription' }, { status: 500 })
  }
}
