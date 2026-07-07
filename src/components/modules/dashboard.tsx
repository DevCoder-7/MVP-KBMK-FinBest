'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  PieChart,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart as RechartsPie,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

import { useAppStore } from '@/lib/store'
import {
  formatDate,
  formatIDR,
  formatNumber,
  formatPct,
  tractionRiskLevel,
} from '@/lib/utils-finance'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ====================== Types ======================
interface User {
  id: string
  name: string
  email: string
  riskScore: number
  riskProfile: string
  horizonYears: number
  annualIncome: number
}

interface Summary {
  nav: number
  cost: number
  totalPnl: number
  totalPnlPct: number
  ytdReturn: number
  benchmarkReturn: number
  performanceGap: number
  avgTractionScore: number
  holdingCount: number
  transactionCount30d: number
  impulsiveCount30d: number
}

interface BehaviorPoint {
  date: string
  tractionScore: number
  transactionCount: number
  impulsiveCount: number
}

interface Insight {
  id: string
  type: string
  title: string
  description: string
  severity: string
  isRead: boolean
  createdAt: string
}

interface TxItem {
  id: string
  ticker: string
  name: string
  side: string
  quantity: number
  price: number
  total: number
  executedAt: string
}

interface Allocation {
  actual: Record<string, number>
  target: Record<string, number> | null
}

interface DashboardData {
  user: User
  summary: Summary
  allocation: Allocation
  sectorConcentration: Record<string, number>
  goals: Array<{
    id: string
    title: string
    targetAmount: number
    currentAmount: number
    progress: number
    horizonYears: number
    monthlyContribution: number
    priority: string
  }>
  insights: Insight[]
  recentTransactions: TxItem[]
  behaviorTrend: BehaviorPoint[]
  marketData?: {
    provider: string
    requested: number
    resolved: number
    updatedAt: string
    note?: string
  }
}

interface Position {
  id: string
  ticker: string
  name: string
  type: string
  sector: string | null
  quantity: number
  avgCost: number
  price: number
  marketValue: number
  pnl: number
  pnlPct: number
}

type Period = '30' | '90'

// ====================== Constants ======================
const ASSET_KEYS = ['SAHAM', 'OBLIGASI', 'REKSADANA', 'KAS', 'EMAS'] as const

const ASSET_LABELS: Record<string, string> = {
  SAHAM: 'Saham',
  OBLIGASI: 'Obligasi',
  REKSADANA: 'Reksa Dana',
  KAS: 'Kas',
  EMAS: 'Emas',
}

// Prototype Figma palette: navy, violet, amber, green, red
const ASSET_COLORS: Record<string, string> = {
  SAHAM: '#00033d',
  OBLIGASI: '#433eab',
  REKSADANA: '#F59E0B',
  EMAS: '#22C55E',
  KAS: '#9AA9FF',
}

const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info',
  warning: 'Peringatan',
  critical: 'Kritis',
}

// ====================== Helpers ======================
function insightIcon(type: string) {
  switch (type) {
    case 'ALLOCATION':
      return PieChart
    case 'BEHAVIOR':
      return Brain
    case 'PERFORMANCE':
      return TrendingUp
    case 'RISK':
      return AlertTriangle
    default:
      return Bell
  }
}

function insightSeverityClass(severity: string) {
  switch (severity) {
    case 'critical':
      return 'border-destructive/30 bg-destructive/10'
    case 'warning':
      return 'border-warning/30 bg-warning/10'
    default:
      return 'border-primary/30 bg-primary/10'
  }
}

function insightIconColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'text-destructive'
    case 'warning':
      return 'text-warning'
    default:
      return 'text-primary'
  }
}

function insightActionLabel(type: string): string {
  switch (type) {
    case 'ALLOCATION':
      return 'Rebalance Alokasi'
    case 'BEHAVIOR':
      return 'Lihat Traction'
    case 'PERFORMANCE':
      return 'Lihat Portofolio'
    case 'RISK':
      return 'Tinjau Profil Risiko'
    default:
      return 'Lihat Detail'
  }
}

