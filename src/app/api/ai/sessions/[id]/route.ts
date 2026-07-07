/**
 * GET    /api/ai/sessions/[id] - get session with messages
 * DELETE /api/ai/sessions/[id] - delete session (UU PDP right to be forgotten)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError } from '@/lib/api-helpers'
import { safeJSONParse } from '@/lib/utils-finance'

export const runtime = 'nodejs'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const user = await getDefaultUser()
    const { id } = await params
    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!session) return apiError('Sesi tidak ditemukan', 404)

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations:
          m.role === 'assistant'
            ? safeJSONParse<
                {
                  id: string
                  title: string
                  source: string
                  snippet: string
                  similarity: number
                }[]
              >(m.citations, [])
            : [],
        confidence: m.confidence,
        intent: m.intent,
        feedback: m.feedback,
        feedbackNote: m.feedbackNote,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/ai/sessions/[id] error:', error)
    return apiError('Gagal memuat sesi', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  try {
    const user = await getDefaultUser()
    const { id } = await params
    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!session) return apiError('Sesi tidak ditemukan', 404)

    // Cascade delete (right to be forgotten, UU PDP)
    await db.chatSession.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/ai/sessions/[id] error:', error)
    return apiError('Gagal menghapus sesi', 500)
  }
}
