import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseBody } from '@/lib/api-helpers'

/** POST /api/ai-finbest/feedback — thumbs up/down feedback */
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<{
      messageId: string
      feedback: 'up' | 'down'
      note?: string
    }>(req)
    if (!body?.messageId || !body.feedback) {
      return NextResponse.json({ error: 'Data feedback tidak lengkap' }, { status: 400 })
    }
    const updated = await db.chatMessage.update({
      where: { id: body.messageId },
      data: {
        feedback: body.feedback,
        feedbackNote: body.note || null,
      },
    })
    return NextResponse.json({ success: true, messageId: updated.id })
  } catch (error) {
    console.error('POST /api/ai-finbest/feedback error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan feedback' }, { status: 500 })
  }
}