function insightActionTab(
  type: string
): 'profil' | 'portofolio' | 'traction' | 'ai' {
  switch (type) {
    case 'ALLOCATION':
      return 'profil'
    case 'BEHAVIOR':
      return 'traction'
    case 'PERFORMANCE':
      return 'portofolio'
    case 'RISK':
      return 'profil'
    default:
      return 'profil'
  }
}

function deviationClass(dev: number): string {
  const a = Math.abs(dev)
  if (a <= 5) return 'text-primary'
  if (a <= 10) return 'text-warning'
  return 'text-destructive'
}

function deviationBadge(dev: number): string {
  const a = Math.abs(dev)
  if (a <= 5) return 'bg-primary/10 text-primary'
  if (a <= 10) return 'bg-warning/15 text-warning'
  return 'bg-destructive/10 text-destructive'
}

// ====================== Skeleton ======================
function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  )
}

// ====================== KPI Card ======================
function KPICard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  sub,
  footer,
}: {
  label: string
  value: string
  icon: React.ElementType
  accent: 'emerald' | 'amber' | 'rose' | 'teal'
  trend?: { value: string; positive: boolean }
  sub?: React.ReactNode
  footer?: React.ReactNode
}) {
  const accentMap: Record<string, string> = {
    emerald: 'bg-primary/10 text-primary',
    amber: 'bg-warning/15 text-warning',
    rose: 'bg-destructive/10 text-destructive',
    teal: 'bg-secondary text-primary',
  }

  return (
    <Card className="card-editorial relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </CardDescription>
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              accentMap[accent]
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="break-words font-serif text-2xl font-semibold leading-tight tracking-tight lg:text-[1.65rem]">
          {value}
        </div>
        {sub && (
          <div className="min-w-0 truncate text-xs text-muted-foreground">
            {sub}
          </div>
        )}
        {trend && (
          <div
            className={cn(
              'flex min-w-0 items-center gap-1 text-xs font-medium',
              trend.positive
                ? 'text-success'
                : 'text-destructive'
            )}
          >
            {trend.positive ? (
              <ArrowUpRight className="size-3.5 shrink-0" />
            ) : (
              <ArrowDownRight className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{trend.value}</span>
          </div>
        )}
        {footer && <div className="pt-1">{footer}</div>}
      </CardContent>
    </Card>
  )
}

// ====================== Custom Tooltips ======================
function TractionTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
      <div className="font-medium">{formatDate(p.date)}</div>
      <Separator className="my-1.5" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Traction Score</span>
        <span className="font-semibold text-primary">
          {p.tractionScore}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Transaksi</span>
        <span className="font-medium">{p.transactionCount}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Impulsif</span>
        <span className="font-medium">{p.impulsiveCount}</span>
      </div>
    </div>
  )
}

function AllocationTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const actual = payload.find((p: any) => p.dataKey === 'actual')?.value ?? 0
  const target = payload.find((p: any) => p.dataKey === 'target')?.value ?? 0
  const dev = actual - target
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
      <div className="font-medium">{label}</div>
      <Separator className="my-1.5" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Aktual</span>
        <span className="font-semibold">{actual.toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Target</span>
        <span className="font-medium">{target.toFixed(1)}%</span>
      </div>
      <div
        className={cn(
          'flex items-center justify-between gap-3 font-medium',
          deviationClass(dev)
        )}
      >
        <span>Deviasi</span>
        <span>
          {dev > 0 ? '+' : ''}
          {dev.toFixed(1)}pp
        </span>
      </div>
    </div>
  )
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover p-2 text-xs shadow-lg">
      <span className="font-medium">{p.name}</span>
      <span className="ml-2 font-semibold">{p.value} transaksi</span>
    </div>
  )
}

