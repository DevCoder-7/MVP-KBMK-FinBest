/**
 * FinBest AI - Modul 2: Traction
 * POST /api/traction/confirm
 * Finalises a TractionCheck after cooling-off (server-validated) and reflection.
 *   - Verifies cooling-off elapsed when riskLevel in {ORANGE, RED}
 *   - Verifies all required reflections have non-empty answers
 *   - Creates Transaction (status=EXECUTED)
 *   - Updates Holding (BUY → add qty & recompute avgCost; SELL → reduce qty)
 *   - Updates TractionCheck: confirmed=true, overridden=override, confirmedAt=now
 *
 * Non-discretionary principle: even RED checks can be confirmed after the
 * cooling-off + reflection + override double-confirm path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'
import { tractionRiskLevel } from '@/lib/utils-finance'

interface ReflectionAnswer {
  question: string
  answer: string
}

interface ConfirmBody {
  checkId: string
  reflections: ReflectionAnswer[]
  override: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<ConfirmBody>(req)
    if (!body || !body.checkId) {
      return apiError('checkId wajib diisi.', 422)
    }

    const user = await getDefaultUser()
    const check = await db.tractionCheck.findUnique({
      where: { id: body.checkId },
    })

    if (!check || check.userId !== user.id) {
      return apiError('TractionCheck tidak ditemukan.', 404)
    }
    if (check.confirmed) {
      return apiError(
        'Transaksi ini sudah dikonfirmasi sebelumnya.',
        409
      )
    }

    const risk = tractionRiskLevel(check.tractionScore)

    // 1. Cooling-off enforcement (server-side, refresh-proof)
    if (risk.coolingOffMs > 0) {
      const elapsed = Date.now() - check.createdAt.getTime()
      if (elapsed < risk.coolingOffMs) {
        const remainingMs = risk.coolingOffMs - elapsed
        return apiError(
          `Cooling-off masih aktif. Sisa ${Math.ceil(
            remainingMs / 1000
          )} detik.`,
          425 // Early Hints-style "too early"; using 425 (Too Early)
        )
      }
    }

    // 2. Reflection enforcement
    if (risk.reflectionCount > 0) {
      const reflections = Array.isArray(body.reflections)
        ? body.reflections
        : []
      const validAnswers = reflections.filter(
        (r) => r && r.question && r.answer && r.answer.trim().length > 0
      )
      if (validAnswers.length < risk.reflectionCount) {
        return apiError(
          `Wajib menjawab ${risk.reflectionCount} pertanyaan refleksi.`,
          422
        )
      }
    }

    // 3. SELL validation — must hold enough quantity
    if (check.side === 'SELL') {
      const holding = await db.holding.findFirst({
        where: { userId: user.id, assetId: check.assetId },
      })
      const heldQty = holding?.quantity ?? 0
      if (heldQty < check.quantity) {
        return apiError(
          `Kuantitas SELL (${check.quantity}) melebihi saldo (${heldQty}).`,
          422
        )
      }
    }

    // 4. Create Transaction
    const transaction = await db.transaction.create({
      data: {
        userId: user.id,
        assetId: check.assetId,
        side: check.side,
        quantity: check.quantity,
        price: check.price,
        status: 'EXECUTED',
        executedAt: new Date(),
      },
    })

    // 5. Update Holding
    const existing = await db.holding.findFirst({
      where: { userId: user.id, assetId: check.assetId },
    })
    if (check.side === 'BUY') {
      if (existing) {
        const newQty = existing.quantity + check.quantity
        const newAvgCost =
          newQty > 0
            ? (existing.quantity * existing.avgCost +
                check.quantity * check.price) /
              newQty
            : check.price
        await db.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCost: newAvgCost },
        })
      } else {
        await db.holding.create({
          data: {
            userId: user.id,
            assetId: check.assetId,
            quantity: check.quantity,
            avgCost: check.price,
          },
        })
      }
    } else {
      // SELL — reduce quantity; remove holding if zero
      if (existing) {
        const newQty = Math.max(0, existing.quantity - check.quantity)
        if (newQty === 0) {
          await db.holding.delete({ where: { id: existing.id } })
        } else {
          await db.holding.update({
            where: { id: existing.id },
            data: { quantity: newQty },
          })
        }
      }
    }

    // 6. Update TractionCheck
    await db.tractionCheck.update({
      where: { id: check.id },
      data: {
        transactionId: transaction.id,
        confirmed: true,
        overridden: Boolean(body.override),
        confirmedAt: new Date(),
        reflections: JSON.stringify(body.reflections ?? []),
      },
    })

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      tractionScore: check.tractionScore,
      riskLevel: check.riskLevel,
      overridden: Boolean(body.override),
    })
  } catch (error) {
    console.error('POST /api/traction/confirm error:', error)
    return apiError('Gagal mengkonfirmasi transaksi.', 500)
  }
}
