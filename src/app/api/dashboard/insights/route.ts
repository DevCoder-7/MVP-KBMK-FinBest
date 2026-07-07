import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, parseBody, apiError } from '@/lib/api-helpers'

/**
 * GET /api/dashboard/insights
 * Daftar insight pengguna (dipiscing oleh tab Dashboard).
 *
 * POST /api/dashboard/insights
 * Body: { insightId, action: 'read' }
 * Menandai insight sebagai telah dibaca.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userIdParam = searchParams.get('userId')

    let user
    if (userIdParam) {
      user = await db.userProfile.findUnique({ where: { id: userIdParam } })
    }
    if (!user) {
      user = await getDefaultUser()
    }

    const insights = await db.insight.findMany({
      where: { userId: user.id },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    })

    const unreadCount = insights.filter((i) => !i.isRead).length

    return NextResponse.json({
      insights: insights.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        description: i.description,
        severity: i.severity,
        isRead: i.isRead,
        createdAt: i.createdAt,
      })),
      unreadCount,
      totalCount: insights.length,
    })
  } catch (error) {
    console.error('GET /api/dashboard/insights error:', error)
    return NextResponse.json(
      { error: 'Gagal memuat insight' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<{
      insightId?: string
      action?: string
      userId?: string
    }>(req)

    if (!body || !body.insightId) {
      return apiError('insightId wajib diisi', 400)
    }
    if (body.action !== 'read') {
      return apiError(`Aksi tidak didukung: ${body.action}`, 400)
    }

    let user
    if (body.userId) {
      user = await db.userProfile.findUnique({ where: { id: body.userId } })
    }
    if (!user) {
      user = await getDefaultUser()
    }

    // Pastikan insight milik user ini
    const existing = await db.insight.findUnique({
      where: { id: body.insightId },
    })
    if (!existing || existing.userId !== user.id) {
      return apiError('Insight tidak ditemukan', 404)
    }

    const updated = await db.insight.update({
      where: { id: body.insightId },
      data: { isRead: true },
    })

    return NextResponse.json({
      success: true,
      insight: {
        id: updated.id,
        isRead: updated.isRead,
      },
    })
  } catch (error) {
    console.error('POST /api/dashboard/insights error:', error)
    return NextResponse.json(
      { error: 'Gagal memperbarui insight' },
      { status: 500 }
    )
  }
}
