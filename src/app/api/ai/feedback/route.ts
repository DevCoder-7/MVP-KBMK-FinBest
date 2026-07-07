/**
 * POST /api/ai/feedback
 * Save thumbs up/down feedback on a chat message.
 *
 * Request: { messageId: string, feedback: 'up'|'down', note?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await parseBody<{
      messageId?: string
      feedback?: 'up' | 'down'
      note?: string
    }>(req)

    if (!body?.messageId) return apiError('messageId wajib diisi', 400)
    if (body.feedback !== 'up' && body.feedback !== 'down') {
      return apiError('feedback harus "up" atau "down"', 400)
    }

    // Verify the message belongs to a session owned by this user
    const message = await db.chatMessage.findFirst({
      where: { id: body.messageId, session: { userId: user.id } },
    })
    if (!message) return apiError('Pesan tidak ditemukan', 404)

    const updated = await db.chatMessage.update({
      where: { id: message.id },
      data: {
        feedback: body.feedback,
        feedbackNote: body.note?.trim() || null,
      },
    })

    return NextResponse.json({
      messageId: updated.id,
      feedback: updated.feedback,
      feedbackNote: updated.feedbackNote,
    })
  } catch (error) {
    console.error('POST /api/ai/feedback error:', error)
    return apiError('Gagal menyimpan feedback', 500)
  }
}
