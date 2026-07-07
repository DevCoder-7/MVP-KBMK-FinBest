import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, parseBody } from '@/lib/api-helpers'

/** GET /api/ai-finbest/sessions — list chat sessions */
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
    console.error('GET /api/ai-finbest/sessions error:', error)
    return NextResponse.json({ error: 'Gagal memuat sesi' }, { status: 500 })
  }
}

/** POST /api/ai-finbest/sessions — create new session */
export async function POST(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await parseBody<{ title?: string }>(req)
    const session = await db.chatSession.create({
      data: {
        userId: user.id,
        title: body?.title || 'Sesi Baru',
      },
    })
    return NextResponse.json({ session })
  } catch (error) {
    console.error('POST /api/ai-finbest/sessions error:', error)
    return NextResponse.json({ error: 'Gagal membuat sesi' }, { status: 500 })
  }
}
