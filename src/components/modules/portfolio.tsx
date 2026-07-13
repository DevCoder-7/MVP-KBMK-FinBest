'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PieChart,
  Layers,
  History,
  Download,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart as RechartsPie,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

import { useAppStore } from '@/lib/store'
import { formatDate, formatIDR, formatNumber, formatPct } from '@/lib/utils-finance'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ====================== Types ======================
interface Position {
  id: string
  ticker: string
  name: string
  type: string
  sector: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  costBasis: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  realizedPnl: number
  weight: number
  dayChange: number
  fiveDayChange: number
  volatility30d: number
}

interface SectorBreakdown {
  sector: string
  percentage: number
  value: number
  positionCount: number
  overLimit: boolean
}

interface AllocationComparison {
  type: string
  label: string
  actual: number
  target: number
}

interface Transaction {
  id: string
  ticker: string
  name: string
  side: string
  quantity: number
  price: number
  total: number
  executedAt: string
}

interface PortfolioData {
  user: { id: string; name: string; riskProfile: string }
  summary: {
    nav: number
    totalCost: number
    totalUnrealizedPnl: number
    totalUnrealizedPnlPct: number
    totalRealizedPnl: number
    positionCount: number
    sectorCount: number
  }
  positions: Position[]
  sectorBreakdown: SectorBreakdown[]
  allocationComparison: AllocationComparison[]
  targetAllocation: { saham: number; obligasi: number; reksadana: number; kas: number; emas: number } | null
  transactions: Transaction[]
  transactionSummary: {
    total: number
    buys: number
    sells: number
    byMonth: { month: string; buys: number; sells: number; value: number }[]
  }
  marketData?: {
    provider: string
    requested: number
    resolved: number
    updatedAt: string
    delayMinutes?: number
    note?: string
  }
}

// Prototype Figma palette
const ASSET_TYPE_COLORS: Record<string, string> = {
  SAHAM: '#00033d',
  OBLIGASI: '#433eab',
  REKSADANA: '#F59E0B',
  EMAS: '#22C55E',
  KAS: '#9AA9FF',
}

const ASSET_TYPE_FOREGROUNDS: Record<string, string> = {
  SAHAM: '#FFFFFF',
  OBLIGASI: '#FFFFFF',
  REKSADANA: '#00033d',
  EMAS: '#00033d',
  KAS: '#00033d',
}

const ASSET_TYPE_LABEL: Record<string, string> = {
  SAHAM: 'Saham',
  OBLIGASI: 'Obligasi',
  REKSADANA: 'Reksa Dana',
  EMAS: 'Emas',
  KAS: 'Kas',
}

const SECTOR_COLORS = [
  '#00033d',
  '#433eab',
  '#6D83F2',
  '#F59E0B',
  '#22C55E',
  '#EF4444',
  '#9AA9FF',
  '#6B7280',
]

