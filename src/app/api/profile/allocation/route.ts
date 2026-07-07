/**
 * FinBest AI - Modul 1: Profil & Rencana Investasi
 * API: PUT /api/profile/allocation
 * - PUT: upsert target allocation (5 asset types must total 100)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'

interface AllocationBody {
  saham?: number
  obligasi?: number
  reksadana?: number
  kas?: number
  emas?: number
}

const FIELDS: (keyof AllocationBody)[] = [
  'saham',
  'obligasi',
  'reksadana',
  'kas',
  'emas',
]

/** PUT /api/profile/allocation — update target allocation */
export async function PUT(req: NextRequest) {
  try {
    const user = await getDefaultUser()
    const body = await parseBody<AllocationBody>(req)

    if (!body) return apiError('Body permintaan tidak valid', 400)

    // Validate all 5 fields exist and are valid percentages
    for (const field of FIELDS) {
      const v = body[field]
      if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 100) {
        return apiError(
          `Nilai ${field} tidak valid (harus 0-100)`,
          400
        )
      }
    }

    const total =
      (body.saham as number) +
      (body.obligasi as number) +
      (body.reksadana as number) +
      (body.kas as number) +
      (body.emas as number)

    // Allow small floating point tolerance
    if (Math.abs(total - 100) > 0.5) {
      return apiError(
        `Total alokasi harus 100%. Saat ini ${total.toFixed(1)}%`,
        400
      )
    }

    const updated = await db.targetAllocation.upsert({
      where: { userId: user.id },
      update: {
        saham: body.saham as number,
        obligasi: body.obligasi as number,
        reksadana: body.reksadana as number,
        kas: body.kas as number,
        emas: body.emas as number,
      },
      create: {
        userId: user.id,
        saham: body.saham as number,
        obligasi: body.obligasi as number,
        reksadana: body.reksadana as number,
        kas: body.kas as number,
        emas: body.emas as number,
      },
    })

    return NextResponse.json({
      allocation: {
        saham: updated.saham,
        obligasi: updated.obligasi,
        reksadana: updated.reksadana,
        kas: updated.kas,
        emas: updated.emas,
        total:
          updated.saham +
          updated.obligasi +
          updated.reksadana +
          updated.kas +
          updated.emas,
      },
    })
  } catch (error) {
    console.error('PUT /api/profile/allocation error:', error)
    return apiError('Gagal memperbarui alokasi target', 500)
  }
}
