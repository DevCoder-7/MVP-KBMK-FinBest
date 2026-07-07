/**
 * FinBest AI - Modul 1: Profil & Rencana Investasi
 * API: GET/POST /api/profile/goals
 * - GET: list all goals for the demo user
 * - POST: create a new goal
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'

const VALID_PRIORITIES = ['Rendah', 'Sedang', 'Tinggi']

/** GET /api/profile/goals — list goals */
export async function GET() {
  try {
    const user = await getDefaultUser()
    const goals = await db.goal.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        horizonYears: g.horizonYears,
        monthlyContribution: g.monthlyContribution,
        priority: g.priority,
        progress:
          g.targetAmount > 0
            ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
            : 0,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/profile/goals error:', error)
    return apiError('Gagal memuat daftar tujuan keuangan', 500)
  }
}

/** POST /api/profile/goals — create a goal */
export async function POST(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await parseBody<{
      title?: string
      targetAmount?: number
      currentAmount?: number
      horizonYears?: number
      monthlyContribution?: number
      priority?: string
    }>(req)

    if (!body) return apiError('Body permintaan tidak valid', 400)

    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return apiError('Judul tujuan wajib diisi', 400)
    }
    if (
      typeof body.targetAmount !== 'number' ||
      body.targetAmount <= 0
    ) {
      return apiError('Target jumlah harus lebih dari 0', 400)
    }
    if (
      typeof body.horizonYears !== 'number' ||
      body.horizonYears < 1 ||
      body.horizonYears > 50
    ) {
      return apiError('Horizon investasi harus 1-50 tahun', 400)
    }

    const priority = VALID_PRIORITIES.includes(body.priority || '')
      ? (body.priority as string)
      : 'Sedang'

    const currentAmount =
      typeof body.currentAmount === 'number' && body.currentAmount >= 0
        ? body.currentAmount
        : 0
    const monthlyContribution =
      typeof body.monthlyContribution === 'number' &&
      body.monthlyContribution >= 0
        ? body.monthlyContribution
        : 0

    const goal = await db.goal.create({
      data: {
        userId: user.id,
        title: body.title.trim(),
        targetAmount: body.targetAmount,
        currentAmount,
        horizonYears: body.horizonYears,
        monthlyContribution,
        priority,
      },
    })

    return NextResponse.json({
      goal: {
        id: goal.id,
        title: goal.title,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        horizonYears: goal.horizonYears,
        monthlyContribution: goal.monthlyContribution,
        priority: goal.priority,
        progress:
          goal.targetAmount > 0
            ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
            : 0,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
      },
    })
  } catch (error) {
    console.error('POST /api/profile/goals error:', error)
    return apiError('Gagal menambahkan tujuan keuangan', 500)
  }
}
