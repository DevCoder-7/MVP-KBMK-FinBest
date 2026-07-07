import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/** GET /api/auth/session - get current authenticated user */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ authenticated: false })
    }
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        riskScore: user.riskScore,
        riskProfile: user.riskProfile,
        tier: user.tier,
      },
    })
  } catch (error) {
    console.error('GET /api/auth/session error:', error)
    return NextResponse.json({ authenticated: false }, { status: 500 })
  }
}
