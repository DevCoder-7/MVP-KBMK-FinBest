/**
 * FinBest AI - Modul 2: Traction
 * POST /api/traction/check
 * Evaluates a transaction intent deterministically and returns:
 *   - Traction Score (0-100, transparent rule-based penalties)
 *   - Risk level (GREEN / YELLOW / ORANGE / RED)
 *   - Cooling-off duration and reflection count (0 / 2 / 3)
 *   - Triggered rules with detail + penalty
 *   - Projected new allocation by asset type
 *   - Warnings (educational, non-blocking)
 * Creates a TractionCheck record (confirmed=false, overridden=false) so the
 * cooling-off window is persisted server-side and cannot be bypassed by refresh.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'
import {
  calcNAV,
  calcSectorConcentration,
  tractionRiskLevel,
} from '@/lib/utils-finance'
import { getLiveMarketSnapshot, livePriceFor } from '@/lib/market-data'

// ---- Tunable policy thresholds (PRD Modul 2) -------------------------------
const RULES = {
  ALLOCATION_DEVIATION_PP: 10, // percentage points
  ALLOCATION_PENALTY: 15,
  SECTOR_LIMIT: 25, // percentage
  SECTOR_PENALTY: 20,
  SINGLE_POSITION_LIMIT: 10, // percentage of NAV
  SINGLE_POSITION_PENALTY: 15,
  PRICE_SURGE_5D: 0.15, // 15%
  PRICE_SURGE_PENALTY: 20,
  VOLATILITY_THRESHOLD: 25, // %
  VOLATILITY_PENALTY: 10,
  FREQUENCY_PENALTY: 10,
  RISK_MISMATCH_PENALTY: 10,
} as const

// Asset-type considered "saham-like" (equity exposure) for risk-profile rule
const EQUITY_TYPES = new Set(['SAHAM', 'REKSADANA'])

interface CheckBody {
  assetId: string
  side: 'BUY' | 'SELL'
  quantity: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<CheckBody>(req)
    if (!body || !body.assetId || !body.side || !body.quantity) {
      return apiError(
        'Parameter tidak lengkap. Diperlukan: assetId, side (BUY/SELL), quantity.',
        422
      )
    }
    const side = body.side.toUpperCase() as 'BUY' | 'SELL'
    if (side !== 'BUY' && side !== 'SELL') {
      return apiError('Side harus BUY atau SELL.', 422)
    }
    const quantity = Number(body.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return apiError('Quantity harus berupa angka positif.', 422)
    }

    const user = await getDefaultUser()
    const asset = await db.asset.findUnique({ where: { id: body.assetId } })
    if (!asset) {
      return apiError('Aset tidak ditemukan.', 404)
    }

    // ---- Load portfolio context --------------------------------------------
    const [holdings, target, recentTx, allTx] = await Promise.all([
      db.holding.findMany({
        where: { userId: user.id },
        include: { asset: true },
      }),
      db.targetAllocation.findUnique({ where: { userId: user.id } }),
      db.transaction.findMany({
        where: {
          userId: user.id,
          executedAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        orderBy: { executedAt: 'desc' },
      }),
      db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { executedAt: 'asc' },
      }),
    ])

    const marketData = await getLiveMarketSnapshot([
      asset,
      ...holdings.map((h) => h.asset),
    ])
    const liveSelected = livePriceFor(asset, marketData)
    const liveAsset = {
      ...asset,
      price: liveSelected.price,
      prevPrice: liveSelected.prevPrice,
      price5dAgo: liveSelected.price5dAgo,
    }
    const liveHoldings = holdings.map((h) => {
      const live = livePriceFor(h.asset, marketData)
      return {
        ...h,
        asset: {
          ...h.asset,
          price: live.price,
          prevPrice: live.prevPrice,
          price5dAgo: live.price5dAgo,
        },
      }
    })

    const transactionValue = quantity * liveAsset.price
    const currentNAV = calcNAV(liveHoldings)

    // ---- Project new holdings state if trade executes ----------------------
    const projectedHoldings = liveHoldings.map((h) => ({ ...h }))
    const existingIdx = projectedHoldings.findIndex(
      (h) => h.assetId === liveAsset.id
    )
    if (side === 'BUY') {
      if (existingIdx >= 0) {
        projectedHoldings[existingIdx].quantity += quantity
      } else {
        // New position; mimic holding shape for downstream calc
        projectedHoldings.push({
          id: 'tmp',
          userId: user.id,
          assetId: liveAsset.id,
          quantity,
          avgCost: liveAsset.price,
          createdAt: new Date(),
          updatedAt: new Date(),
          asset: liveAsset,
        })
      }
    } else {
      // SELL — reduce quantity (floor at 0)
      if (existingIdx >= 0) {
        projectedHoldings[existingIdx].quantity = Math.max(
          0,
          projectedHoldings[existingIdx].quantity - quantity
        )
      }
    }

    const newNAV = calcNAV(projectedHoldings)
    const newSectorConcentration = calcSectorConcentration(projectedHoldings)

    // ---- New allocation by asset type --------------------------------------
    const newAllocation: Record<string, number> = {}
    for (const h of projectedHoldings) {
      const value = h.quantity * h.asset.price
      newAllocation[h.asset.type] =
        (newAllocation[h.asset.type] || 0) + (value / newNAV) * 100
    }

    // ---- Rule evaluation ---------------------------------------------------
    const rulesTriggered: Array<{
      rule: string
      detail: string
      penalty: number
    }> = []
    const warnings: string[] = []

    // 1. Allocation deviation (only for BUY of equity-type; general check on SAHAM)
    if (target && side === 'BUY') {
      const sahamPct = newAllocation['SAHAM'] || 0
      const deviation = sahamPct - target.saham
      if (deviation > RULES.ALLOCATION_DEVIATION_PP) {
        rulesTriggered.push({
          rule: 'Deviasi Alokasi',
          detail: `Alokasi saham proyeksi ${sahamPct.toFixed(
            1
          )}% melebihi target ${target.saham}% sebesar ${deviation.toFixed(
            1
          )} pp (batas +${RULES.ALLOCATION_DEVIATION_PP} pp).`,
          penalty: RULES.ALLOCATION_PENALTY,
        })
      } else if (deviation > 0) {
        warnings.push(
          `Alokasi saham ${sahamPct.toFixed(1)}% sedikit di atas target ${
            target.saham
          }% namun masih dalam toleransi.`
        )
      }
    }

    // 2. Sector concentration breach
    const assetSector = asset.sector || 'Lainnya'
    const sectorPct = newSectorConcentration[assetSector] || 0
    if (sectorPct > RULES.SECTOR_LIMIT) {
      rulesTriggered.push({
        rule: 'Konsentrasi Sektor',
        detail: `Sektor ${assetSector} mencapai ${sectorPct.toFixed(
          1
        )}% dari NAV (batas ${RULES.SECTOR_LIMIT}%). Diversifikasi sektor terbatas.`,
        penalty: RULES.SECTOR_PENALTY,
      })
    } else if (sectorPct > RULES.SECTOR_LIMIT - 5) {
      warnings.push(
        `Sektor ${assetSector} mendekati batas (${sectorPct.toFixed(
          1
        )}% dari ${RULES.SECTOR_LIMIT}%).`
      )
    }

    // 3. Single position limit (only meaningful for BUY)
    if (side === 'BUY') {
      const positionIdx = projectedHoldings.findIndex(
        (h) => h.assetId === liveAsset.id
      )
      const positionValue =
        positionIdx >= 0
          ? projectedHoldings[positionIdx].quantity * liveAsset.price
          : 0
      const positionPct = newNAV > 0 ? (positionValue / newNAV) * 100 : 0
      if (positionPct > RULES.SINGLE_POSITION_LIMIT) {
        rulesTriggered.push({
          rule: 'Konsentrasi Posisi Tunggal',
          detail: `Posisi ${asset.ticker} mencapai ${positionPct.toFixed(
            1
          )}% dari NAV (batas ${RULES.SINGLE_POSITION_LIMIT}%).`,
          penalty: RULES.SINGLE_POSITION_PENALTY,
        })
      }
    }

    // 4. 5-day price surge (impulsive flag) — only for BUY
    if (
      side === 'BUY' &&
      liveAsset.price5dAgo > 0 &&
      (liveAsset.price - liveAsset.price5dAgo) / liveAsset.price5dAgo >
        RULES.PRICE_SURGE_5D
    ) {
      const surgePct =
        ((liveAsset.price - liveAsset.price5dAgo) / liveAsset.price5dAgo) * 100
      rulesTriggered.push({
        rule: 'Lonjakan Harga 5 Hari (Impulsif)',
        detail: `Harga ${asset.ticker} naik ${surgePct.toFixed(
          1
        )}% dalam 5 hari (ambang ${
          RULES.PRICE_SURGE_5D * 100
        }%). Indikasi pembelian FOMO.`,
        penalty: RULES.PRICE_SURGE_PENALTY,
      })
    }

    // 5. High volatility
    if (asset.volatility30d > RULES.VOLATILITY_THRESHOLD) {
      rulesTriggered.push({
        rule: 'Volatilitas Tinggi',
        detail: `Volatilitas 30 hari ${asset.volatility30d.toFixed(
          1
        )}% (ambang ${RULES.VOLATILITY_THRESHOLD}%). Variasi harga signifikan.`,
        penalty: RULES.VOLATILITY_PENALTY,
      })
    }

    // 6. Transaction frequency anomaly
    // Weekly average derived from full transaction history.
    const totalDays =
      allTx.length > 0
        ? Math.max(
            1,
            (Date.now() - allTx[0].executedAt.getTime()) / 86400000
          )
        : 1
    const weeklyAvg = (allTx.length / totalDays) * 7
    const stdDev = 1.5 // simplified: treat 1.5 tx above weekly avg as anomaly
    if (recentTx.length > weeklyAvg + 2 * stdDev && recentTx.length >= 4) {
      rulesTriggered.push({
        rule: 'Anomali Frekuensi Transaksi',
        detail: `${recentTx.length} transaksi dalam 7 hari terakhir, di atas pola rata-rata ${weeklyAvg.toFixed(
          1
        )}/minggu. Indikasi overtrading.`,
        penalty: RULES.FREQUENCY_PENALTY,
      })
    }

    // 7. Risk profile mismatch (e.g., Agresif asset for Konservatif profile)
    if (side === 'BUY' && EQUITY_TYPES.has(asset.type)) {
      const profile = user.riskProfile
      let mismatch = false
      let detail = ''
      if (
        profile === 'Konservatif' ||
        profile === 'Moderat Konservatif'
      ) {
        mismatch = true
        detail = `Profil ${profile} membatasi eksposur saham; aset ${asset.ticker} (${asset.type}) berisiko tinggi untuk profil ini.`
      } else if (
        profile === 'Moderat' &&
        asset.volatility30d > RULES.VOLATILITY_THRESHOLD
      ) {
        mismatch = true
        detail = `Profil Moderat + aset volatil (${asset.ticker}) di atas ambang ${RULES.VOLATILITY_THRESHOLD}%.`
      }
      if (mismatch) {
        rulesTriggered.push({
          rule: 'Ketidaksesuaian Profil Risiko',
          detail,
          penalty: RULES.RISK_MISMATCH_PENALTY,
        })
      }
    }

    // ---- Traction Score ----------------------------------------------------
    const totalPenalty = rulesTriggered.reduce((s, r) => s + r.penalty, 0)
    const tractionScore = Math.max(0, Math.min(100, 100 - totalPenalty))
    const { level, coolingOffMs, reflectionCount } =
      tractionRiskLevel(tractionScore)

    if (tractionScore >= 60 && tractionScore < 80) {
      warnings.push(
        'Traction Score di zona Peringatan. Tinjau kembali rencana alokasi sebelum eksekusi.'
      )
    }

    // ---- Persist TractionCheck (audit + cooling-off anchor) ----------------
    const check = await db.tractionCheck.create({
      data: {
        userId: user.id,
        assetId: liveAsset.id,
        side,
        quantity,
        price: liveAsset.price,
        tractionScore,
        riskLevel: level,
        coolingOffMs,
        rulesTriggered: JSON.stringify(
          rulesTriggered.map((r) => ({
            rule: r.rule,
            detail: r.detail,
            penalty: r.penalty,
          }))
        ),
        confirmed: false,
        overridden: false,
      },
    })

    return NextResponse.json({
      checkId: check.id,
      createdAt: check.createdAt,
      tractionScore,
      riskLevel: level,
      coolingOffMs,
      reflectionCount,
      rulesTriggered,
      transactionValue,
      currentNAV,
      newNAV,
      newAllocation,
      newSectorConcentration,
      marketData,
      warnings,
    })
  } catch (error) {
    console.error('POST /api/traction/check error:', error)
    return apiError('Gagal mengevaluasi transaksi.', 500)
  }
}
