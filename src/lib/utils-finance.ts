/**
 * FinBest AI - Shared utilities & types
 */

/** Format currency in IDR */
export function formatIDR(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(2)} M`
  }
  if (compact && Math.abs(value) >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)} Jt`
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `Rp ${(value / 1_000).toFixed(0)} Rb`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Format percentage */
export function formatPct(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/** Format number with thousand separator */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Format date in Indonesian locale */
export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(d)
}

/** Format relative time */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} hari lalu`
  if (hours > 0) return `${hours} jam lalu`
  if (minutes > 0) return `${minutes} menit lalu`
  return 'Baru saja'
}

/** Risk profile classification per OJK standards */
export function classifyRisk(score: number): {
  label: string
  color: string
  description: string
  maxEquity: number
} {
  if (score >= 80)
    return {
      label: 'Agresif',
      color: 'rose',
      description: 'Toleransi risiko tinggi, fokus pertumbuhan jangka panjang',
      maxEquity: 80,
    }
  if (score >= 65)
    return {
      label: 'Moderat Agresif',
      color: 'amber',
      description: 'Pertumbuhan dengan toleransi volatilitas sedang-tinggi',
      maxEquity: 65,
    }
  if (score >= 45)
    return {
      label: 'Moderat',
      color: 'emerald',
      description: 'Keseimbangan antara pertumbuhan dan stabilitas',
      maxEquity: 50,
    }
  if (score >= 25)
    return {
      label: 'Moderat Konservatif',
      color: 'teal',
      description: 'Stabilitas modal dengan pertumbuhan moderat',
      maxEquity: 35,
    }
  return {
    label: 'Konservatif',
    color: 'slate',
    description: 'Perlindungan modal utama, risiko minimal',
    maxEquity: 20,
  }
}

/** Traction Score risk level classification per PRD FR-2.5 */
export function tractionRiskLevel(score: number): {
  level: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
  label: string
  color: string
  bgColor: string
  coolingOffMs: number
  skipAvailableAfterMs: number
  reflectionCount: number
} {
  if (score >= 80)
    return {
      level: 'GREEN',
      label: 'Aman',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500',
      coolingOffMs: 0,
      skipAvailableAfterMs: 0,
      reflectionCount: 0,
    }
  if (score >= 50)
    return {
      level: 'ORANGE',
      label: 'Risiko Sedang',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500',
      coolingOffMs: 15 * 1000,
      skipAvailableAfterMs: 8 * 1000,
      reflectionCount: 2,
    }
  return {
    level: 'RED',
    label: 'Risiko Tinggi',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500',
    coolingOffMs: 30 * 1000,
    skipAvailableAfterMs: 15 * 1000,
    reflectionCount: 3,
  }
}

/** Calculate portfolio NAV from holdings */
export function calcNAV(
  holdings: { quantity: number; asset: { price: number } }[]
): number {
  return holdings.reduce((sum, h) => sum + h.quantity * h.asset.price, 0)
}

/** Calculate sector concentration */
export function calcSectorConcentration(
  holdings: { quantity: number; asset: { price: number; sector: string | null } }[]
): Record<string, number> {
  const nav = calcNAV(holdings)
  if (nav === 0) return {}
  const sectors: Record<string, number> = {}
  for (const h of holdings) {
    const sector = h.asset.sector || 'Lainnya'
    const value = h.quantity * h.asset.price
    sectors[sector] = (sectors[sector] || 0) + (value / nav) * 100
  }
  return sectors
}

/** Calculate allocation by asset type */
export function calcAllocationByType(
  holdings: { quantity: number; asset: { price: number; type: string } }[]
): Record<string, number> {
  const nav = calcNAV(holdings)
  if (nav === 0) return {}
  const types: Record<string, number> = {}
  for (const h of holdings) {
    const value = h.quantity * h.asset.price
    types[h.asset.type] = (types[h.asset.type] || 0) + (value / nav) * 100
  }
  return types
}

/** Safe JSON parse */
export function safeJSONParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

/** Standard disclaimer for all AI outputs */
export const DISCLAIMER =
  'Konten ini bersifat edukatif dan informasional, bukan rekomendasi transaksi atau nasihat keuangan berizin. Keputusan dan eksekusi investasi sepenuhnya menjadi tanggung jawab Anda. FinBest AI bersifat non-diskrisioner: sistem tidak mengeksekusi transaksi atas nama pengguna.'

/** Calculate cooling-off remaining time */
export function calcCoolingOffRemaining(startTime: number, durationMs: number): number {
  const elapsed = Date.now() - startTime
  const remaining = durationMs - elapsed
  return Math.max(0, remaining)
}

/** Format milliseconds to mm:ss */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function formatDurationShort(ms: number): string {
  if (ms <= 0) return '0 detik'
  if (ms < 60000) return `${Math.ceil(ms / 1000)} detik`
  return `${Math.ceil(ms / 60000)} menit`
}
