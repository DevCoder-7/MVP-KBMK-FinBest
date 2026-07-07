/**
 * FinBest AI - Modul 1: Profil & Rencana Investasi
 * API: PUT/DELETE /api/profile/goals/[id]
 * - PUT: update a goal
 * - DELETE: delete a goal
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'

const VALID_PRIORITIES = ['Rendah', 'Sedang', 'Tinggi']

/** PUT /api/profile/goals/[id] — update a goal */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDefaultUser()
    const { id } = await params

    const existing = await db.goal.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) return apiError('Tujuan tidak ditemukan', 404)

    const body = await parseBody<{
      title?: string
      targetAmount?: number
      currentAmount?: number
      horizonYears?: number
      monthlyContribution?: number
      priority?: string
    }>(req)

    if (!body) return apiError('Body permintaan tidak valid', 400)

    const data: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      data.title = body.title.trim()
    }
    if (typeof body.targetAmount === 'number' && body.targetAmount > 0) {
      data.targetAmount = body.targetAmount
    }
    if (typeof body.currentAmount === 'number' && body.currentAmount >= 0) {
      data.currentAmount = body.currentAmount
    }
    if (
      typeof body.horizonYears === 'number' &&
      body.horizonYears >= 1 &&
      body.horizonYears <= 50
    ) {
      data.horizonYears = body.horizonYears
    }
    if (
      typeof body.monthlyContribution === 'number' &&
      body.monthlyContribution >= 0
    ) {
      data.monthlyContribution = body.monthlyContribution
    }
    if (typeof body.priority === 'string' && VALID_PRIORITIES.includes(body.priority)) {
      data.priority = body.priority
    }

    const updated = await db.goal.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      goal: {
        id: updated.id,
        title: updated.title,
        targetAmount: updated.targetAmount,
        currentAmount: updated.currentAmount,
        horizonYears: updated.horizonYears,
        monthlyContribution: updated.monthlyContribution,
        priority: updated.priority,
        progress:
          updated.targetAmount > 0
            ? Math.min(100, (updated.currentAmount / updated.targetAmount) * 100)
            : 0,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error('PUT /api/profile/goals/[id] error:', error)
    return apiError('Gagal memperbarui tujuan', 500)
  }
}

/** DELETE /api/profile/goals/[id] — delete a goal */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDefaultUser()
    const { id } = await params

    const existing = await db.goal.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) return apiError('Tujuan tidak ditemukan', 404)

    await db.goal.delete({ where: { id } })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('DELETE /api/profile/goals/[id] error:', error)
    return apiError('Gagal menghapus tujuan', 500)
  }
}
