import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'
import { safeJSONParse } from '@/lib/utils-finance'

/** GET /api/ai-finbest/sessions/[id] — get session with messages */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDefaultUser()
    const { id } = await params
    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({
      session: { id: session.id, title: session.title },
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: safeJSONParse(m.citations, []),
        confidence: m.confidence,
        intent: m.intent,
        feedback: m.feedback,
        feedbackNote: m.feedbackNote,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/ai-finbest/sessions/[id] error:', error)
    return NextResponse.json({ error: 'Gagal memuat sesi' }, { status: 500 })
  }
}

/** DELETE /api/ai-finbest/sessions/[id] — delete session (UU PDP) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDefaultUser()
    const { id } = await params
    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    }
    await db.chatSession.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/ai-finbest/sessions/[id] error:', error)
    return NextResponse.json({ error: 'Gagal menghapus sesi' }, { status: 500 })
  }
}
