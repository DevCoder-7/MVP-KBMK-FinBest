'use client'

/**
 * FinBest AI — Modul 2: Traction (Pencegahan Keputusan Impulsif)
 *
 * - Pre-trade check: form asset/side/qty → server-evaluated Traction Score
 * - Cooling-off timer anchored to server TractionCheck.createdAt
 * - Structured reflection + delayed skip based on risk tier
 * - Non-discretionary override path with double-confirm
 * - Audit trail + stats dashboard + CSV export
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Brain,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  Activity,
  TrendingUp,
  Percent,
  History,
  ChevronRight,
  Info,
  RotateCcw,
  Scale,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatIDR,
  formatPct,
  formatCountdown,
  formatDurationShort,
  calcCoolingOffRemaining,
  tractionRiskLevel,
  DISCLAIMER,
  formatRelativeTime,
  formatDate,
} from '@/lib/utils-finance'
import { useAppStore } from '@/lib/store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
type Side = 'BUY' | 'SELL'

interface Asset {
  id: string
  ticker: string
  name: string
  type: string
  sector: string | null
  price: number
  prevPrice: number
  price5dAgo: number
  volatility30d: number
}

interface TriggeredRule {
  rule: string
  detail: string
  penalty: number
}

interface CheckResponse {
  checkId: string
  createdAt: string
  side: Side
  asset: {
    id: string
    ticker: string
    name: string
    type: string
    sector: string | null
  }
  tractionScore: number
  riskLevel: RiskLevel
  coolingOffMs: number
  skipAvailableAfterMs: number
  reflectionCount: number
  rulesTriggered: TriggeredRule[]
  scoreBreakdown?: {
    model: string
    confidence: number
    riskPoints: number
    dataScope: string
    explainability: string
    policy: string
  }
  transactionValue: number
  currentNAV: number
  newNAV: number
  newAllocation: Record<string, number>
  newSectorConcentration: Record<string, number>
  warnings: string[]
}

interface AuditCheck {
  id: string
  asset: {
    id: string
    ticker: string
    name: string
    type: string
    sector: string | null
  }
  side: Side
  quantity: number
  price: number
  transactionValue: number
  tractionScore: number
  riskLevel: RiskLevel
  coolingOffMs: number
  rulesTriggered: TriggeredRule[]
  reflections: Array<{ question: string; answer: string }>
  confirmed: boolean
  overridden: boolean
  createdAt: string
  confirmedAt: string | null
  transactionId: string | null
  transactionStatus: string | null
}

interface StatsResponse {
  avgScore30d: number
  impulsiveRatio: number
  completionRate: number
  overrideRate: number
  totalChecks30d: number
  totalChecks: number
}

interface HistoryResponse {
  checks: AuditCheck[]
  stats: StatsResponse
}

// ---------------------------------------------------------------------------
// Reflection checklist (PRD FR-2.4)
// ---------------------------------------------------------------------------
type ReflectionQuestion = {
  id: string
  text: string
  helper: string
}

function buildReflectionQuestions(
  side: Side,
  asset: CheckResponse['asset'],
  count: number
): ReflectionQuestion[] {
  const action = side === 'BUY' ? 'BUY' : 'SELL'
  const impulseRisk = side === 'BUY' ? 'FOMO/tips/herding' : 'panic selling/herding'
  const outcomeRisk =
    side === 'BUY'
      ? 'risiko downside setelah masuk posisi'
      : 'risiko opportunity loss setelah keluar posisi'
  const planFit =
    side === 'BUY'
      ? `BUY ${asset.ticker} ini masih sesuai rencana alokasi target Anda?`
      : `SELL ${asset.ticker} ini masih sesuai rencana exit atau rebalancing Anda?`

  return [
    {
      id: 'plan-fit',
      text: planFit,
      helper:
        side === 'BUY'
          ? 'Cek batas alokasi, konsentrasi sektor, dan ukuran transaksi.'
          : 'Cek tujuan jual: cut-loss, take-profit, rebalancing, atau kebutuhan likuiditas.',
    },
    {
      id: 'analysis-based',
      text: `Keputusan ${action} ini berbasis analisis, bukan ${impulseRisk}?`,
      helper:
        'Jawab cepat berdasarkan alasan utama Anda. Reason codes tetap tersimpan di audit trail.',
    },
    {
      id: 'risk-accepted',
      text: `Anda memahami ${outcomeRisk} dan tetap ingin mencatat keputusan ${action} ini?`,
      helper:
        'FinBest tidak mengeksekusi order. Checklist ini hanya decision journal non-diskrisioner.',
    },
  ].slice(0, Math.max(0, count))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const RISK_THEME: Record<
  RiskLevel,
  {
    label: string
    text: string
    bg: string
    border: string
    ring: string
    gaugeStroke: string
    badgeClass: string
  }
> = {
  GREEN: {
    label: 'Aman',
    text: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    ring: 'ring-success/40',
    gaugeStroke: '#22C55E',
    badgeClass:
      'bg-success/15 text-success border-success/30',
  },
  YELLOW: {
    label: 'Risiko Sedang',
    text: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    ring: 'ring-warning/40',
    gaugeStroke: '#F59E0B',
    badgeClass:
      'bg-warning/15 text-warning border-warning/30',
  },
  ORANGE: {
    label: 'Risiko Sedang',
    text: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    ring: 'ring-orange-500/40',
    gaugeStroke: '#F59E0B',
    badgeClass:
      'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  },
  RED: {
    label: 'Risiko Tinggi',
    text: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    ring: 'ring-destructive/40',
    gaugeStroke: '#EF4444',
    badgeClass:
      'bg-destructive/15 text-destructive border-destructive/30',
  },
}

function Gauge({
  score,
  risk,
  size = 180,
}: {
  score: number
  risk: RiskLevel
  size?: number
}) {
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, score)) / 100
  const offset = circumference * (1 - pct)
  const theme = RISK_THEME[risk]
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={theme.gaugeStroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-5xl font-bold tabular-nums"
          style={{ color: theme.gaugeStroke }}
        >
          {score}
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">
          Traction Score
        </span>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  tone = 'emerald',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  suffix?: string
  hint?: string
  tone?: 'emerald' | 'amber' | 'rose' | 'teal'
}) {
  const toneMap: Record<string, string> = {
    emerald: 'text-primary bg-primary/10',
    amber: 'text-warning bg-warning/10',
    rose: 'text-destructive bg-destructive/10',
    teal: 'text-chart-4 bg-chart-4/15',
  }
  return (
    <Card className="card-editorial overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-serif text-2xl font-semibold tracking-tight tabular-nums">
              {value}
              {suffix ? (
                <span className="ml-1 text-sm font-semibold text-muted-foreground">
                  {suffix}
                </span>
              ) : null}
            </p>
            {hint ? (
              <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${toneMap[tone]}`}
          >
            <Icon className="size-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function levelBadge(level: RiskLevel) {
  const theme = RISK_THEME[level]
  return (
    <Badge variant="outline" className={`gap-1 ${theme.badgeClass}`}>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: theme.gaugeStroke }}
      />
      {theme.label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function TractionModule() {
  // ---- Cross-module navigation (AI FinBest) -------------------------------
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setPendingAIQuery = useAppStore((s) => s.setPendingAIQuery)

  // ---- Form state ----------------------------------------------------------
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetId, setAssetId] = useState<string>('')
  const [side, setSide] = useState<Side>('BUY')
  const [quantity, setQuantity] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [activeCheck, setActiveCheck] = useState<CheckResponse | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false)

  // Adaptive countdown (ms remaining). Refresh-proof: anchored to server createdAt.
  const [remainingMs, setRemainingMs] = useState(0)

  // Reflections: map of question id -> yes/no answer
  const [reflections, setReflections] = useState<Record<string, string>>({})

  // Audit trail + stats
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null)

  const tickerRef = useRef<NodeJS.Timeout | null>(null)

  // ---- Derived -------------------------------------------------------------
  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === assetId) || null,
    [assets, assetId]
  )
  const totalValue = useMemo(() => {
    const qty = Number(quantity)
    if (!selectedAsset || !Number.isFinite(qty) || qty <= 0) return 0
    return qty * selectedAsset.price
  }, [selectedAsset, quantity])

  const reflectionQuestions = useMemo(() => {
    if (!activeCheck) return [] as ReflectionQuestion[]
    return buildReflectionQuestions(
      activeCheck.side,
      activeCheck.asset,
      activeCheck.reflectionCount
    )
  }, [activeCheck])

  const coolingOffActive = useMemo(() => {
    if (!activeCheck || activeCheck.coolingOffMs === 0) return false
    return remainingMs > 0
  }, [activeCheck, remainingMs])

  const coolingElapsedMs = useMemo(() => {
    if (!activeCheck || activeCheck.coolingOffMs === 0) return 0
    return Math.max(0, activeCheck.coolingOffMs - remainingMs)
  }, [activeCheck, remainingMs])

  const skipAvailableAfterMs = activeCheck?.skipAvailableAfterMs ?? 0
  const skipUnlocked = useMemo(() => {
    if (!activeCheck || activeCheck.coolingOffMs === 0) return true
    return coolingElapsedMs >= skipAvailableAfterMs
  }, [activeCheck, coolingElapsedMs, skipAvailableAfterMs])
  const skipUnlockRemainingMs = useMemo(() => {
    if (!activeCheck || skipUnlocked) return 0
    return Math.max(0, skipAvailableAfterMs - coolingElapsedMs)
  }, [activeCheck, coolingElapsedMs, skipAvailableAfterMs, skipUnlocked])
  const waitGateSatisfied = useMemo(() => {
    if (!activeCheck || activeCheck.coolingOffMs === 0) return true
    return !coolingOffActive || skipUnlocked
  }, [activeCheck, coolingOffActive, skipUnlocked])
  const isEarlyContinuation = Boolean(
    activeCheck && activeCheck.coolingOffMs > 0 && coolingOffActive && skipUnlocked
  )

  const allReflectionsAnswered = useMemo(() => {
    if (reflectionQuestions.length === 0) return true
    return reflectionQuestions.every(
      (q) => (reflections[q.id] || '').trim().length > 0
    )
  }, [reflectionQuestions, reflections])

  const canConfirm = useMemo(() => {
    if (!activeCheck) return false
    if (!waitGateSatisfied) return false
    if (!allReflectionsAnswered) return false
    return true
  }, [activeCheck, waitGateSatisfied, allReflectionsAnswered])

  // ---- Effects -------------------------------------------------------------
  // Load assets on mount
  useEffect(() => {
    fetchAssets()
    fetchHistory()
  }, [])

  // Countdown ticker
  useEffect(() => {
    if (!activeCheck || activeCheck.coolingOffMs === 0) {
      setRemainingMs(0)
      return
    }
    const startTs = new Date(activeCheck.createdAt).getTime()
    const tick = () => {
      const rem = calcCoolingOffRemaining(startTs, activeCheck.coolingOffMs)
      setRemainingMs(rem)
    }
    tick()
    tickerRef.current = setInterval(tick, 1000)
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current)
      tickerRef.current = null
    }
  }, [activeCheck])

  // ---- API calls -----------------------------------------------------------
  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/assets')
      if (!res.ok) throw new Error('Gagal memuat daftar aset')
      const data = await res.json()
      // Some seeds include CASH which the user shouldn't trade here; keep all
      // for transparency but sort by type then ticker.
      const sorted: Asset[] = (data.assets || [])
        .slice()
        .sort((a: Asset, b: Asset) =>
          a.type === b.type
            ? a.ticker.localeCompare(b.ticker)
            : a.type.localeCompare(b.type)
        )
      setAssets(sorted)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat daftar aset.')
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/traction/history')
      if (!res.ok) throw new Error('Gagal memuat audit trail')
      const data: HistoryResponse = await res.json()
      setHistory(data)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat audit trail.')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const handleEvaluate = useCallback(async () => {
    if (!assetId) {
      toast.error('Pilih aset terlebih dahulu.')
      return
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantity harus berupa angka positif.')
      return
    }
    setSubmitting(true)
    setActiveCheck(null)
    setReflections({})
    setOverrideAcknowledged(false)
    try {
      const res = await fetch('/api/traction/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, side, quantity: qty }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengevaluasi transaksi.')
        return
      }
      setActiveCheck(data as CheckResponse)
      toast.success('Evaluasi selesai. Tinjau hasil di bawah.')
      // Scroll to result
      setTimeout(() => {
        document
          .getElementById('traction-result')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengevaluasi transaksi.')
    } finally {
      setSubmitting(false)
    }
  }, [assetId, side, quantity])

  const doConfirm = useCallback(
    async (overrideFlag: boolean) => {
      if (!activeCheck) return
      setConfirming(true)
      try {
        const reflectionArr = reflectionQuestions.map((q) => ({
          question: q.text,
          answer: (reflections[q.id] || '').trim(),
        }))
        const res = await fetch('/api/traction/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkId: activeCheck.checkId,
            reflections: reflectionArr,
            override: overrideFlag,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'Gagal mengkonfirmasi transaksi.')
          return
        }
        toast.success(
          overrideFlag
            ? 'Transaksi dieksekusi dengan override (non-diskrisioner).'
            : 'Transaksi dikonfirmasi & dicatat.'
        )
        setActiveCheck(null)
        setReflections({})
        setOverrideAcknowledged(false)
        setOverrideDialogOpen(false)
        setQuantity('')
        await fetchHistory()
      } catch (err) {
        console.error(err)
        toast.error('Gagal mengkonfirmasi transaksi.')
      } finally {
        setConfirming(false)
      }
    },
    [activeCheck, reflectionQuestions, reflections, fetchHistory]
  )

  const handleConfirmClick = useCallback(() => {
    if (!canConfirm) return
    if (activeCheck?.riskLevel === 'RED' && !overrideAcknowledged) {
      setOverrideDialogOpen(true)
      return
    }
    doConfirm(isEarlyContinuation)
  }, [
    canConfirm,
    activeCheck,
    overrideAcknowledged,
    isEarlyContinuation,
    doConfirm,
  ])

  const handleCancel = useCallback(() => {
    setActiveCheck(null)
    setReflections({})
    setOverrideAcknowledged(false)
    setOverrideDialogOpen(false)
    toast.info('Evaluasi dibatalkan. TractionCheck tetap tercatat di audit trail.')
  }, [])

  // Ask AI FinBest about the current transaction (cross-module navigation)
  const handleAskAIFinbest = useCallback(() => {
    if (!activeCheck || !selectedAsset) return
    const ticker = selectedAsset.ticker
    const qty = Number(quantity).toLocaleString('id-ID')
    const nilai = formatIDR(activeCheck.transactionValue, true)
    const score = activeCheck.tractionScore
    const level = RISK_THEME[activeCheck.riskLevel].label
    const rules = activeCheck.rulesTriggered.length
      ? activeCheck.rulesTriggered.map((r) => r.rule).join(', ')
      : 'tidak ada aturan terpicu'
    const query = `Saya baru saja mengevaluasi niat transaksi ${side} ${qty} lembar ${ticker} senilai ${nilai} di modul Traction. Hasil: Traction Score ${score}/100 (level: ${level}), dengan aturan terpicu: ${rules}. Apa pandangan AI FinBest tentang transaksi ini dan apakah ada bias kognitif yang perlu saya waspadai?`
    setPendingAIQuery(query)
    setActiveTab('ai')
    toast.success('Mengalihkan ke AI FinBest dengan konteks transaksi…')
  }, [
    activeCheck,
    selectedAsset,
    side,
    quantity,
    setPendingAIQuery,
    setActiveTab,
  ])

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (!history || history.checks.length === 0) {
      toast.info('Belum ada data untuk diekspor.')
      return
    }
    const headers = [
      'Tanggal',
      'Aset',
      'Ticker',
      'Tipe',
      'Sektor',
      'Side',
      'Quantity',
      'Harga',
      'Nilai',
      'TractionScore',
      'RiskLevel',
      'CoolingOffMs',
      'Confirmed',
      'Overridden',
      'ConfirmedAt',
      'RulesTriggered',
      'Refleksi',
    ]
    const escape = (v: unknown): string => {
      const s = String(v ?? '')
      return `"${s.replace(/"/g, '""')}"`
    }
    const rows = history.checks.map((c) =>
      [
        formatDate(c.createdAt, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        c.asset.name,
        c.asset.ticker,
        c.asset.type,
        c.asset.sector || '',
        c.side,
        c.quantity,
        c.price,
        c.transactionValue,
        c.tractionScore,
        c.riskLevel,
        c.coolingOffMs,
        c.confirmed ? 'YA' : 'TIDAK',
        c.overridden ? 'YA' : 'TIDAK',
        c.confirmedAt
          ? formatDate(c.confirmedAt, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
        c.rulesTriggered.map((r) => `${r.rule}(-${r.penalty})`).join(' | '),
        c.reflections
          .map((r) => `Q: ${r.question} | A: ${r.answer}`)
          .join(' || '),
      ]
        .map(escape)
        .join(',')
    )
    const csv = [headers.map(escape).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finbest-traction-audit-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Audit trail diekspor ke CSV.')
  }, [history])

  // ---- Render --------------------------------------------------------------
  const stats = history?.stats
  const totalPenalty = activeCheck
    ? activeCheck.rulesTriggered.reduce((s, r) => s + r.penalty, 0)
    : 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <ShieldCheck className="size-5" />
              </span>
            </div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              Traction
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pencegahan keputusan impulsif saat membeli maupun menjual melalui evaluasi transaksi,
              cooling-off, dan refleksi terstruktur. Sistem bersifat{' '}
              <span className="font-semibold text-primary">
                non-diskrisioner
              </span>{' '}
              — keputusan tetap di tangan Anda.
            </p>
          </div>
        </div>
      </header>

      {/* KPI stats */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KpiCard
          icon={Activity}
          label="Rata-rata Score 30d"
          value={stats?.avgScore30d ?? '—'}
          tone="emerald"
          hint={`${stats?.totalChecks30d ?? 0} evaluasi`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Rasio Impulsif"
          value={stats?.impulsiveRatio ?? 0}
          suffix="%"
          tone="amber"
          hint="Lonjakan 5 hari"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Completion Rate"
          value={stats?.completionRate ?? 0}
          suffix="%"
          tone="teal"
          hint="Dikonfirmasi"
        />
        <KpiCard
          icon={Scale}
          label="Override Rate"
          value={stats?.overrideRate ?? 0}
          suffix="%"
          tone="rose"
          hint="Tetap eksekusi"
        />
      </section>

      {/* Input form */}
      <Card className="card-editorial mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <AlertTriangle className="size-5 text-warning" />
            Evaluasi Niat Transaksi
          </CardTitle>
          <CardDescription>
            Masukkan niat transaksi. Sistem akan menghitung Traction Score
            berdasarkan 7 aturan transparan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Asset selector */}
            <div className="lg:col-span-2">
              <Label htmlFor="asset-select" className="mb-1.5 block">
                Aset
              </Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger id="asset-select" className="w-full">
                  <SelectValue placeholder="Pilih aset…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Daftar Aset</SelectLabel>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex w-full min-w-0 items-center gap-2">
                          <span className="shrink-0 font-semibold">{a.ticker}</span>
                          <span className="min-w-0 truncate text-muted-foreground">
                            · {a.name}
                          </span>
                          <span className="ml-auto shrink-0 font-medium tabular-nums">
                            {formatIDR(a.price, true)}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {selectedAsset ? (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="font-normal">
                    {selectedAsset.type}
                  </Badge>
                  {selectedAsset.sector ? (
                    <Badge variant="outline" className="font-normal">
                      {selectedAsset.sector}
                    </Badge>
                  ) : null}
                  <Badge
                    variant="outline"
                    className={`font-normal ${
                      selectedAsset.volatility30d > 25
                        ? 'border-destructive/40 text-destructive'
                        : ''
                    }`}
                  >
                    Vol {selectedAsset.volatility30d.toFixed(1)}%
                  </Badge>
                  {selectedAsset.price5dAgo > 0 &&
                  selectedAsset.price > selectedAsset.price5dAgo ? (
                    <Badge
                      variant="outline"
                      className={`font-normal ${
                        (selectedAsset.price -
                          selectedAsset.price5dAgo) /
                          selectedAsset.price5dAgo >
                        0.15
                          ? 'border-destructive/40 text-destructive'
                          : ''
                      }`}
                    >
                      5d{' '}
                      {formatPct(
                        ((selectedAsset.price - selectedAsset.price5dAgo) /
                          selectedAsset.price5dAgo) *
                          100
                      )}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Side */}
            <div>
              <Label className="mb-1.5 block">Arah</Label>
              <ToggleGroup
                type="single"
                value={side}
                onValueChange={(v) => {
                  if (v === 'BUY' || v === 'SELL') setSide(v)
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="BUY"
                  className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  BUY
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="SELL"
                  className="flex-1 data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground"
                >
                  SELL
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Quantity */}
            <div>
              <Label htmlFor="qty-input" className="mb-1.5 block">
                Quantity
              </Label>
              <Input
                id="qty-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          {/* Total value preview */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Info className="size-4 text-primary" />
              <span className="text-muted-foreground">Nilai transaksi:</span>
              <span className="font-serif text-lg font-semibold tabular-nums text-primary">
                {formatIDR(totalValue)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              @ {selectedAsset ? formatIDR(selectedAsset.price) : '—'} / unit
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 py-3">
          <p className="text-[11px] text-muted-foreground">
            Evaluasi gratis & tidak mengeksekusi transaksi apa pun.
          </p>
          <Button
            onClick={handleEvaluate}
            disabled={submitting || !assetId || !quantity}
            className="gradient-pine text-primary-foreground hover:opacity-90"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Mengevaluasi…
              </>
            ) : (
              <>
                Evaluasi Transaksi
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Result panel */}
      <AnimatePresence mode="wait">
        {activeCheck ? (
          <motion.section
            id="traction-result"
            key={activeCheck.checkId}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mb-6 space-y-4"
          >
            <Card
              className={`gap-0 overflow-hidden border-2 py-0 ${RISK_THEME[activeCheck.riskLevel].border}`}
            >
              <CardHeader
                className={`py-4 sm:py-5 ${RISK_THEME[activeCheck.riskLevel].bg}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      Hasil Evaluasi Traction
                      {levelBadge(activeCheck.riskLevel)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {side} {Number(quantity).toLocaleString('id-ID')}{' '}
                      {selectedAsset?.ticker} · Nilai{' '}
                      {formatIDR(activeCheck.transactionValue, true)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Gauge */}
                  <div className="flex flex-col items-center justify-center gap-3 lg:col-span-1">
                    <Gauge
                      score={activeCheck.tractionScore}
                      risk={activeCheck.riskLevel}
                    />
                    <div className="text-center">
                      <p
                        className={`text-sm font-semibold ${
                          RISK_THEME[activeCheck.riskLevel].text
                        }`}
                      >
                        {RISK_THEME[activeCheck.riskLevel].label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Total penalti -{totalPenalty} dari 100
                      </p>
                    </div>
                  </div>

                  {/* Triggered rules + warnings */}
                  <div className="space-y-3 lg:col-span-2">
                    {activeCheck.rulesTriggered.length === 0 ? (
                      <Alert className="border-success/30 bg-success/10">
                        <CheckCircle2 className="text-success" />
                        <AlertTitle>Tidak ada aturan terpicu</AlertTitle>
                        <AlertDescription>
                          Transaksi ini sesuai dengan profil risiko, alokasi
                          target, dan tidak menunjukkan pola impulsif.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">
                          Aturan Tercatat ({activeCheck.rulesTriggered.length})
                        </p>
                        {activeCheck.rulesTriggered.map((r, idx) => (
                          <div
                            key={`${r.rule}-${idx}`}
                            className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2.5"
                          >
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">
                                  {r.rule}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-warning/40 text-warning"
                                >
                                  -{r.penalty}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {r.detail}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeCheck.warnings.length > 0 ? (
                      <Alert className="border-warning/30 bg-warning/5">
                        <Info className="text-warning" />
                        <AlertTitle>Catatan Edukatif</AlertTitle>
                        <AlertDescription>
                          <ul className="ml-4 list-disc space-y-0.5 text-xs">
                            {activeCheck.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {activeCheck.scoreBreakdown ? (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              AI-assisted Behavioral Risk Score
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {activeCheck.scoreBreakdown.dataScope}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-primary/30 text-primary"
                          >
                            Confidence{' '}
                            {Math.round(
                              activeCheck.scoreBreakdown.confidence * 100
                            )}
                            %
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                          <div className="rounded-md border bg-background px-3 py-2">
                            <span className="font-medium">Policy:</span>{' '}
                            {activeCheck.scoreBreakdown.policy}
                          </div>
                          <div className="rounded-md border bg-background px-3 py-2">
                            <span className="font-medium">Explainability:</span>{' '}
                            {activeCheck.scoreBreakdown.explainability}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* New allocation preview */}
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        PROYEKSI ALOKASI PASCA-TRANSAKSI
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Object.entries(activeCheck.newAllocation).map(
                          ([type, pct]) => (
                            <div
                              key={type}
                              className="rounded-md border bg-background px-2.5 py-1.5"
                            >
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {type}
                              </p>
                              <p className="text-sm font-semibold tabular-nums">
                                {pct.toFixed(1)}%
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cooling-off timer */}
            {activeCheck.coolingOffMs > 0 ? (
              <Card
                className={`border-2 ${
                  coolingOffActive
                    ? RISK_THEME[activeCheck.riskLevel].border
                    : 'border-success/30'
                }`}
              >
                <CardContent className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex size-11 items-center justify-center rounded-full ${
                        coolingOffActive
                          ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
                          : 'bg-success/15 text-success'
                      }`}
                    >
                      <Clock
                        className={`size-5 ${
                          coolingOffActive ? 'animate-pulse' : ''
                        }`}
                      />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {coolingOffActive
                          ? 'Jeda Refleksi Adaptif'
                          : 'Cooling-off Selesai'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {coolingOffActive
                          ? skipUnlocked
                            ? 'Opsi lanjut dini sudah tersedia setelah reason codes dibaca. Jika dipakai, keputusan dicatat sebagai override sadar risiko.'
                            : `Opsi lanjut dini muncul dalam ${formatCountdown(
                                skipUnlockRemainingMs
                              )}. Refleksi dapat diisi sambil menunggu.`
                          : 'Jeda penuh selesai. Anda dapat melanjutkan setelah refleksi terisi.'}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p
                      className={`font-serif text-4xl font-semibold tabular-nums ${
                        coolingOffActive
                          ? RISK_THEME[activeCheck.riskLevel].text
                          : 'text-success'
                      }`}
                    >
                      {formatCountdown(remainingMs)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDurationShort(activeCheck.coolingOffMs)} total ·
                      skip setelah{' '}
                      {formatDurationShort(activeCheck.skipAvailableAfterMs)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Reflection questions */}
            {reflectionQuestions.length > 0 ? (
              <Card
                className={`border-2 ${
                  waitGateSatisfied
                    ? RISK_THEME[activeCheck.riskLevel].border
                    : 'border-muted'
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif text-lg">
                    <Brain className="size-5 text-warning" />
                    Checklist Refleksi Cepat
                    <Badge variant="outline" className="ml-1">
                      {reflectionQuestions.length} item wajib
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Pilih Ya/Tidak. Checklist ini singkat agar audit keputusan
                    tetap tercatat tanpa menahan Anda terlalu lama saat harga
                    pasar bergerak.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reflectionQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <Label className="flex items-start gap-2 text-sm font-medium">
                          <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[11px] font-bold text-warning">
                            {idx + 1}
                          </span>
                          <span>{q.text}</span>
                        </Label>
                        <p className="mt-1 pl-7 text-xs leading-relaxed text-muted-foreground">
                          {q.helper}
                        </p>
                      </div>
                      <ToggleGroup
                        type="single"
                        value={reflections[q.id] || ''}
                        onValueChange={(value) => {
                          setReflections((prev) => ({
                            ...prev,
                            [q.id]: value,
                          }))
                        }}
                        className="grid grid-cols-2 gap-2 sm:w-40"
                      >
                        <ToggleGroupItem
                          value="Ya"
                          aria-label={`${q.text} Ya`}
                          className="h-10 rounded-md border data-[state=on]:border-success data-[state=on]:bg-success/15 data-[state=on]:text-success"
                        >
                          Ya
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="Tidak"
                          aria-label={`${q.text} Tidak`}
                          className="h-10 rounded-md border data-[state=on]:border-destructive data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
                        >
                          Tidak
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/* Non-discretionary notice */}
            {activeCheck.coolingOffMs > 0 ? (
              <Alert className="border-success/30 bg-success/5">
                <ShieldCheck className="text-success" />
                <AlertTitle>Prinsip Non-Diskrisioner</AlertTitle>
                <AlertDescription>
                  FinBest tidak mengeksekusi order, tidak memegang dana, dan
                  tidak menggantikan broker atau penasihat berizin. Pada MVP web
                  ini, tombol konfirmasi hanya mencatat decision journal dan
                  audit trail. Eksekusi nyata tetap berada di tangan pengguna
                  atau platform mitra berizin pada fase integrasi.
                </AlertDescription>
              </Alert>
            ) : null}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={confirming}
                className="text-muted-foreground"
              >
                <XCircle className="size-4" />
                Batalkan
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {activeCheck.riskLevel === 'RED' &&
                !overrideAcknowledged ? (
                  <AlertDialog
                    open={overrideDialogOpen}
                    onOpenChange={setOverrideDialogOpen}
                  >
                    <Button
                      onClick={() => setOverrideDialogOpen(true)}
                      disabled={!canConfirm || confirming}
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <ShieldCheck className="size-4" />
                      Saya Memahami Risiko & Tetap Eksekusi
                    </Button>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Konfirmasi Override (Non-Diskrisioner)
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Traction Score Anda berada di zona{' '}
                          <strong className="text-destructive">
                            Risiko Tinggi
                          </strong>
                          . Anda telah membaca reason codes dan mengisi
                          refleksi minimum.
                          Dengan menekan &quot;Lanjutkan Eksekusi&quot;, Anda
                          memahami risiko dan tetap ingin mengeksekusi transaksi
                          ini. Pada MVP web, tindakan ini hanya dicatat sebagai
                          decision journal dan audit trail. FinBest AI bersifat
                          non-diskrisioner.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={confirming}>
                          Batal
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={confirming}
                          onClick={(e) => {
                            e.preventDefault()
                            setOverrideAcknowledged(true)
                            setOverrideDialogOpen(false)
                            doConfirm(true)
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {confirming ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Memproses…
                            </>
                          ) : (
                            'Lanjutkan Eksekusi'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}

                {activeCheck.riskLevel === 'RED' &&
                !overrideAcknowledged ? null : (
                  <Button
                    onClick={handleConfirmClick}
                    disabled={!canConfirm || confirming}
                    className="gradient-pine text-primary-foreground hover:opacity-90"
                  >
                    {confirming ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Memproses…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" />
                        {!waitGateSatisfied
                          ? 'Menunggu Jeda Minimum'
                          : isEarlyContinuation
                            ? 'Lanjut Dini & Catat Override'
                            : activeCheck.coolingOffMs > 0
                              ? 'Konfirmasi setelah Jeda'
                              : 'Konfirmasi & Catat Transaksi'}
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleAskAIFinbest}
                  disabled={confirming}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Brain className="size-4" />
                  Tanya AI FinBest tentang transaksi ini
                </Button>
              </div>
            </div>

            {!canConfirm && activeCheck.coolingOffMs > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                {!waitGateSatisfied
                  ? `Opsi lanjut dini aktif dalam ${formatCountdown(
                      skipUnlockRemainingMs
                    )}; timer penuh tersisa ${formatCountdown(remainingMs)}.`
                  : !allReflectionsAnswered
                    ? 'Jawab semua pertanyaan refleksi untuk mengaktifkan tombol lanjut.'
                    : ''}
              </p>
            ) : null}
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Audit trail */}
      <Card className="card-editorial">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <History className="size-5 text-primary" />
              Audit Trail Traction
            </CardTitle>
            <CardDescription>
              Seluruh evaluasi tervalidasi & transaksi tercatat untuk audit.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!history || history.checks.length === 0}
          >
            <Download className="size-4" />
            Ekspor CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Memuat…
            </div>
          ) : !history || history.checks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <RotateCcw className="size-6 text-muted-foreground/60" />
              Belum ada evaluasi. Mulai dengan form di atas.
            </div>
          ) : (
            <div className="h-[28rem] max-h-[calc(100dvh-18rem)] min-h-72 overflow-auto scrollbar-custom">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="whitespace-nowrap">Waktu</TableHead>
                    <TableHead className="whitespace-nowrap">Aset</TableHead>
                    <TableHead className="whitespace-nowrap">Side</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Nilai</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Score</TableHead>
                    <TableHead className="whitespace-nowrap">Level</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.checks.map((c) => {
                    const isOpen = expandedAudit === c.id
                    return (
                      <AuditRow
                        key={c.id}
                        check={c}
                        isOpen={isOpen}
                        onToggle={() =>
                          setExpandedAudit(isOpen ? null : c.id)
                        }
                      />
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <footer className="mt-6 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Disclaimer</p>
        <p className="mt-1 leading-relaxed">{DISCLAIMER}</p>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit row (expandable)
// ---------------------------------------------------------------------------
function AuditRow({
  check,
  isOpen,
  onToggle,
}: {
  check: AuditCheck
  isOpen: boolean
  onToggle: () => void
}) {
  const theme = RISK_THEME[check.riskLevel]
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <TableCell className="p-2 text-center">
          <ChevronRight
            className={`size-4 text-muted-foreground transition-transform ${
              isOpen ? 'rotate-90' : ''
            }`}
          />
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {formatRelativeTime(check.createdAt)}
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-semibold">{check.asset.ticker}</span>
            <span className="text-[11px] text-muted-foreground">
              {check.asset.name}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={
              check.side === 'BUY'
                ? 'border-success/40 text-success'
                : 'border-destructive/40 text-destructive'
            }
          >
            {check.side}
          </Badge>
        </TableCell>
        <TableCell className="text-right text-xs tabular-nums">
          {formatIDR(check.transactionValue, true)}
        </TableCell>
        <TableCell className="text-center">
          <span className={`font-bold tabular-nums ${theme.text}`}>
            {check.tractionScore}
          </span>
        </TableCell>
        <TableCell>{levelBadge(check.riskLevel)}</TableCell>
        <TableCell>
          {check.confirmed ? (
            <Badge
              variant="outline"
              className={
                check.overridden
                  ? 'border-destructive/40 text-destructive'
                  : 'border-success/40 text-success'
              }
            >
              {check.overridden ? 'Override' : 'Dikonfirmasi'}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-muted-foreground/30 text-muted-foreground"
            >
              Pending
            </Badge>
          )}
        </TableCell>
      </TableRow>
      {isOpen ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={8} className="p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detail Transaksi
                </p>
                <dl className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Quantity</dt>
                    <dd className="tabular-nums">
                      {check.quantity.toLocaleString('id-ID')}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Harga</dt>
                    <dd className="tabular-nums">
                      {formatIDR(check.price)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cooling-off</dt>
                    <dd>
                      {check.coolingOffMs > 0
                        ? formatDurationShort(check.coolingOffMs)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tipe</dt>
                    <dd>{check.asset.type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Sektor</dt>
                    <dd>{check.asset.sector || '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Dibuat</dt>
                    <dd>{formatDate(check.createdAt, { hour: '2-digit', minute: '2-digit' })}</dd>
                  </div>
                  {check.confirmedAt ? (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Dikonfirmasi</dt>
                      <dd>
                        {formatDate(check.confirmedAt, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Aturan Tercatat
                </p>
                {check.rulesTriggered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Tidak ada aturan terpicu.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {check.rulesTriggered.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs"
                      >
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                        <span>
                          <span className="font-medium">{r.rule}</span>{' '}
                          <span className="text-muted-foreground">
                            — {r.detail}
                          </span>{' '}
                          <Badge
                            variant="outline"
                            className="ml-1 border-warning/40 px-1 py-0 text-[10px] text-warning"
                          >
                            -{r.penalty}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {check.reflections.length > 0 ? (
                  <>
                    <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Refleksi
                    </p>
                    <Accordion type="single" collapsible>
                      <AccordionItem
                        value="reflections"
                        className="border-b-0"
                      >
                        <AccordionTrigger className="py-1.5 text-xs">
                          Lihat {check.reflections.length} jawaban refleksi
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2">
                            {check.reflections.map((r, i) => (
                              <li key={i} className="text-xs">
                                <p className="font-medium">
                                  Q{i + 1}. {r.question}
                                </p>
                                <p className="mt-0.5 text-muted-foreground">
                                  A: {r.answer}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </>
                ) : null}
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}
