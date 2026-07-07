import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, parseBody } from '@/lib/api-helpers'

/**
 * POST /api/edukasi/progress
 * Mark a lesson as completed (mastery-based progression)
 * Body: { lessonId, quizScore? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await parseBody<{ lessonId: string; quizScore?: number }>(req)
    if (!body?.lessonId) {
      return NextResponse.json({ error: 'lessonId diperlukan' }, { status: 400 })
    }

    // Mastery-based: require quiz score >= 70 if provided
    if (body.quizScore !== undefined && body.quizScore < 70) {
      return NextResponse.json({
        success: false,
        message: 'Skor kuis belum mencapai ambang mastery (70). Pelajari ulang materinya.',
        quizScore: body.quizScore,
      })
    }

    // Check if already completed
    const existing = await db.insight.findFirst({
      where: {
        userId: user.id,
        type: 'LESSON_PROGRESS',
        title: body.lessonId,
      },
    })

    if (existing) {
      // Update timestamp for spaced repetition
      await db.insight.update({
        where: { id: existing.id },
        data: {
          createdAt: new Date(),
          description: `Quiz score: ${body.quizScore ?? 'N/A'}`,
        },
      })
      return NextResponse.json({
        success: true,
        message: 'Progress diperbarui (review)',
        reviewed: true,
      })
    }

    // Create new progress record
    await db.insight.create({
      data: {
        userId: user.id,
        type: 'LESSON_PROGRESS',
        title: body.lessonId,
        description: `Selesai. Skor kuis: ${body.quizScore ?? 'N/A'}`,
        severity: 'info',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Lesson selesai! Lanjut ke materi berikutnya.',
      reviewed: false,
    })
  } catch (error) {
    console.error('POST /api/edukasi/progress error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan progress' }, { status: 500 })
  }
}
