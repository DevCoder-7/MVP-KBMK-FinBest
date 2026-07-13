/**
 * FinBest AI - Modul 2: Traction
 * POST /api/traction/confirm
 * Finalises a TractionCheck after cooling-off (server-validated) and reflection.
 *   - Verifies cooling-off elapsed, or delayed user override is allowed
 *   - Verifies all required reflections have non-empty answers
 *   - Creates Transaction (status=EXECUTED)
 *   - Updates Holding (BUY → add qty & recompute avgCost; SELL → reduce qty)
 *   - Updates TractionCheck: confirmed=true, overridden=override, confirmedAt=now
 *
 * Non-discretionary principle: risky checks can be continued after the
 * adaptive minimum wait + reflection + explicit override path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'
import { tractionRiskLevel } from '@/lib/utils-finance'
import { getLiveMarketSnapshot, livePriceFor } from '@/lib/market-data'

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

    const asset = await db.asset.findUnique({ where: { id: check.assetId } })
    const freshSnapshot = asset
      ? await getLiveMarketSnapshot([asset], { bypassCache: true })
      : null
    const freshAsset = asset && freshSnapshot
      ? livePriceFor(asset, freshSnapshot)
      : null
    const confirmationPrice = freshAsset?.price ?? check.price
    const priceChangePct =
      check.price > 0
        ? ((confirmationPrice - check.price) / check.price) * 100
        : 0

    // 1. Adaptive cooling-off enforcement (server-side, refresh-proof)
    if (risk.coolingOffMs > 0) {
      const elapsed = Date.now() - check.createdAt.getTime()
      const requiredWaitMs = body.override
        ? risk.skipAvailableAfterMs
        : risk.coolingOffMs
      if (elapsed < requiredWaitMs) {
        const remainingMs = risk.coolingOffMs - elapsed
        return apiError(
          body.override
            ? `Opsi lanjut dini belum tersedia. Sisa ${Math.ceil(
                (requiredWaitMs - elapsed) / 1000
              )} detik.`
            : `Cooling-off masih aktif. Sisa ${Math.ceil(
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
      const expectedAnswers = reflections.slice(0, risk.reflectionCount)
      const validAnswers = expectedAnswers.filter(
        (r) =>
          r &&
          typeof r.question === 'string' &&
          r.question.trim().length > 0 &&
          typeof r.answer === 'string' &&
          ['ya', 'tidak'].includes(r.answer.trim().toLowerCase())
      )
      if (
        reflections.length !== risk.reflectionCount ||
        validAnswers.length !== risk.reflectionCount
      ) {
        return apiError(
          `Wajib menjawab tepat ${risk.reflectionCount} pertanyaan refleksi dengan pilihan Ya atau Tidak.`,
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

    // 4-6. Persist transaction, holding, and audit state atomically.
    const transaction = await db.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId: user.id,
          assetId: check.assetId,
          side: check.side,
          quantity: check.quantity,
          price: confirmationPrice,
          status: 'CONFIRMED',
          executedAt: new Date(),
        },
      })

      const existing = await tx.holding.findFirst({
        where: { userId: user.id, assetId: check.assetId },
      })
      if (check.side === 'BUY') {
        if (existing) {
          const newQty = existing.quantity + check.quantity
          const newAvgCost =
            (existing.quantity * existing.avgCost +
              check.quantity * confirmationPrice) /
            newQty
          await tx.holding.update({
            where: { id: existing.id },
            data: { quantity: newQty, avgCost: newAvgCost },
          })
        } else {
          await tx.holding.create({
            data: {
              userId: user.id,
              assetId: check.assetId,
              quantity: check.quantity,
              avgCost: confirmationPrice,
            },
          })
        }
      } else if (existing) {
        const newQty = Math.max(0, existing.quantity - check.quantity)
        if (newQty === 0) {
          await tx.holding.delete({ where: { id: existing.id } })
        } else {
          await tx.holding.update({
            where: { id: existing.id },
            data: { quantity: newQty },
          })
        }
      }

      await tx.tractionCheck.update({
        where: { id: check.id },
        data: {
          transactionId: created.id,
          confirmed: true,
          overridden: Boolean(body.override),
          confirmedAt: new Date(),
          reflections: JSON.stringify(body.reflections ?? []),
        },
      })
      return created
    })

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      tractionScore: check.tractionScore,
      riskLevel: check.riskLevel,
      overridden: Boolean(body.override),
      priceAtCheck: check.price,
      confirmedPrice: transaction.price,
      priceChangePct,
      quoteAsOf: freshAsset?.quote.asOf ?? null,
    })
  } catch (error) {
    console.error('POST /api/traction/confirm error:', error)
    return apiError('Gagal mengkonfirmasi transaksi.', 500)
  }
}