export default function PortfolioModule() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'marketValue' | 'unrealizedPnlPct' | 'weight' | 'ticker'>('marketValue')
  const [filterType, setFilterType] = useState<string>('all')
  const { setActiveTab } = useAppStore()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portfolio')
      if (!res.ok) throw new Error('Gagal memuat portofolio')
      const json = await res.json()
      setData(json)
    } catch (e) {
      toast.error('Gagal memuat data portofolio')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const sortedPositions = (data?.positions || [])
    .filter((p) => filterType === 'all' || p.type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'marketValue':
          return b.marketValue - a.marketValue
        case 'unrealizedPnlPct':
          return b.unrealizedPnlPct - a.unrealizedPnlPct
        case 'weight':
          return b.weight - a.weight
        case 'ticker':
          return a.ticker.localeCompare(b.ticker)
        default:
          return 0
      }
    })

  const handleExport = () => {
    if (!data) return
    const csv = [
      ['Ticker', 'Nama', 'Tipe', 'Sektor', 'Quantity', 'Avg Cost', 'Harga Sekarang', 'Market Value', 'Unrealized PnL', 'Unrealized PnL %', 'Bobot %'],
      ...data.positions.map((p) => [
        p.ticker,
        p.name,
        p.type,
        p.sector,
        p.quantity,
        p.avgCost,
        p.currentPrice,
        p.marketValue.toFixed(2),
        p.unrealizedPnl.toFixed(2),
        p.unrealizedPnlPct.toFixed(2),
        p.weight.toFixed(2),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portofolio-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Portofolio diekspor ke CSV')
  }

  if (loading || !data) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const { summary } = data
  const pnlPositive = summary.totalUnrealizedPnl >= 0

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
            <Wallet className="h-6 w-6 shrink-0 text-primary" />
            Portofolio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Posisi, P&L realized/unrealized, sektor, dan bobot portofolio Anda
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className={cn(
                'border-border/60',
                data.marketData?.resolved
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-warning/30 bg-warning/10 text-warning-foreground'
              )}
              title={data.marketData?.note}
            >
              <Activity className="size-3" />
              {data.marketData?.resolved
                ? `Data pasar ${data.marketData.resolved}/${data.marketData.requested}`
                : 'Market fallback'}
            </Badge>
            {data.marketData?.updatedAt ? (
              <span className="text-[11px] text-muted-foreground">
                {data.marketData.delayMinutes
                  ? `Yahoo/IDX tertunda ~${data.marketData.delayMinutes} menit · `
                  : ''}
                Update {new Date(data.marketData.updatedAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            Ekspor CSV
          </Button>
          <Button size="sm" onClick={() => setActiveTab('traction')}>
            Catat Transaksi
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-editorial">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Wallet className="h-3 w-3" /> Net Asset Value
            </CardDescription>
            <CardTitle className="font-serif text-xl font-semibold text-foreground">
              {formatIDR(summary.nav, true)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {summary.positionCount} posisi · {summary.sectorCount} sektor
            </p>
          </CardContent>
        </Card>

        <Card className="card-editorial">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              {pnlPositive ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}{' '}
              Unrealized P&L
            </CardDescription>
            <CardTitle
              className={cn(
                'font-serif text-xl font-semibold',
                pnlPositive ? 'text-success' : 'text-destructive'
              )}
            >
              {formatIDR(summary.totalUnrealizedPnl, true)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                'text-xs font-medium',
                pnlPositive ? 'text-success' : 'text-destructive'
              )}
            >
              {formatPct(summary.totalUnrealizedPnlPct)} dari cost basis
            </p>
          </CardContent>
        </Card>

        <Card className="card-editorial">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" /> Realized P&L
            </CardDescription>
            <CardTitle
              className={cn(
                'font-serif text-xl font-semibold',
                summary.totalRealizedPnl >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {formatIDR(summary.totalRealizedPnl, true)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Dari transaksi sell tercatat
            </p>
          </CardContent>
        </Card>

        <Card className="card-editorial">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <PieChart className="h-3 w-3" /> Total Cost Basis
            </CardDescription>
            <CardTitle className="font-serif text-xl font-semibold text-foreground">
              {formatIDR(summary.totalCost, true)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Modal investasi</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="positions" className="text-xs sm:text-sm">
            <Layers className="mr-1 h-4 w-4" /> Posisi
          </TabsTrigger>
          <TabsTrigger value="allocation" className="text-xs sm:text-sm">
            <PieChart className="mr-1 h-4 w-4" /> Alokasi
          </TabsTrigger>
          <TabsTrigger value="sectors" className="text-xs sm:text-sm">
            <Layers className="mr-1 h-4 w-4" /> Sektor
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            <History className="mr-1 h-4 w-4" /> Riwayat
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Positions */}
        <TabsContent value="positions" className="space-y-4">
          <Card className="card-editorial overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-serif text-lg">Daftar Posisi</CardTitle>
                  <CardDescription>
                    {sortedPositions.length} dari {data.positions.length} posisi ditampilkan
                  </CardDescription>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 min-w-[150px] flex-1 text-xs sm:flex-none">
                      <Filter className="mr-1 h-3 w-3" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Tipe</SelectItem>
                      <SelectItem value="SAHAM">Saham</SelectItem>
                      <SelectItem value="OBLIGASI">Obligasi</SelectItem>
                      <SelectItem value="REKSADANA">Reksa Dana</SelectItem>
                      <SelectItem value="EMAS">Emas</SelectItem>
                      <SelectItem value="KAS">Kas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="h-8 min-w-[150px] flex-1 text-xs sm:flex-none">
                      <ArrowUpDown className="mr-1 h-3 w-3" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marketValue">Nilai Pasar</SelectItem>
                      <SelectItem value="unrealizedPnlPct">P&L %</SelectItem>
                      <SelectItem value="weight">Bobot</SelectItem>
                      <SelectItem value="ticker">Ticker A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden h-[560px] max-h-[calc(100dvh-18rem)] min-h-80 overflow-auto scrollbar-custom md:block">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="border-y bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Aset</th>
                      <th className="px-4 py-2.5 text-right font-medium">Quantity</th>
                      <th className="px-4 py-2.5 text-right font-medium">Avg Cost</th>
                      <th className="px-4 py-2.5 text-right font-medium">Harga</th>
                      <th className="px-4 py-2.5 text-right font-medium">Nilai Pasar</th>
                      <th className="px-4 py-2.5 text-right font-medium">Bobot</th>
                      <th className="px-4 py-2.5 text-right font-medium">P&L Unrealized</th>
                      <th className="px-4 py-2.5 text-right font-medium">1D / 5D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((p, idx) => (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                              style={{
                                background: ASSET_TYPE_COLORS[p.type],
                                color: ASSET_TYPE_FOREGROUNDS[p.type] ?? '#FFFFFF',
                              }}
                            >
                              {p.ticker.slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{p.ticker}</p>
                              <p className="truncate text-xs text-muted-foreground">{p.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {formatNumber(p.quantity, p.quantity < 100 ? 2 : 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                          {formatIDR(p.avgCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {formatIDR(p.currentPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                          {formatIDR(p.marketValue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs font-medium">{p.weight.toFixed(1)}%</span>
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, p.weight * 2)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div
                            className={cn(
                              'font-mono text-xs font-semibold',
                              p.unrealizedPnl >= 0 ? 'text-success' : 'text-destructive'
                            )}
                          >
                            {p.unrealizedPnl >= 0 ? '+' : ''}
                            {formatIDR(p.unrealizedPnl, true)}
                          </div>
                          <div
                            className={cn(
                              'text-[10px]',
                              p.unrealizedPnlPct >= 0 ? 'text-success' : 'text-destructive'
                            )}
                          >
                            {formatPct(p.unrealizedPnlPct)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span
                              className={cn(
                                'flex items-center gap-0.5 text-[10px] font-medium',
                                p.dayChange >= 0 ? 'text-success' : 'text-destructive'
                              )}
                            >
                              {p.dayChange >= 0 ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3" />
                              )}
                              {Math.abs(p.dayChange).toFixed(2)}%
                            </span>
                            <span
                              className={cn(
                                'text-[10px]',
                                p.fiveDayChange >= 0 ? 'text-success' : 'text-destructive'
                              )}
                            >
                              5D: {formatPct(p.fiveDayChange)}
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="h-[520px] max-h-[calc(100dvh-18rem)] min-h-80 space-y-2 overflow-y-auto p-3 scrollbar-custom md:hidden">
                {sortedPositions.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-md text-[10px] font-bold"
                          style={{
                            background: ASSET_TYPE_COLORS[p.type],
                            color: ASSET_TYPE_FOREGROUNDS[p.type] ?? '#FFFFFF',
                          }}
                        >
                          {p.ticker.slice(0, 3)}
                        </div>
                        <div>
                          <p className="font-semibold">{p.ticker}</p>
                          <p className="text-[10px] text-muted-foreground">{p.sector}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {ASSET_TYPE_LABEL[p.type]}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Nilai Pasar</p>
                        <p className="font-semibold">{formatIDR(p.marketValue, true)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bobot</p>
                        <p className="font-semibold">{p.weight.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">P&L Unrealized</p>
                        <p
                          className={cn(
                            'font-semibold',
                            p.unrealizedPnl >= 0 ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {formatIDR(p.unrealizedPnl, true)} ({formatPct(p.unrealizedPnlPct)})
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Perubahan 1D</p>
                        <p
                          className={cn(
                            'font-semibold',
                            p.dayChange >= 0 ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {formatPct(p.dayChange)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Allocation by Type */}
        <TabsContent value="allocation" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="card-editorial">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Alokasi per Tipe Aset</CardTitle>
                <CardDescription>Distribusi portofolio berdasarkan kelas aset</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie
                        data={data.allocationComparison.filter((a) => a.actual > 0)}
                        dataKey="actual"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        label={(entry: any) => `${entry.label}: ${entry.actual.toFixed(1)}%`}
                        labelLine={false}
                      >
                        {data.allocationComparison.map((a) => (
                          <Cell key={a.type} fill={ASSET_TYPE_COLORS[a.type]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                        contentStyle={{
                          background: '#FFFFFF',
                          border: '1px solid rgba(67, 62, 171, 0.16)',
                          borderRadius: '8px',
                          color: '#00033d',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="card-editorial">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Aktual vs Target</CardTitle>
                <CardDescription>Deviasi alokasi terhadap rencana target</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.allocationComparison.map((a) => {
                  const deviation = a.actual - a.target
                  const isOver = deviation > 5
                  const isUnder = deviation < -5
                  return (
                    <div key={a.type} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{a.label}</span>
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            isOver
                              ? 'text-destructive'
                              : isUnder
                                ? 'text-warning'
                                : 'text-success'
                          )}
                        >
                          {deviation >= 0 ? '+' : ''}
                          {deviation.toFixed(1)}pp
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${a.actual}%`,
                              background: ASSET_TYPE_COLORS[a.type],
                            }}
                          />
                          <div
                            className="absolute top-0 h-full w-0.5 bg-foreground/40"
                            style={{ left: `${a.target}%` }}
                            title={`Target: ${a.target}%`}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Aktual: {a.actual.toFixed(1)}%</span>
                        <span>Target: {a.target.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
                <Separator />
                <div className="rounded-lg bg-accent/40 p-3 text-xs">
                  <p className="font-medium text-foreground">💡 Rebalancing</p>
                  <p className="mt-1 text-muted-foreground">
                    Garis vertikal menunjukkan target alokasi. Deviasi &gt;5pp disarankan
                    untuk rebalancing. Klik &ldquo;Rebalance&rdquo; di Dashboard untuk
                    menyesuaikan.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Sector Concentration */}
        <TabsContent value="sectors" className="space-y-4">
          <Card className="card-editorial">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <Layers className="h-5 w-5 text-primary" />
                Konsentrasi Sektor
              </CardTitle>
              <CardDescription>
                Batas konsentrasi sektor default: 25%. Sektor di atas batas
                ditandai merah.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.sectorBreakdown}
                    layout="vertical"
                    margin={{ left: 20, right: 40 }}
                  >
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="sector"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <RechartsTooltip
                      formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                      contentStyle={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(67, 62, 171, 0.16)',
                        borderRadius: '8px',
                        color: '#00033d',
                      }}
                    />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                      {data.sectorBreakdown.map((s, i) => (
                        <Cell
                          key={s.sector}
                          fill={s.overLimit ? '#EF4444' : SECTOR_COLORS[i % SECTOR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {data.sectorBreakdown.map((s, i) => (
                  <div
                    key={s.sector}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          background: s.overLimit
                            ? '#EF4444'
                            : SECTOR_COLORS[i % SECTOR_COLORS.length],
                        }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.sector}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.positionCount} posisi · {formatIDR(s.value, true)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold">{s.percentage.toFixed(1)}%</span>
                      {s.overLimit ? (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="mr-0.5 h-3 w-3" /> &gt;25%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-success">
                          <CheckCircle2 className="mr-0.5 h-3 w-3" /> Aman
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Transaction History */}
        <TabsContent value="history" className="space-y-4">
          <Card className="card-editorial">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <History className="h-5 w-5 text-primary" />
                Riwayat Transaksi
              </CardTitle>
              <CardDescription>
                {data.transactionSummary.total} transaksi · {data.transactionSummary.buys} beli ·{' '}
                {data.transactionSummary.sells} jual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] max-h-[calc(100dvh-18rem)] min-h-80 pr-2 scrollbar-custom">
                <div className="space-y-2">
                  {data.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            tx.side === 'BUY'
                              ? 'bg-success/15 text-success'
                              : 'bg-destructive/15 text-destructive'
                          )}
                        >
                          {tx.side === 'BUY' ? (
                            <ArrowDownRight className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {tx.ticker}{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                              · {tx.side === 'BUY' ? 'Beli' : 'Jual'}
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatNumber(tx.quantity, tx.quantity < 100 ? 2 : 0)} unit @{' '}
                            {formatIDR(tx.price)}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 pl-2 text-right">
                        <p className="text-sm font-semibold">{formatIDR(tx.total, true)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.executedAt, { day: '2-digit', month: 'short', year: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {data.transactionSummary.byMonth.length > 0 && (
            <Card className="card-editorial">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Aktivitas per Bulan</CardTitle>
                <CardDescription>Ringkasan transaksi bulanan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.transactionSummary.byMonth}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        contentStyle={{
                          background: '#FFFFFF',
                          border: '1px solid rgba(67, 62, 171, 0.16)',
                          borderRadius: '8px',
                          color: '#00033d',
                        }}
                      />
                      <Bar dataKey="buys" name="Beli" fill="#433eab" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sells" name="Jual" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