// ====================== Allocation vs Target ======================
function AllocationVsTarget({
  allocation,
  onRebalance,
}: {
  allocation: Allocation
  onRebalance: () => void
}) {
  const data = useMemo(() => {
    return ASSET_KEYS.map((k) => ({
      name: ASSET_LABELS[k],
      key: k,
      actual: allocation.actual[k] ?? 0,
      target: allocation.target?.[k] ?? 0,
      dev: (allocation.actual[k] ?? 0) - (allocation.target?.[k] ?? 0),
    }))
  }, [allocation])

  const hasTarget = !!allocation.target

  return (
    <Card className="card-editorial flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <PieChart className="size-4 text-primary" />
          Alokasi Aktual vs Target
        </CardTitle>
        <CardDescription>
          Perbandingan komposisi portofolio terhadap rencana alokasi target
          Anda
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={onRebalance}>
            <Target className="size-3.5" />
            Rebalance
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E2E8F0"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="%"
                domain={[0, 60]}
              />
              <RechartsTooltip
                content={<AllocationTooltip />}
                cursor={{ fill: '#F8FAFC' }}
              />
              <Bar
                dataKey="actual"
                name="Aktual"
                radius={[4, 4, 0, 0]}
                fill="#433eab"
              />
              {hasTarget && (
                <Bar
                  dataKey="target"
                  name="Target"
                  radius={[4, 4, 0, 0]}
                  fill="#9AA9FF"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {hasTarget ? (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Detail deviasi per kelas aset</span>
              <span className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary" />
                  ≤5pp
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-warning" />
                  5-10pp
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-destructive" />
                  &gt;10pp
                </span>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {data.map((d) => (
                <div
                  key={d.key}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: ASSET_COLORS[d.key] }}
                    />
                    <span className="truncate font-medium">{d.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground">
                      {d.actual.toFixed(1)}% / {d.target.toFixed(1)}%
                    </span>
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                        deviationBadge(d.dev)
                      )}
                    >
                      {d.dev > 0 ? '+' : ''}
                      {d.dev.toFixed(1)}pp
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
            Belum ada alokasi target. Atur target alokasi di tab Profil untuk
            melihat perbandingan.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ====================== Traction Trend ======================
function TractionTrend({
  behaviorTrend,
  avgScore,
}: {
  behaviorTrend: BehaviorPoint[]
  avgScore: number
}) {
  const [period, setPeriod] = useState<Period>('30')

  const trendData = useMemo(() => {
    if (period === '30') {
      return behaviorTrend.map((b) => ({
        ...b,
        label: formatDate(b.date, { day: 'numeric', month: 'short' }),
      }))
    }
    // 90 hari: simulasikan dengan menggandakan 30 hari terakhir 3x
    const reversed = [...behaviorTrend]
    const extended: BehaviorPoint[] = []
    for (let i = 2; i >= 0; i--) {
      for (const b of reversed) {
        const d = new Date(b.date)
        d.setDate(d.getDate() - i * 30)
        const jitter = Math.round((Math.random() - 0.5) * 6)
        extended.push({
          date: d.toISOString(),
          tractionScore: Math.max(
            20,
            Math.min(95, b.tractionScore + jitter)
          ),
          transactionCount: b.transactionCount,
          impulsiveCount: b.impulsiveCount,
        })
      }
    }
    return extended.map((b) => ({
      ...b,
      label: formatDate(b.date, { day: 'numeric', month: 'short' }),
    }))
  }, [period, behaviorTrend])

  const level = tractionRiskLevel(avgScore)

  return (
    <Card className="card-editorial flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Activity className="size-4 text-primary" />
          Tren Traction Score
        </CardTitle>
        <CardDescription>
          Disiplin transaksi 30 hari terakhir · Rata-rata{' '}
          <span className={level.color}>{avgScore}/100</span> ({level.label})
        </CardDescription>
        <CardAction>
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriod('30')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                period === '30'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              30 hari
            </button>
            <button
              type="button"
              onClick={() => setPeriod('90')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                period === '90'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              90 hari
            </button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="tractionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="#433eab"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="#433eab"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E2E8F0"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip
                content={<TractionTooltip />}
                cursor={{ stroke: '#6D83F2', strokeWidth: 1 }}
              />
              <ReferenceLine
                y={40}
                stroke="#EF4444"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: 'RED',
                  fontSize: 9,
                  fill: '#EF4444',
                  position: 'insideTopLeft',
                }}
              />
              <ReferenceLine
                y={60}
                stroke="#F59E0B"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: 'YELLOW',
                  fontSize: 9,
                  fill: '#F59E0B',
                  position: 'insideTopLeft',
                }}
              />
              <ReferenceLine
                y={80}
                stroke="#433eab"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: 'GREEN',
                  fontSize: 9,
                  fill: '#433eab',
                  position: 'insideTopLeft',
                }}
              />
              <Area
                type="monotone"
                dataKey="tractionScore"
                stroke="#433eab"
                strokeWidth={2}
                fill="url(#tractionGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#433eab' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            RED &lt;40 (Risiko Tinggi)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" />
            YELLOW 60-79 (Peringatan)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            GREEN 80+ (Aman)
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================== Insights ======================
function InsightsList({
  insights,
  onMarkRead,
  onAction,
}: {
  insights: Insight[]
  onMarkRead: (id: string) => void
  onAction: (type: string) => void
}) {
  return (
    <Card className="card-editorial flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Sparkles className="size-4 text-warning" />
          Insight Otomatis
        </CardTitle>
        <CardDescription>
          Rekomendasi AI FinBest berdasarkan analisis portofolio &amp; perilaku Anda
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {insights.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-8 text-primary" />
            <p className="text-sm font-medium">Tidak ada insight aktif</p>
            <p className="text-xs text-muted-foreground">
              Portofolio Anda sehat. Kami akan memberi tahu jika ada hal yang
              perlu diperhatikan.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.slice(0, 3).map((ins) => {
              const Icon = insightIcon(ins.type)
              return (
                <div
                  key={ins.id}
                  className={cn(
                    'group relative rounded-xl border p-3 transition-all hover:shadow-sm',
                    insightSeverityClass(ins.severity),
                    ins.isRead && 'opacity-70'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/60',
                        insightIconColor(ins.severity)
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-tight">
                          {ins.title}
                        </h4>
                        {ins.isRead && (
                          <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ins.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-current/20 text-[10px]',
                            insightIconColor(ins.severity)
                          )}
                        >
                          {SEVERITY_LABEL[ins.severity] ?? ins.severity}
                        </Badge>
                        <div className="flex flex-wrap items-center gap-1">
                          {!ins.isRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => onMarkRead(ins.id)}
                            >
                              <CheckCircle2 className="size-3" />
                              Tandai dibaca
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => onAction(ins.type)}
                          >
                            {insightActionLabel(ins.type)}
                            <ArrowUpRight className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ====================== Top Positions ======================
function TopPositions({
  positions,
  loading,
  onLihatSemua,
}: {
  positions: Position[]
  loading: boolean
  onLihatSemua: () => void
}) {
  return (
    <Card className="card-editorial flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <BarChart3 className="size-4 text-primary" />
          Top 5 Posisi
        </CardTitle>
        <CardDescription>Posisi terbesar berdasarkan nilai pasar</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost" onClick={onLihatSemua}>
            Lihat Semua
            <ArrowUpRight className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 py-6 text-center">
            <Wallet className="size-7 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Belum ada posisi portofolio
            </p>
          </div>
        ) : (
          <ScrollArea className="h-80 max-h-[calc(100dvh-20rem)] min-h-56 pr-2">
            <div className="space-y-1.5">
              {positions.slice(0, 5).map((p, idx) => {
                const isGain = p.pnl >= 0
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {p.ticker}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-border/60 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                        >
                          {ASSET_LABELS[p.type] ?? p.type}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold">
                        {formatIDR(p.marketValue, true)}
                      </div>
                      <div
                        className={cn(
                          'flex items-center justify-end gap-0.5 text-[11px] font-medium',
                          isGain
                            ? 'text-success'
                            : 'text-destructive'
                        )}
                      >
                        {isGain ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {formatPct(p.pnlPct)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// ====================== Recent Transactions ======================
function RecentTransactions({
  transactions,
  onLihatSemua,
}: {
  transactions: TxItem[]
  onLihatSemua: () => void
}) {
  return (
    <Card className="card-editorial flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Zap className="size-4 text-warning" />
          Transaksi Terbaru
        </CardTitle>
        <CardDescription>
          {transactions.length} transaksi terakhir dieksekusi
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost" onClick={onLihatSemua}>
            Lihat Semua
            <ArrowUpRight className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {transactions.length === 0 ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 py-6 text-center">
            <Activity className="size-7 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Belum ada transaksi tercatat
            </p>
          </div>
        ) : (
          <ScrollArea className="h-80 max-h-[calc(100dvh-20rem)] min-h-56 pr-2">
            <div className="space-y-1.5">
              {transactions.map((tx) => {
                const isBuy = tx.side === 'BUY'
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                        isBuy
                          ? 'bg-primary/10 text-primary'
                          : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {isBuy ? (
                        <ArrowDownRight className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {tx.ticker}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-current/20 px-1.5 py-0 text-[10px] font-semibold',
                            isBuy
                              ? 'text-primary'
                              : 'text-destructive'
                          )}
                        >
                          {isBuy ? 'BELI' : 'JUAL'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatNumber(tx.quantity)} lembar ·{' '}
                        {formatDate(tx.executedAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold">
                        {formatIDR(tx.total, true)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        @ {formatIDR(tx.price)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// ====================== Behavior Section ======================
function BehaviorSection({
  transactions,
  behaviorTrend,
  avgScore,
}: {
  transactions: TxItem[]
  behaviorTrend: BehaviorPoint[]
  avgScore: number
}) {
  // Distribusi BUY vs SELL
  const buySellData = useMemo(() => {
    const buy = transactions.filter((t) => t.side === 'BUY').length
    const sell = transactions.filter((t) => t.side === 'SELL').length
    return [
      { name: 'Beli', value: buy, color: '#433eab' },
      { name: 'Jual', value: sell, color: '#EF4444' },
    ]
  }, [transactions])

  // Distribusi transaksi mingguan (4 minggu terakhir dari behaviorTrend)
  const weeklyData = useMemo(() => {
    const weeks: { name: string; count: number; impulsive: number }[] = []
    const chunkSize = Math.ceil(behaviorTrend.length / 4) || 1
    for (let i = 0; i < 4; i++) {
      const start = i * chunkSize
      const slice = behaviorTrend.slice(start, start + chunkSize)
      const count = slice.reduce((s, b) => s + b.transactionCount, 0)
      const impulsive = slice.reduce((s, b) => s + b.impulsiveCount, 0)
      weeks.push({
        name: `Minggu ${i + 1}`,
        count,
        impulsive,
      })
    }
    return weeks
  }, [behaviorTrend])

  // Peer comparison (simulated)
  const peerAvg = 64 // simulated anonymous peer average
  const gap = avgScore - peerAvg

  return (
    <Card className="card-editorial flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Brain className="size-4 text-primary" />
          Ringkasan Perilaku
        </CardTitle>
        <CardDescription>
          Pola transaksi &amp; perbandingan disiplin investasi
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Distribusi Buy/Sell */}
          <div className="rounded-lg border border-border/60 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Distribusi Transaksi
            </p>
            <div className="flex items-center gap-3">
              <div className="size-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={buySellData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={44}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {buySellData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<DonutTooltip />} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {buySellData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </span>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Peer Comparison */}
          <div className="rounded-lg border border-border/60 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              <Users className="mr-1 inline size-3" />
              Traction vs Peer (anonim)
            </p>
            <div className="space-y-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">Anda</span>
                  <span className="font-bold text-primary">
                    {avgScore}
                  </span>
                </div>
                <Progress
                  value={avgScore}
                  className="h-2 bg-muted [&>div]:bg-primary"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">Rerata Peer</span>
                  <span className="font-bold text-muted-foreground">
                    {peerAvg}
                  </span>
                </div>
                <Progress
                  value={peerAvg}
                  className="h-2 bg-muted [&>div]:bg-chart-4"
                />
              </div>
              <div
                className={cn(
                  'rounded-md px-2 py-1 text-center text-[11px] font-medium',
                  gap >= 0
                    ? 'bg-primary/10 text-primary'
                    : 'bg-warning/15 text-warning'
                )}
              >
                {gap >= 0
                  ? `+${gap} poin di atas rata-rata peer`
                  : `${gap} poin di bawah rata-rata peer`}
              </div>
            </div>
          </div>
        </div>

        {/* Weekly bar chart */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Frekuensi Transaksi Mingguan (4 minggu terakhir)
          </p>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  cursor={{ fill: '#F8FAFC' }}
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-lg border border-border bg-popover p-2 text-xs shadow-lg">
                        <div className="font-medium">{label}</div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold">
                            {payload[0].payload.count}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Impulsif
                          </span>
                          <span className="font-semibold text-destructive">
                            {payload[0].payload.impulsive}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  fill="#F59E0B"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================== Monthly Report ======================
function MonthlyReport({ onDownload }: { onDownload: () => void }) {
  const now = new Date()
  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(now)

  return (
    <Card className="card-editorial flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <FileText className="size-4 text-primary" />
          Laporan Bulanan
        </CardTitle>
        <CardDescription>
          Ringkasan aktivitas &amp; performa portofolio
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">Periode Laporan</p>
          <p className="text-sm font-bold capitalize font-serif text-primary">
            {monthLabel}
          </p>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium">Ringkasan NAV</span> — perubahan
              nilai aset bersih bulan ini
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium">Peristiwa penting</span> — transaksi
              besar &amp; insight kritis
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium">Rekomendasi perilaku</span> —
              evaluasi disiplin Traction
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium">Performa vs benchmark</span> —
              perbandingan return IHSG
            </span>
          </div>
        </div>
        <Button
          variant="default"
          className="w-full gradient-pine text-primary-foreground hover:opacity-90"
          onClick={onDownload}
        >
          <Download className="size-4" />
          Unduh Laporan (PDF)
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">
          File laporan dibuat sebagai PDF ringkas untuk arsip &amp; audit
        </p>
      </CardContent>
    </Card>
  )
}

// ====================== Data Export ======================
function DataExport({ userId }: { userId: string | null }) {
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)

  const handleExport = async (format: 'pdf' | 'csv') => {
    setDownloading(format)
    try {
      const res = await fetch(
        `/api/dashboard/export?format=${format}&userId=${userId ?? ''}`
      )
      if (!res.ok) throw new Error('Gagal mengunduh')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finbest-export-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Ekspor ${format.toUpperCase()} berhasil`, {
        description: 'Data Anda telah diunduh sesuai hak portabilitas UU PDP.',
      })
    } catch (e) {
      toast.error('Gagal mengunduh data', {
        description: 'Silakan coba lagi beberapa saat.',
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Card className="card-editorial flex flex-col border-warning/30 bg-gradient-to-br from-warning/10 to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Shield className="size-4 text-warning" />
          Ekspor Data Saya
        </CardTitle>
        <CardDescription>
          Hak portabilitas data sesuai UU PDP No. 27/2022
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <p className="text-xs text-muted-foreground">
          Unduh seluruh data Anda — profil, tujuan, alokasi target, holdings,
          transaksi, behavior metrics, sesi chat, dan insights — dalam format
          PDF atau CSV.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="border-primary/30 bg-background hover:bg-primary/10"
            disabled={downloading !== null}
            onClick={() => handleExport('pdf')}
          >
            {downloading === 'pdf' ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Unduh PDF
          </Button>
          <Button
            variant="outline"
            className="border-primary/30 bg-background hover:bg-primary/10"
            disabled={downloading !== null}
            onClick={() => handleExport('csv')}
          >
            {downloading === 'csv' ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Unduh CSV
          </Button>
        </div>
        <Separator />
        <div className="space-y-1 text-[10px] text-muted-foreground">
          <p className="flex items-start gap-1.5">
            <Shield className="mt-0.5 size-3 shrink-0 text-primary" />
            <span>
              Data diproses secara lokal dan tidak dibagikan ke pihak ketiga.
            </span>
          </p>
          <p className="flex items-start gap-1.5">
            <Eye className="mt-0.5 size-3 shrink-0 text-primary" />
            <span>
              Anda juga berhak menghapus akun &amp; seluruh data terkait kapan
              saja.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================== Main Module ======================
export default function DashboardModule() {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const [userId, setUserId] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [positionsLoading, setPositionsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat data')
      const json: DashboardData = await res.json()
      setData(json)
      setUserId(json.user.id)
      setLoading(false)
    } catch (e: any) {
      setError(e?.message ?? 'Terjadi kesalahan')
      setLoading(false)
    }
  }, [])

  const fetchPositions = useCallback(async (uid: string) => {
    setPositionsLoading(true)
    try {
      const res = await fetch(`/api/dashboard/positions?userId=${uid}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Gagal memuat posisi')
      const json = await res.json()
      setPositions(json.positions ?? [])
    } catch {
      setPositions([])
    } finally {
      setPositionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (userId) fetchPositions(userId)
  }, [userId, fetchPositions])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    if (userId) await fetchPositions(userId)
    setRefreshing(false)
    toast.success('Data diperbarui')
  }

  const handleMarkInsightRead = async (id: string) => {
    // Optimistic update
    setData((prev) =>
      prev
        ? {
            ...prev,
            insights: prev.insights.map((i) =>
              i.id === id ? { ...i, isRead: true } : i
            ),
          }
        : prev
    )
    try {
      await fetch('/api/dashboard/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id, action: 'read' }),
      })
      toast.success('Insight ditandai dibaca')
    } catch {
      toast.error('Gagal memperbarui insight')
      // Rollback
      setData((prev) =>
        prev
          ? {
              ...prev,
              insights: prev.insights.map((i) =>
                i.id === id ? { ...i, isRead: false } : i
              ),
            }
          : prev
      )
    }
  }

  const handleInsightAction = (type: string) => {
    const tab = insightActionTab(type)
    setActiveTab(tab)
    toast.info(`Mengalihkan ke tab ${tab}`)
  }

  const handleDownloadReport = async () => {
    try {
      const month = new Date().toISOString().slice(0, 7)
      const res = await fetch(
        `/api/dashboard/report?month=${month}&userId=${userId ?? ''}`
      )
      if (!res.ok) throw new Error('Gagal membuat laporan')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finbest-laporan-${month}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Laporan bulanan diunduh', {
        description:
          'File PDF berisi ringkasan NAV, peristiwa penting, dan rekomendasi.',
      })
    } catch {
      toast.error('Gagal membuat laporan')
    }
  }

  if (loading) return <DashboardSkeleton />

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
        <AlertTriangle className="size-10 text-warning" />
        <div className="text-center">
          <p className="font-serif text-sm font-semibold">Gagal memuat dashboard</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="size-4" />
          Coba lagi
        </Button>
      </div>
    )
  }

  const { user, summary, allocation, insights, recentTransactions, behaviorTrend, marketData } =
    data

  const tractionLevel = tractionRiskLevel(summary.avgTractionScore)
  const isPnlPositive = summary.totalPnl >= 0
  const isPerfGapPositive = summary.performanceGap >= 0
  const impulsiveRatio =
    summary.transactionCount30d > 0
      ? (summary.impulsiveCount30d / summary.transactionCount30d) * 100
      : 0

  // Compute traction trend (last 7 vs prev 7 days) — guard against short series
  const last7 = behaviorTrend.slice(-7)
  const prev7 = behaviorTrend.slice(-14, -7)
  const trendLast7 =
    last7.length > 0
      ? last7.reduce((s, b) => s + b.tractionScore, 0) / last7.length
      : 0
  const trendPrev7 =
    prev7.length > 0
      ? prev7.reduce((s, b) => s + b.tractionScore, 0) / prev7.length
      : null
  const tractionTrendDelta =
    trendPrev7 !== null ? Math.round(trendLast7 - trendPrev7) : 0
  const showTractionTrend = prev7.length > 0

  return (
    <div className="space-y-4 p-4 pb-8 lg:space-y-6 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-xl font-semibold tracking-tight lg:text-2xl">
            Selamat datang,{' '}
            <span className="text-primary">
              {user.name}
            </span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary"
            >
              <Shield className="size-3" />
              Profil Risiko: {user.riskProfile}
            </Badge>
            <Badge variant="outline" className="border-border/60">
              <Target className="size-3" />
              Horizon {user.horizonYears} tahun
            </Badge>
            <Badge variant="outline" className="border-border/60">
              <Wallet className="size-3" />
              {summary.holdingCount} posisi aktif
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'border-border/60',
                marketData?.resolved
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-warning/30 bg-warning/10 text-warning-foreground'
              )}
              title={marketData?.note}
            >
              <Activity className="size-3" />
              {marketData?.resolved
                ? `Live market ${marketData.resolved}/${marketData.requested}`
                : 'Market fallback'}
            </Badge>
            {marketData?.updatedAt ? (
              <span className="text-[11px] text-muted-foreground">
                Update {new Date(marketData.updatedAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KPICard
          label="NAV (Net Asset Value)"
          value={formatIDR(summary.nav, true)}
          icon={Wallet}
          accent="emerald"
          trend={{
            value: `${formatIDR(summary.totalPnl, true)} (${formatPct(summary.totalPnlPct)})`,
            positive: isPnlPositive,
          }}
          sub={`Cost basis: ${formatIDR(summary.cost, true)}`}
        />
        <KPICard
          label="Return YTD"
          value={formatPct(summary.ytdReturn)}
          icon={isPerfGapPositive ? TrendingUp : TrendingDown}
          accent={isPerfGapPositive ? 'emerald' : 'rose'}
          sub={
            <span>
              IHSG: <span className="font-medium">{formatPct(summary.benchmarkReturn)}</span>
            </span>
          }
          trend={{
            value: `${isPerfGapPositive ? '+' : ''}${summary.performanceGap.toFixed(2)}pp vs IHSG`,
            positive: isPerfGapPositive,
          }}
        />
        <KPICard
          label="Traction Score (30 hari)"
          value={`${summary.avgTractionScore}`}
          icon={Activity}
          accent={
            summary.avgTractionScore >= 80
              ? 'emerald'
              : summary.avgTractionScore >= 60
                ? 'amber'
                : 'rose'
          }
          sub={
            <Badge
              variant="outline"
              className={cn(
                'border-current/20 px-1.5 py-0 text-[10px]',
                tractionLevel.color
              )}
            >
              {tractionLevel.level} · {tractionLevel.label}
            </Badge>
          }
          trend={
            showTractionTrend && tractionTrendDelta !== 0
              ? {
                  value: `${tractionTrendDelta > 0 ? '+' : ''}${tractionTrendDelta} poin vs minggu lalu`,
                  positive: tractionTrendDelta > 0,
                }
              : undefined
          }
        />
        <KPICard
          label="Perilaku (30 hari)"
          value={`${summary.transactionCount30d}`}
          icon={Brain}
          accent={impulsiveRatio > 20 ? 'rose' : 'teal'}
          sub={`${summary.impulsiveCount30d} transaksi impulsif`}
          trend={{
            value: `${impulsiveRatio.toFixed(0)}% rasio impulsif`,
            positive: impulsiveRatio <= 20,
          }}
        />
      </div>

      {/* Charts row: Allocation + Traction Trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <AllocationVsTarget
          allocation={allocation}
          onRebalance={() => {
            setActiveTab('profil')
            toast.info('Mengalihkan ke tab Profil untuk rebalancing')
          }}
        />
        <TractionTrend
          behaviorTrend={behaviorTrend}
          avgScore={summary.avgTractionScore}
        />
      </div>

      {/* Insights + Top Positions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <InsightsList
          insights={insights}
          onMarkRead={handleMarkInsightRead}
          onAction={handleInsightAction}
        />
        <TopPositions
          positions={positions}
          loading={positionsLoading}
          onLihatSemua={() => {
            setActiveTab('portofolio')
            toast.info('Mengalihkan ke tab Portofolio')
          }}
        />
      </div>

      {/* Recent Transactions + Behavior */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <RecentTransactions
          transactions={recentTransactions}
          onLihatSemua={() => {
            setActiveTab('portofolio')
            toast.info('Mengalihkan ke tab Portofolio')
          }}
        />
        <BehaviorSection
          transactions={recentTransactions}
          behaviorTrend={behaviorTrend}
          avgScore={summary.avgTractionScore}
        />
      </div>

      {/* Monthly Report + Data Export */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <MonthlyReport onDownload={handleDownloadReport} />
        <DataExport userId={userId} />
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
        <strong className="font-medium">Disclaimer:</strong> Konten dashboard
        bersifat edukatif dan informasional, bukan rekomendasi transaksi atau
        nasihat keuangan berizin. Keputusan dan eksekusi investasi sepenuhnya
        menjadi tanggung jawab Anda. FinBest AI bersifat non-diskrisioner.
      </div>
    </div>
  )
}
