/**
 * FinBest AI - Modul 1: Profil & Rencana Investasi
 * API: GET/PUT /api/profile
 * - GET: returns user profile + target allocation + goals + last assessment date
 * - PUT: updates user profile (name, riskScore, riskProfile, horizonYears, annualIncome)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'

/** GET /api/profile — current profile + target allocation + goals */
export async function GET() {
  try {
    const user = await getDefaultUser()

    const [target, goals] = await Promise.all([
      db.targetAllocation.findUnique({ where: { userId: user.id } }),
      db.goal.findMany({
        where: { userId: user.id },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      }),
    ])

    // Determine last assessment date from the user's updatedAt (proxy for reassessment)
    const lastAssessmentDate = user.updatedAt

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        riskScore: user.riskScore,
        riskProfile: user.riskProfile,
        horizonYears: user.horizonYears,
        annualIncome: user.annualIncome,
      },
      targetAllocation: target
        ? {
            saham: target.saham,
            obligasi: target.obligasi,
            reksadana: target.reksadana,
            kas: target.kas,
            emas: target.emas,
          }
        : null,
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
      lastAssessmentDate,
    })
  } catch (error) {
    console.error('GET /api/profile error:', error)
    return apiError('Gagal memuat profil pengguna', 500)
  }
}

/** PUT /api/profile — update profile fields */
export async function PUT(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await parseBody<{
      name?: string
      riskScore?: number
      riskProfile?: string
      horizonYears?: number
      annualIncome?: number
    }>(req)

    if (!body) {
      return apiError('Body permintaan tidak valid', 400)
    }

    // Validate risk score range
    if (body.riskScore !== undefined) {
      if (
        typeof body.riskScore !== 'number' ||
        body.riskScore < 0 ||
        body.riskScore > 100
      ) {
        return apiError('Skor risiko harus berada di antara 0 dan 100', 400)
      }
    }

    if (body.horizonYears !== undefined) {
      if (
        typeof body.horizonYears !== 'number' ||
        body.horizonYears < 1 ||
        body.horizonYears > 50
      ) {
        return apiError('Horizon investasi harus 1-50 tahun', 400)
      }
    }

    if (body.annualIncome !== undefined) {
      if (typeof body.annualIncome !== 'number' || body.annualIncome < 0) {
        return apiError('Pendapatan tahunan tidak valid', 400)
      }
    }

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim().length > 0) {
      data.name = body.name.trim()
    }
    if (typeof body.riskScore === 'number') data.riskScore = body.riskScore
    if (typeof body.riskProfile === 'string' && body.riskProfile.trim()) {
      data.riskProfile = body.riskProfile.trim()
    }
    if (typeof body.horizonYears === 'number') data.horizonYears = body.horizonYears
    if (typeof body.annualIncome === 'number') data.annualIncome = body.annualIncome

    const updated = await db.userProfile.update({
      where: { id: user.id },
      data,
    })

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        riskScore: updated.riskScore,
        riskProfile: updated.riskProfile,
        horizonYears: updated.horizonYears,
        annualIncome: updated.annualIncome,
      },
    })
  } catch (error) {
    console.error('PUT /api/profile error:', error)
    return apiError('Gagal memperbarui profil', 500)
  }
}
