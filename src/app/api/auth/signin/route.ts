import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/api-helpers'
import { signInOrSignUp, createSession } from '@/lib/auth'

/**
 * POST /api/auth/signin
 * Combined sign-in and sign-up:
 * - If username exists → verify password → login
 * - If username doesn't exist → create account + login
 *
 * Body: { username, password }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<{ username: string; password: string }>(req)
    if (!body?.username || !body?.password) {
      return NextResponse.json(
        { error: 'Username dan password diperlukan' },
        { status: 400 }
      )
    }

    const result = await signInOrSignUp(body.username, body.password)

    if (!result.success || !result.userId) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    await createSession(result.userId)

    return NextResponse.json({
      success: true,
      userId: result.userId,
      redirect: '/app',
    })
  } catch (error) {
    console.error('POST /api/auth/signin error:', error)
    return NextResponse.json(
      { error: 'Gagal memproses autentikasi' },
      { status: 500 }
    )
  }
}
