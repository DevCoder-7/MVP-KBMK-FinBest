/**
 * GET  /api/ai/sessions - list chat sessions for current user
 * POST /api/ai/sessions - create a new empty session
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getDefaultUser()
    const sessions = await db.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    })
    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
      })),
    })
  } catch (error) {
    console.error('GET /api/ai/sessions error:', error)
    return apiError('Gagal memuat daftar sesi', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await parseBody<{ title?: string }>(req)
    const title = body?.title?.trim() || 'Sesi Baru'
    const session = await db.chatSession.create({
      data: {
        userId: user.id,
        title,
      },
    })
    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    })
  } catch (error) {
    console.error('POST /api/ai/sessions error:', error)
    return apiError('Gagal membuat sesi baru', 500)
  }
}
