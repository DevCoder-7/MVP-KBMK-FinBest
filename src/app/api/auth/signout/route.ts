import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'

/** POST /api/auth/signout - clear session */
export async function POST() {
  try {
    await clearSession()
    return NextResponse.json({ success: true, redirect: '/' })
  } catch (error) {
    console.error('POST /api/auth/signout error:', error)
    return NextResponse.json({ error: 'Gagal logout' }, { status: 500 })
  }
}
