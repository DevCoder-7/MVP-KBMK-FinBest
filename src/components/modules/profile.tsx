'use client'

/**
 * FinBest AI - Modul 1: Profil & Rencana Investasi
 * Tabs: Profil Risiko, Tujuan Keuangan, Alokasi Target, Import Portofolio
 *
 * FR-1.1 Risk questionnaire (10 OJK questions → score → profile classification)
 * FR-1.2 Financial goals CRUD with progress visualization
 * FR-1.3 Target allocation sliders with 100% validation
 * FR-1.4 Portfolio import simulation (broker read-only, CSV upload, sample load)
 * FR-1.5 Annual reassessment reminder
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  UserRound,
  Target,
  PieChart,
  Upload,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Info,
  FileUp,
  Landmark,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Wallet,
  Coins,
  Banknote,
  Gem,
  LineChart,
  Loader2,
  Crown,
  Check,
  Zap,
  ArrowRight,
  CreditCard,
  Brain,
  MessageSquare,
  FileText,
  Clock,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  formatIDR,
  formatPct,
  formatDate,
  formatNumber,
  classifyRisk,
  DISCLAIMER,
} from '@/lib/utils-finance'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { AppLogoutButton } from '@/components/logout-button'

// ============================================================
// Types
// ============================================================

interface ProfileUser {
  id: string
  name: string
  email: string
  riskScore: number
  riskProfile: string
  horizonYears: number
  annualIncome: number
}

interface Allocation {
  saham: number
  obligasi: number
  reksadana: number
  kas: number
  emas: number
}

interface Goal {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  horizonYears: number
  monthlyContribution: number
  priority: 'Rendah' | 'Sedang' | 'Tinggi'
  progress: number
  createdAt: string
  updatedAt: string
}

interface ProfileData {
  user: ProfileUser
  targetAllocation: Allocation | null
  goals: Goal[]
  lastAssessmentDate: string
}

type SubTab = 'risiko' | 'tujuan' | 'alokasi' | 'import'

interface QuestionOption {
  label: string
  score: number
}

interface RiskQuestion {
  id: number
  category: string
  question: string
  options: QuestionOption[]
}

// ============================================================
// Constants
// ============================================================

/**
 * OJK-style 10-question risk questionnaire (Wajib Paham).
 * Each option scores 0-4. Total max = 40 → scaled to 0-100.
 */
const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 1,
    category: 'Demografi',
    question: 'Berapa usia Anda saat ini?',
    options: [
      { label: 'Kurang dari 25 tahun', score: 4 },
      { label: '25 - 35 tahun', score: 3 },
      { label: '36 - 45 tahun', score: 2 },
      { label: '46 - 55 tahun', score: 1 },
      { label: 'Lebih dari 55 tahun', score: 0 },
    ],
  },
  {
    id: 2,
    category: 'Horizon',
    question: 'Berapa lama horizon investasi yang Anda rencanakan sebelum dana dibutuhkan?',
    options: [
      { label: 'Kurang dari 1 tahun', score: 0 },
      { label: '1 - 3 tahun', score: 1 },
      { label: '3 - 5 tahun', score: 2 },
      { label: '5 - 10 tahun', score: 3 },
      { label: 'Lebih dari 10 tahun', score: 4 },
    ],
  },
  {
    id: 3,
    category: 'Pendapatan',
    question: 'Bagaimana kisaran pendapatan tahunan Anda?',
    options: [
      { label: 'Di bawah Rp 50 juta', score: 1 },
      { label: 'Rp 50 juta - Rp 100 juta', score: 2 },
      { label: 'Rp 100 juta - Rp 300 juta', score: 3 },
      { label: 'Rp 300 juta - Rp 500 juta', score: 4 },
      { label: 'Di atas Rp 500 juta', score: 4 },
    ],
  },
  {
    id: 4,
    category: 'Pengetahuan',
    question: 'Bagaimana tingkat pengetahuan Anda tentang investasi pasar modal?',
    options: [
      { label: 'Pemula - baru mengenal istilah investasi', score: 0 },
      { label: 'Dasar - pernah membaca tapi belum praktik', score: 1 },
      { label: 'Menengah - memahami produk dasar & risiko', score: 2 },
      { label: 'Lanjutan - aktif investasi & paham analisis', score: 3 },
      { label: 'Profesional - latar belakang keuangan formal', score: 4 },
    ],
  },
  {
    id: 5,
    category: 'Pengalaman',
    question: 'Berapa lama pengalaman investasi Anda di instrumen pasar modal?',
    options: [
      { label: 'Belum pernah', score: 0 },
      { label: 'Kurang dari 1 tahun', score: 1 },
      { label: '1 - 3 tahun', score: 2 },
      { label: '3 - 5 tahun', score: 3 },
      { label: 'Lebih dari 5 tahun', score: 4 },
    ],
  },
  {
    id: 6,
    category: 'Reaksi Kerugian',
    question: 'Jika portofolio Anda turun 20% dalam satu bulan, apa yang akan Anda lakukan?',
    options: [
      { label: 'Menjual seluruh posisi untuk mencegah kerugian lebih besar', score: 0 },
      { label: 'Menjual sebagian dan pindah ke instrumen yang lebih aman', score: 1 },
      { label: 'Menahan posisi tanpa perubahan', score: 2 },
      { label: 'Membeli lagi di harga lebih rendah (averaging)', score: 3 },
      { label: 'Membeli dalam jumlah besar karena harga murah', score: 4 },
    ],
  },
  {
    id: 7,
    category: 'Sumber Dana',
    question: 'Apa sumber dana utama yang Anda gunakan untuk investasi?',
    options: [
      { label: 'Pinjaman / utang', score: 0 },
      { label: 'Bonus tahunan / insidental', score: 1 },
      { label: 'Gaji bulanan (sisa setelah kebutuhan)', score: 2 },
      { label: 'Tabungan yang sudah terkumpul', score: 3 },
      { label: 'Pendapatan pasif / hasil investasi lain', score: 4 },
    ],
  },
  {
    id: 8,
    category: 'Tujuan',
    question: 'Apa tujuan utama dari investasi Anda?',
    options: [
      { label: 'Menjaga nilai modal (proteksi inflasi)', score: 0 },
      { label: 'Pendapatan tetap & stabil (income)', score: 1 },
      { label: 'Pertumbuhan moderat dengan risiko terkendali', score: 2 },
      { label: 'Pertumbuhan agresif dalam jangka panjang', score: 3 },
      { label: 'Spekulasi / capital gain jangka pendek', score: 4 },
    ],
  },
  {
    id: 9,
    category: 'Toleransi Volatilitas',
    question: 'Sebesar apa fluktuasi nilai investasi tahunan yang dapat Anda toleransi?',
    options: [
      { label: 'Tidak tahan fluktuasi (maksimal 0-5%)', score: 0 },
      { label: 'Fluktuasi kecil (5-10%)', score: 1 },
      { label: 'Fluktuasi sedang (10-20%)', score: 2 },
      { label: 'Fluktuasi tinggi (20-30%)', score: 3 },
      { label: 'Fluktuasi sangat tinggi (di atas 30%)', score: 4 },
    ],
  },
  {
    id: 10,
    category: 'Ekspektasi Return',
    question: 'Berapa ekspektasi return tahunan investasi Anda?',
    options: [
      { label: '3 - 5% per tahun (setara deposito)', score: 0 },
      { label: '5 - 8% per tahun (di atas deposito)', score: 1 },
      { label: '8 - 12% per tahun (pertumbuhan moderat)', score: 2 },
      { label: '12 - 18% per tahun (pertumbuhan tinggi)', score: 3 },
      { label: 'Di atas 18% per tahun (return sangat tinggi)', score: 4 },
    ],
  },
]

/** Max possible raw score (40) → scaled to 0-100 */
const MAX_RAW_SCORE = RISK_QUESTIONS.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.score)),
  0
)

const PRIORITY_CONFIG: Record<
  Goal['priority'],
  { label: string; className: string; iconColor: string }
> = {
  Tinggi: {
    label: 'Tinggi',
    className:
      'border-destructive/30 bg-destructive/10 text-destructive',
    iconColor: 'text-destructive',
  },
  Sedang: {
    label: 'Sedang',
    className:
      'border-warning/30 bg-warning/10 text-warning',
    iconColor: 'text-warning',
  },
  Rendah: {
    label: 'Rendah',
    className:
      'border-primary/30 bg-primary/10 text-primary',
    iconColor: 'text-primary',
  },
}

const ASSET_META: Record<
  keyof Allocation,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  saham: { label: 'Saham', icon: LineChart, color: 'text-primary' },
  obligasi: { label: 'Obligasi', icon: Landmark, color: 'text-chart-2' },
  reksadana: { label: 'Reksa Dana', icon: PieChart, color: 'text-chart-4' },
  kas: { label: 'Kas & Setara', icon: Banknote, color: 'text-muted-foreground' },
  emas: { label: 'Emas', icon: Gem, color: 'text-chart-5' },
}

/** Map classifyRisk color → tailwind classes (muted editorial palette) */
const RISK_COLOR_CLASSES: Record<
  string,
  { text: string; bg: string; border: string; ring: string }
> = {
  emerald: {
    text: 'text-primary',
    bg: 'bg-primary',
    border: 'border-primary/30',
    ring: 'text-primary',
  },
  teal: {
    text: 'text-chart-4',
    bg: 'bg-chart-4',
    border: 'border-chart-4/30',
    ring: 'text-chart-4',
  },
  amber: {
    text: 'text-warning',
    bg: 'bg-warning',
    border: 'border-warning/30',
    ring: 'text-warning',
  },
  rose: {
    text: 'text-destructive',
    bg: 'bg-destructive',
    border: 'border-destructive/30',
    ring: 'text-destructive',
  },
  slate: {
    text: 'text-muted-foreground',
    bg: 'bg-muted-foreground',
    border: 'border-muted-foreground/30',
    ring: 'text-muted-foreground',
  },
}

// ============================================================
// Helpers
// ============================================================

function scaleScore(raw: number): number {
  return Math.round((raw / MAX_RAW_SCORE) * 100)
}

function useProfileData() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat profil')
      const json = (await res.json()) as ProfileData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch, setData }
}

// ============================================================
// Main component
// ============================================================

export default function ProfileModule() {
  const { data, loading, error, refetch, setData } = useProfileData()
  const [activeTab, setActiveTab] = useState<SubTab>('risiko')
  const [wizardOpen, setWizardOpen] = useState(false)
  // Incremented on each open to force-remount the wizard (resets internal state cleanly)
  const [wizardKey, setWizardKey] = useState(0)
  const openWizard = useCallback(() => {
    setWizardKey((k) => k + 1)
    setWizardOpen(true)
  }, [])

  if (loading) return <ProfileSkeleton />

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Gagal memuat data profil</AlertTitle>
          <AlertDescription>
            {error || 'Terjadi kesalahan tidak diketahui.'}
          </AlertDescription>
        </Alert>
        <Button onClick={refetch} className="mt-4" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Coba lagi
        </Button>
      </div>
    )
  }

  const risk = classifyRisk(data.user.riskScore)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      {/* Section header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-pine">
            <UserRound className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground lg:text-2xl">
              Profil & Rencana Investasi
            </h1>
            <p className="text-xs text-muted-foreground lg:text-sm">
              Kelola profil risiko, tujuan keuangan, alokasi target, dan import
              portofolio Anda
            </p>
          </div>
        </div>
      </div>

      {/* Subscription card — current tier + upgrade flow */}
      <SubscriptionCard />

      {/* Top summary: risk dial + reassessment + income card */}
      <ProfileSummary
        data={data}
        onRetakeQuestionnaire={openWizard}
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as SubTab)}
        className="w-full"
      >
        <div className="overflow-x-auto no-scrollbar">
          <TabsList className="h-auto w-full min-w-max sm:w-auto">
            <TabsTrigger value="risiko" className="gap-1.5 py-2">
              <ShieldCheck className="h-4 w-4" /> Profil Risiko
            </TabsTrigger>
            <TabsTrigger value="tujuan" className="gap-1.5 py-2">
              <Target className="h-4 w-4" /> Tujuan Keuangan
            </TabsTrigger>
            <TabsTrigger value="alokasi" className="gap-1.5 py-2">
              <PieChart className="h-4 w-4" /> Alokasi Target
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5 py-2">
              <Upload className="h-4 w-4" /> Import Portofolio
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="risiko" className="mt-4">
          <RiskProfileTab
            user={data.user}
            onStartWizard={openWizard}
            onUpdateProfile={async (patch) => {
              try {
                const res = await fetch('/api/profile', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(patch),
                })
                if (!res.ok) {
                  const j = await res.json()
                  throw new Error(j.error || 'Gagal memperbarui profil')
                }
                const json = (await res.json()) as { user: ProfileUser }
                setData((prev) =>
                  prev ? { ...prev, user: json.user } : prev
                )
                toast.success('Profil berhasil diperbarui')
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
              }
            }}
          />
        </TabsContent>

        <TabsContent value="tujuan" className="mt-4">
          <GoalsTab
            goals={data.goals}
            onChange={refetch}
          />
        </TabsContent>

        <TabsContent value="alokasi" className="mt-4">
          <AllocationTab
            allocation={data.targetAllocation}
            maxEquity={risk.maxEquity}
            riskLabel={risk.label}
            onSaved={refetch}
          />
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <ImportPortfolioTab />
        </TabsContent>
      </Tabs>

      {/* Risk questionnaire wizard */}
      <RiskQuestionnaireDialog
        key={wizardKey}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        currentScore={data.user.riskScore}
        onCompleted={async (newScore) => {
          const classification = classifyRisk(newScore)
          try {
            const res = await fetch('/api/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                riskScore: newScore,
                riskProfile: classification.label,
              }),
            })
            if (!res.ok) {
              const j = await res.json()
              throw new Error(j.error || 'Gagal menyimpan profil risiko')
            }
            const json = (await res.json()) as { user: ProfileUser }
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    user: json.user,
                    lastAssessmentDate: new Date().toISOString(),
                  }
                : prev
            )
            toast.success(
              `Profil risiko diperbarui: ${classification.label} (skor ${newScore})`
            )
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
          }
        }}
      />

      {/* Disclaimer */}
      <DisclaimerNote />

      {/* Akhiri sesi */}
      <Card className="card-editorial border-destructive/20">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0 space-y-1">
            <h3 className="font-serif text-base font-semibold text-foreground">
              Akhiri Sesi
            </h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Keluar dari aplikasi FinBest AI. Data portofolio dan riwayat tetap
              tersimpan di perangkat ini.
            </p>
          </div>
          <div className="shrink-0">
            <AppLogoutButton label="Keluar" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Subscription Card — current tier + upgrade flow
// ============================================================

interface TierPricing {
  price: number
  period: string
  label: string
  features: string[]
}

interface TierLimits {
  maxTokens: number
  maxMessagesPerDay: number
  stockAnalysisPerDay: number
  features: string[]
}

interface SubscriptionData {
  tier: 'FREE' | 'PRO'
  tierExpiresAt: string | null
  limits: TierLimits
  pricing: {
    FREE: TierPricing
    PRO: TierPricing
  }
}

/** Compact comparison rows for the pricing table */
const COMPARISON_ROWS: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  free: string
  pro: string
}[] = [
  { label: 'Model AI', icon: Brain, free: 'GLM-4.6', pro: 'Gemini 2.0 Flash' },
  {
    label: 'Analisis saham',
    icon: TrendingUp,
    free: '5 / hari',
    pro: 'Tak terbatas',
  },
  {
    label: 'Pesan AI',
    icon: MessageSquare,
    free: '20 / hari',
    pro: '100 / hari',
  },
  {
    label: 'Cooling-off',
    icon: Clock,
    free: 'Adaptif',
    pro: 'Adaptif',
  },
  { label: 'Ekspor PDF', icon: FileText, free: '—', pro: 'Tersedia' },
  { label: 'Support', icon: Sparkles, free: 'Komunitas', pro: 'Prioritas' },
]

function SubscriptionCard() {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  const fetchSub = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/subscription', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat langganan')
      const json = (await res.json()) as SubscriptionData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSub()
  }, [fetchSub])

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'PRO' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Gagal upgrade ke Pro')
      }
      const json = (await res.json()) as {
        tier: 'FREE' | 'PRO'
        tierExpiresAt: string | null
        limits: TierLimits
      }
      // Refresh full data (pricing block)
      await fetchSub()
      setData((prev) =>
        prev
          ? {
              ...prev,
              tier: json.tier,
              tierExpiresAt: json.tierExpiresAt,
              limits: json.limits,
            }
          : prev
      )
      toast.success('Selamat! Paket Pro Anda telah aktif', {
        description:
          'AI Mentor kini menggunakan Gemini 2.0 Flash. Nikmati analisis tak terbatas.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal upgrade')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <Card className="card-editorial">
        <CardContent className="space-y-3 p-4 sm:p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-40 lg:col-span-1" />
            <Skeleton className="h-40 lg:col-span-2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="card-editorial border-destructive/30">
        <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="font-serif text-sm font-semibold">
                Gagal memuat langganan
              </p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={fetchSub}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Coba lagi
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isPro = data.tier === 'PRO'
  const proPricing = data.pricing.PRO
  const freePricing = data.pricing.FREE
  const expiryDate = data.tierExpiresAt ? new Date(data.tierExpiresAt) : null
  const daysLeft = expiryDate
    ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000))
    : 0

  return (
    <Card className="card-editorial overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                isPro
                  ? 'gradient-pine text-gold'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isPro ? (
                <Crown className="h-5 w-5" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
            </div>
            <div>
              <CardTitle className="font-serif text-base lg:text-lg">
                Langganan & Paket
              </CardTitle>
              <CardDescription className="text-xs">
                Kelola paket berlangganan FinBest AI Anda
              </CardDescription>
            </div>
          </div>

          {/* Tier badge */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                isPro
                  ? 'border-gold/40 bg-gold/15 text-gold'
                  : 'border-border bg-muted text-muted-foreground'
              )}
            >
              {isPro ? (
                <>
                  <Crown className="h-3.5 w-3.5" /> Paket Pro
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" /> Paket Gratis
                </>
              )}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Status / expiry banner */}
        {isPro ? (
          <div className="flex flex-col gap-3 rounded-lg border border-gold/30 bg-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="font-serif text-sm font-semibold text-foreground">
                  Paket Pro Aktif
                </p>
                <p className="text-xs text-muted-foreground">
                  AI Mentor: Gemini 2.0 Flash · {data.limits.maxMessagesPerDay}{' '}
                  pesan/hari · analisis tak terbatas
                </p>
              </div>
            </div>
            {expiryDate && (
              <div className="shrink-0 rounded-md bg-background/70 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Aktif hingga
                </p>
                <p className="font-serif text-sm font-semibold text-foreground">
                  {formatDate(expiryDate)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {daysLeft} hari lagi
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-serif text-sm font-semibold text-foreground">
                  Anda menggunakan paket Gratis
                </p>
                <p className="text-xs text-muted-foreground">
                  AI Mentor: GLM-4.6 · {data.limits.maxMessagesPerDay}{' '}
                  pesan/hari · {data.limits.stockAnalysisPerDay} analisis
                  saham/hari
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricing comparison table */}
        <div className="max-h-[420px] overflow-auto rounded-lg border border-border scrollbar-custom">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fitur
                </th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex flex-col items-center gap-0.5">
                    <span>Gratis</span>
                    <span className="font-normal normal-case text-[10px] text-muted-foreground/80">
                      {formatIDR(freePricing.price)}
                    </span>
                  </span>
                </th>
                <th className="bg-gold/5 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gold">
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Pro
                    </span>
                    <span className="font-normal normal-case text-[10px] text-muted-foreground">
                      {formatIDR(proPricing.price)}/bln
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => {
                const Icon = row.icon
                return (
                  <tr
                    key={row.label}
                    className={cn(
                      'border-b border-border/60 last:border-0',
                      i % 2 === 1 && 'bg-muted/20'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2 text-xs text-foreground">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                      {row.free}
                    </td>
                    <td className="bg-gold/5 px-3 py-2.5 text-center text-xs font-medium text-foreground">
                      {row.pro}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Action / manage section */}
        {isPro ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-foreground">
                  Kelola Langganan
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Perpanjangan otomatis aktif setiap 30 hari. Pembatalan dapat
                  dilakukan kapan saja melalui email support.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() =>
                toast.info('Hubungi support@finbest.ai untuk mengelola langganan')
              }
            >
              Kelola Langganan
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="font-serif text-sm font-semibold text-foreground">
                Unlock paket Pro — {formatIDR(proPricing.price)}/bulan
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {proPricing.features.slice(0, 4).map((feat) => (
                  <li
                    key={feat}
                    className="flex items-center gap-1.5 text-[11px] text-foreground/80"
                  >
                    <Check
                      className="h-3 w-3 shrink-0 text-gold"
                      strokeWidth={3}
                    />
                    <span className="line-clamp-1">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              size="lg"
              className="gradient-brass shrink-0 text-gold-foreground hover:opacity-90 sm:ml-4"
              onClick={handleUpgrade}
              disabled={upgrading}
            >
              {upgrading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4" />
                  Upgrade ke Pro
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Profile Summary (top header card with dial + reassessment)
// ============================================================

function ProfileSummary({
  data,
  onRetakeQuestionnaire,
}: {
  data: ProfileData
  onRetakeQuestionnaire: () => void
}) {
  const { user, lastAssessmentDate } = data
  const risk = classifyRisk(user.riskScore)
  const colorClass = RISK_COLOR_CLASSES[risk.color] || RISK_COLOR_CLASSES.emerald

  // Compute days since last assessment
  const daysSince = Math.floor(
    (Date.now() - new Date(lastAssessmentDate).getTime()) / 86_400_000
  )
  const needsReassessment = daysSince >= 365

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Risk dial card */}
      <Card className="lg:col-span-2">
        <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center">
          <RiskScoreDial
            score={user.riskScore}
            colorClass={colorClass}
            label={risk.label}
          />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Profil Risiko Saat Ini
              </p>
              <h2 className={cn('font-serif text-2xl font-semibold', colorClass.text)}>
                {risk.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {risk.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge
                variant="outline"
                className={cn('border', colorClass.border, colorClass.text)}
              >
                Maks. Saham: {risk.maxEquity}%
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                <CalendarClock className="mr-1 h-3 w-3" />
                Horizon: {user.horizonYears} tahun
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                <Wallet className="mr-1 h-3 w-3" />
                {formatIDR(user.annualIncome, true)}/tahun
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={onRetakeQuestionnaire}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {user.riskScore === 50 && user.riskProfile === 'Moderat'
                ? 'Mulai Asesmen Profil Risiko'
                : 'Ulangi Asesmen Profil Risiko'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reassessment reminder */}
      <ReassessmentBanner
        lastAssessmentDate={lastAssessmentDate}
        daysSince={daysSince}
        needsReassessment={needsReassessment}
        onRetake={onRetakeQuestionnaire}
      />
    </div>
  )
}

function RiskScoreDial({
  score,
  colorClass,
  label,
}: {
  score: number
  colorClass: { text: string; bg: string; border: string; ring: string }
  label: string
}) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100)

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          strokeWidth="10"
          className="fill-none stroke-muted"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          strokeWidth="10"
          strokeLinecap="round"
          className={cn('fill-none', colorClass.bg, 'stroke-current', colorClass.ring)}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('font-serif text-3xl font-semibold', colorClass.text)}>
          {score}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          / 100
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}

function ReassessmentBanner({
  lastAssessmentDate,
  daysSince,
  needsReassessment,
  onRetake,
}: {
  lastAssessmentDate: string
  daysSince: number
  needsReassessment: boolean
  onRetake: () => void
}) {
  const daysUntilNext = Math.max(0, 365 - daysSince)

  return (
    <Card
      className={cn(
        'border-l-4',
        needsReassessment
          ? 'border-l-warning bg-warning/10'
          : 'border-l-primary bg-primary/10'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {needsReassessment ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <CalendarClock className="h-5 w-5 text-primary" />
            )}
            <CardTitle className="font-serif text-base">
              Reassessment Profil Risiko Tahunan
            </CardTitle>
          </div>
        </div>
        <CardDescription>
          OJK merekomendasikan reassessment profil risiko minimal setahun sekali.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="rounded-lg bg-background/60 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Asesmen terakhir:</span>
            <span className="font-medium">{formatDate(lastAssessmentDate)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted-foreground">Status:</span>
            {needsReassessment ? (
              <Badge className="bg-warning text-white hover:bg-warning dark:text-[#00033d]">
                Perlu reassessment
              </Badge>
            ) : (
              <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                {daysUntilNext} hari lagi
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant={needsReassessment ? 'default' : 'outline'}
          size="sm"
          className="w-full"
          onClick={onRetake}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {needsReassessment ? 'Ulangi Asesmen Sekarang' : 'Ulangi Asesmen'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Tab 1: Profil Risiko
// ============================================================

function RiskProfileTab({
  user,
  onStartWizard,
  onUpdateProfile,
}: {
  user: ProfileUser
  onStartWizard: () => void
  onUpdateProfile: (patch: Partial<ProfileUser>) => Promise<void>
}) {
  const risk = classifyRisk(user.riskScore)
  const colorClass = RISK_COLOR_CLASSES[risk.color] || RISK_COLOR_CLASSES.emerald

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [horizon, setHorizon] = useState(user.horizonYears.toString())
  const [income, setIncome] = useState(user.annualIncome.toString())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user.name)
    setHorizon(user.horizonYears.toString())
    setIncome(user.annualIncome.toString())
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    await onUpdateProfile({
      name: name.trim() || user.name,
      horizonYears: Math.max(1, Math.min(50, parseInt(horizon) || user.horizonYears)),
      annualIncome: Math.max(0, parseFloat(income) || user.annualIncome),
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Risk profile breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ShieldCheck className={cn('h-5 w-5', colorClass.text)} />
              Detail Profil Risiko
            </CardTitle>
            <CardDescription>
              Berdasarkan kuesioner OJK 10 pertanyaan (Wajib Paham)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatBlock
                label="Skor Risiko"
                value={`${user.riskScore}`}
                sub="/ 100"
                colorClass={colorClass.text}
              />
              <StatBlock
                label="Profil"
                value={risk.label}
                colorClass={colorClass.text}
              />
              <StatBlock
                label="Maks. Alokasi Saham"
                value={`${risk.maxEquity}%`}
                colorClass={colorClass.text}
              />
            </div>

            <Alert
              className={cn('border', colorClass.border, 'bg-background/40')}
            >
              <Info className={cn('h-4 w-4', colorClass.text)} />
              <AlertTitle className={colorClass.text}>
                Karakteristik Profil {risk.label}
              </AlertTitle>
              <AlertDescription>{risk.description}</AlertDescription>
            </Alert>

            <div>
              <p className="mb-2 text-sm font-medium">
                Rentang skor & profil risiko:
              </p>
              <div className="space-y-1.5">
                {[
                  { range: '0 - 24', label: 'Konservatif', max: 20, color: 'slate' as const },
                  { range: '25 - 44', label: 'Moderat Konservatif', max: 35, color: 'teal' as const },
                  { range: '45 - 64', label: 'Moderat', max: 50, color: 'emerald' as const },
                  { range: '65 - 79', label: 'Moderat Agresif', max: 65, color: 'amber' as const },
                  { range: '80 - 100', label: 'Agresif', max: 80, color: 'rose' as const },
                ].map((row) => {
                  const isActive = row.label === risk.label
                  const cc = RISK_COLOR_CLASSES[row.color]
                  return (
                    <div
                      key={row.label}
                      className={cn(
                        'flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors sm:flex-row sm:items-center sm:justify-between',
                        isActive
                          ? cn(cc.bg, 'border-transparent text-primary-foreground shadow-sm')
                          : 'border-border bg-background/40'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                        )}
                        <span className="font-medium">
                          {row.label}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-x-3 gap-y-1',
                          isActive
                            ? 'text-primary-foreground/95'
                            : 'text-muted-foreground'
                        )}
                      >
                        <span>Skor {row.range}</span>
                        <span>•</span>
                        <span>Maks saham {row.max}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Button onClick={onStartWizard} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              {user.riskProfile === 'Moderat' && user.riskScore === 50
                ? 'Mulai Kuesioner Profil Risiko'
                : 'Ulangi Kuesioner Profil Risiko'}
            </Button>
          </CardContent>
        </Card>

        {/* Personal info card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-serif text-base">
                  <UserRound className="h-5 w-5 text-primary" />
                  Data Pribadi
                </CardTitle>
                <CardDescription>Informasi dasar investor</CardDescription>
              </div>
              {!editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Ubah
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">
                    Nama Lengkap
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="horizon" className="text-xs">
                    Horizon Investasi (tahun)
                  </Label>
                  <Input
                    id="horizon"
                    type="number"
                    min={1}
                    max={50}
                    value={horizon}
                    onChange={(e) => setHorizon(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="income" className="text-xs">
                    Pendapatan Tahunan (Rp)
                  </Label>
                  <Input
                    id="income"
                    type="number"
                    min={0}
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Simpan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <InfoRow label="Nama" value={user.name} />
                <InfoRow label="Email" value={user.email} />
                <Separator />
                <InfoRow
                  label="Horizon Investasi"
                  value={`${user.horizonYears} tahun`}
                />
                <InfoRow
                  label="Pendapatan Tahunan"
                  value={formatIDR(user.annualIncome)}
                />
                <Separator />
                <InfoRow label="Profil Risiko" value={user.riskProfile} />
                <InfoRow label="Skor Risiko" value={`${user.riskScore} / 100`} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatBlock({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string
  value: string
  sub?: string
  colorClass?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-1 font-serif text-2xl font-semibold', colorClass)}>
        {value}
        {sub && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  )
}

// ============================================================
// Risk Questionnaire Dialog (FR-1.1)
// ============================================================

function RiskQuestionnaireDialog({
  open,
  onOpenChange,
  currentScore,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentScore: number
  onCompleted: (newScore: number) => Promise<void>
}) {
  const [step, setStep] = useState(0) // 0..N-1 for questions, N for result
  const [answers, setAnswers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const total = RISK_QUESTIONS.length

  // Note: state is reset via the parent's `key` prop when the dialog opens.

  const rawScore = useMemo(
    () => answers.reduce((sum, s) => sum + (s || 0), 0),
    [answers]
  )
  const scaledScore = scaleScore(rawScore)
  const result = classifyRisk(scaledScore)
  const resultColor =
    RISK_COLOR_CLASSES[result.color] || RISK_COLOR_CLASSES.emerald

  const isResult = step >= total
  const currentQuestion = RISK_QUESTIONS[step]
  const canGoBack = step > 0
  const canGoNext = answers[step] !== undefined && !isResult
  const progress = isResult ? 100 : (step / total) * 100

  const handleFinish = async () => {
    setSaving(true)
    await onCompleted(scaledScore)
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto scrollbar-custom sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Kuesioner Profil Risiko (OJK - Wajib Paham)
          </DialogTitle>
          <DialogDescription>
            Jawab 10 pertanyaan berikut dengan jujur untuk menentukan profil
            risiko investasi Anda.
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isResult
                ? 'Hasil Asesmen'
                : `Pertanyaan ${step + 1} dari ${total}`}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="min-h-[280px]">
          <AnimatePresence mode="wait">
            {!isResult ? (
              <motion.div
                key={`q-${currentQuestion.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {currentQuestion.category}
                  </Badge>
                  <h3 className="text-base font-semibold leading-relaxed text-foreground">
                    {currentQuestion.question}
                  </h3>
                </div>
                <RadioGroup
                  value={answers[step]?.toString() ?? ''}
                  onValueChange={(v) =>
                    setAnswers((prev) => {
                      const next = [...prev]
                      next[step] = parseInt(v)
                      return next
                    })
                  }
                  className="gap-2"
                >
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = answers[step] === opt.score
                    return (
                      <label
                        key={idx}
                        htmlFor={`opt-${currentQuestion.id}-${idx}`}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-accent/40'
                        )}
                      >
                        <RadioGroupItem
                          id={`opt-${currentQuestion.id}-${idx}`}
                          value={opt.score.toString()}
                          className="mt-0.5"
                        />
                        <span className="flex-1 text-sm leading-relaxed">
                          {opt.label}
                        </span>
                      </label>
                    )
                  })}
                </RadioGroup>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <RiskScoreDial
                    score={scaledScore}
                    colorClass={resultColor}
                    label={result.label}
                  />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Profil Risiko Anda
                    </p>
                    <h3 className={cn('font-serif text-2xl font-semibold', resultColor.text)}>
                      {result.label}
                    </h3>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      {result.description}
                    </p>
                  </div>
                </div>

                <Alert className={cn('border', resultColor.border)}>
                  <Info className={cn('h-4 w-4', resultColor.text)} />
                  <AlertTitle className={resultColor.text}>
                    Rekomendasi Alokasi Maksimum
                  </AlertTitle>
                  <AlertDescription>
                    Berdasarkan profil{' '}
                    <strong>{result.label}</strong>, alokasi maksimum untuk
                    instrumen saham adalah{' '}
                    <strong>{result.maxEquity}%</strong>. Alokasi ini akan
                    digunakan sebagai batas peringatan di tab Alokasi Target dan
                    modul Traction.
                  </AlertDescription>
                </Alert>

                {currentScore !== scaledScore && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertTitle>Perubahan profil terdeteksi</AlertTitle>
                    <AlertDescription>
                      Profil risiko sebelumnya:{' '}
                      <strong>
                        {classifyRisk(currentScore).label} (skor {currentScore})
                      </strong>
                      . Profil baru:{' '}
                      <strong>
                        {result.label} (skor {scaledScore})
                      </strong>
                      .
                    </AlertDescription>
                  </Alert>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          {!isResult ? (
            <>
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={!canGoBack}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Kembali
              </Button>
              {step < total - 1 ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canGoNext}
                >
                  Selanjutnya <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => setStep(total)}
                  disabled={!canGoNext}
                >
                  Lihat Hasil <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(total - 1)}
                disabled={saving}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Kembali ke Pertanyaan
              </Button>
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Simpan & Tutup
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Tab 2: Tujuan Keuangan (FR-1.2)
// ============================================================

function GoalsTab({
  goals,
  onChange,
}: {
  goals: Goal[]
  onChange: () => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0)
  const totalMonthly = goals.reduce((s, g) => s + g.monthlyContribution, 0)

  const handleEdit = (g: Goal) => {
    setEditingGoal(g)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditingGoal(null)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/profile/goals/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Gagal menghapus tujuan')
      }
      toast.success('Tujuan keuangan berhasil dihapus')
      setDeleteId(null)
      onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total Target"
          value={formatIDR(totalTarget, true)}
          icon={Target}
        />
        <SummaryStat
          label="Terkumpul"
          value={formatIDR(totalCurrent, true)}
          icon={Wallet}
        />
        <SummaryStat
          label="Kontribusi Bulanan"
          value={formatIDR(totalMonthly, true)}
          icon={TrendingUp}
        />
      </div>

      {/* Goals list */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <Target className="h-5 w-5 text-primary" />
                Daftar Tujuan Keuangan
              </CardTitle>
              <CardDescription>
                {goals.length === 0
                  ? 'Belum ada tujuan. Mulai dengan menambahkan satu tujuan.'
                  : `${goals.length} tujuan aktif. Minimum 1 tujuan direkomendasikan.`}
              </CardDescription>
            </div>
            <Button onClick={handleAdd} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Tambah Tujuan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <EmptyGoals onAdd={handleAdd} />
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => handleEdit(goal)}
                  onDelete={() => setDeleteId(goal.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editingGoal}
        onSaved={() => {
          setFormOpen(false)
          onChange()
        }}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tujuan Keuangan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Tujuan dan data progresnya
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyGoals({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
        <Target className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">Belum ada tujuan keuangan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tetapkan minimal satu tujuan untuk memandu strategi investasi Anda.
        </p>
      </div>
      <Button onClick={onAdd} size="sm">
        <Plus className="mr-1 h-4 w-4" /> Tambah Tujuan Pertama
      </Button>
    </div>
  )
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: Goal
  onEdit: () => void
  onDelete: () => void
}) {
  const priorityConfig = PRIORITY_CONFIG[goal.priority]
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const monthlyShortfall =
    goal.horizonYears > 0 ? remaining / (goal.horizonYears * 12) : 0
  const onTrack =
    goal.monthlyContribution >= monthlyShortfall * 0.95 && remaining > 0

  return (
    <div className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{goal.title}</h4>
            <Badge variant="outline" className={priorityConfig.className}>
              Prioritas {priorityConfig.label}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {goal.horizonYears} tahun
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="ml-1 hidden sm:inline">Ubah</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="ml-1 hidden sm:inline">Hapus</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatIDR(goal.currentAmount, true)}
            <span className="text-foreground/60"> / {formatIDR(goal.targetAmount, true)}</span>
          </span>
          <span className="font-semibold">{goal.progress.toFixed(1)}%</span>
        </div>
        <Progress
          value={goal.progress}
          className={cn('h-2', goal.progress >= 100 && '[&_[data-slot=progress-indicator]]:bg-primary')}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Kontribusi/bln</p>
          <p className="font-medium">{formatIDR(goal.monthlyContribution, true)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Sisa target</p>
          <p className="font-medium">{formatIDR(remaining, true)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Kebutuhan/bln</p>
          <p className="font-medium">{formatIDR(monthlyShortfall, true)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          {goal.progress >= 100 ? (
            <Badge className="bg-primary text-primary-foreground hover:bg-primary">
              Tercapai
            </Badge>
          ) : onTrack ? (
            <Badge className="bg-primary/90 text-primary-foreground hover:bg-primary/90">
              On Track
            </Badge>
          ) : goal.monthlyContribution > 0 ? (
            <Badge className="bg-warning text-white hover:bg-warning dark:text-[#00033d]">
              Perlu Top-up
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Belum dimulai
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  goal: Goal | null
  onSaved: () => void
}) {
  const isEdit = !!goal
  const [title, setTitle] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [horizonYears, setHorizonYears] = useState('')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [priority, setPriority] = useState<Goal['priority']>('Sedang')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(goal?.title ?? '')
      setTargetAmount(goal ? goal.targetAmount.toString() : '')
      setCurrentAmount(goal ? goal.currentAmount.toString() : '0')
      setHorizonYears(goal ? goal.horizonYears.toString() : '5')
      setMonthlyContribution(goal ? goal.monthlyContribution.toString() : '0')
      setPriority(goal?.priority ?? 'Sedang')
    }
  }, [open, goal])

  const handleSubmit = async () => {
    // Validate
    if (!title.trim()) {
      toast.error('Judul tujuan wajib diisi')
      return
    }
    const target = parseFloat(targetAmount)
    if (!target || target <= 0) {
      toast.error('Target jumlah harus lebih dari 0')
      return
    }
    const horizon = parseInt(horizonYears)
    if (!horizon || horizon < 1 || horizon > 50) {
      toast.error('Horizon investasi harus 1-50 tahun')
      return
    }

    const payload = {
      title: title.trim(),
      targetAmount: target,
      currentAmount: Math.max(0, parseFloat(currentAmount) || 0),
      horizonYears: horizon,
      monthlyContribution: Math.max(0, parseFloat(monthlyContribution) || 0),
      priority,
    }

    setSaving(true)
    try {
      const url = isEdit
        ? `/api/profile/goals/${goal!.id}`
        : '/api/profile/goals'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Gagal menyimpan tujuan')
      }
      toast.success(
        isEdit ? 'Tujuan diperbarui' : 'Tujuan baru berhasil ditambahkan'
      )
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto scrollbar-custom sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {isEdit ? 'Ubah Tujuan Keuangan' : 'Tambah Tujuan Keuangan'}
          </DialogTitle>
          <DialogDescription>
            Tetapkan target, jangka waktu, dan kontribusi bulanan untuk tujuan
            Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Judul Tujuan *</Label>
            <Input
              id="goal-title"
              placeholder="Misal: Dana Pendidikan Anak, Dana Pensiun, Haji"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target Jumlah (Rp) *</Label>
              <Input
                id="goal-target"
                type="number"
                min={1}
                placeholder="500000000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-current">Saat Ini (Rp)</Label>
              <Input
                id="goal-current"
                type="number"
                min={0}
                placeholder="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-horizon">Horizon (tahun) *</Label>
              <Input
                id="goal-horizon"
                type="number"
                min={1}
                max={50}
                value={horizonYears}
                onChange={(e) => setHorizonYears(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-monthly">Kontribusi Bulanan (Rp)</Label>
              <Input
                id="goal-monthly"
                type="number"
                min={0}
                placeholder="1000000"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Prioritas</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Goal['priority'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih prioritas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tinggi">Tinggi - pencapaian utama</SelectItem>
                <SelectItem value="Sedang">Sedang - prioritas normal</SelectItem>
                <SelectItem value="Rendah">Rendah - tujuan fleksibel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetAmount && horizonYears && (
            <Alert className="bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle>Estimasi Kebutuhan Bulanan</AlertTitle>
              <AlertDescription>
                Untuk mencapai{' '}
                <strong>{formatIDR(parseFloat(targetAmount) || 0)}</strong>{' '}
                dalam <strong>{horizonYears} tahun</strong>, Anda perlu menabung
                sekitar{' '}
                <strong>
                  {formatIDR(
                    (Math.max(0, (parseFloat(targetAmount) || 0) - (parseFloat(currentAmount) || 0))) /
                      (Math.max(1, parseInt(horizonYears)) * 12)
                  )}
                </strong>{' '}
                per bulan (tanpa asumsi return investasi).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {isEdit ? 'Simpan Perubahan' : 'Tambah Tujuan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Tab 3: Alokasi Target (FR-1.3)
// ============================================================

function AllocationTab({
  allocation,
  maxEquity,
  riskLabel,
  onSaved,
}: {
  allocation: Allocation | null
  maxEquity: number
  riskLabel: string
  onSaved: () => void
}) {
  const defaultAlloc: Allocation = allocation ?? {
    saham: 30,
    obligasi: 35,
    reksadana: 20,
    kas: 10,
    emas: 5,
  }

  const [values, setValues] = useState<Allocation>(defaultAlloc)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (allocation) setValues(allocation)
  }, [allocation])

  const total =
    values.saham +
    values.obligasi +
    values.reksadana +
    values.kas +
    values.emas

  const isComplete = Math.abs(total - 100) < 0.5
  const equityWarning = values.saham > maxEquity

  const handleSliderChange = (key: keyof Allocation, v: number) => {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  const handleNormalize = () => {
    if (total === 0) return
    const factor = 100 / total
    const scaled: Allocation = {
      saham: Math.round(values.saham * factor),
      obligasi: Math.round(values.obligasi * factor),
      reksadana: Math.round(values.reksadana * factor),
      kas: Math.round(values.kas * factor),
      emas: 0, // last one absorbs rounding error
    }
    scaled.emas = Math.max(
      0,
      100 - scaled.saham - scaled.obligasi - scaled.reksadana - scaled.kas
    )
    setValues(scaled)
    toast.success('Alokasi dinormalisasi ke 100%')
  }

  const handleSave = async () => {
    if (!isComplete) {
      toast.error(`Total alokasi harus 100% (saat ini ${total.toFixed(1)}%)`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/profile/allocation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Gagal menyimpan alokasi')
      }
      toast.success('Alokasi target berhasil disimpan')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-base">
            <PieChart className="h-5 w-5 text-primary" />
            Alokasi Target Portofolio
          </CardTitle>
          <CardDescription>
            Atur distribusi target untuk 5 kelas aset. Total harus 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Total progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Alokasi</span>
              <span
                className={cn(
                  'font-serif text-2xl font-semibold',
                  isComplete
                    ? 'text-primary'
                    : 'text-warning'
                )}
              >
                {total.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={total}
              className={cn(
                'h-3',
                isComplete
                  ? '[&_[data-slot=progress-indicator]]:bg-primary'
                  : '[&_[data-slot=progress-indicator]]:bg-warning'
              )}
            />
            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  isComplete
                    ? 'text-primary'
                    : 'text-warning'
                )}
              >
                {isComplete
                  ? 'Total alokasi sudah 100% - siap disimpan'
                  : `Kurang ${(100 - total).toFixed(1)}% untuk mencapai 100%`}
              </span>
              {!isComplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNormalize}
                  className="h-6 px-2 text-xs"
                >
                  Normalisasi otomatis
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Sliders */}
          <div className="space-y-5">
            {(Object.keys(ASSET_META) as (keyof Allocation)[]).map((key) => {
              const meta = ASSET_META[key]
              const Icon = meta.icon
              const value = values[key]
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', meta.color)} />
                      <span className="text-sm font-medium">{meta.label}</span>
                      {key === 'saham' && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            equityWarning
                              ? 'border-warning/30 text-warning'
                              : 'text-muted-foreground'
                          )}
                        >
                          Maks {maxEquity}%
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-bold tabular-nums">
                      {value.toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(arr) => handleSliderChange(key, arr[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              )
            })}
          </div>

          {/* Equity warning */}
          {equityWarning && (
            <Alert className="border-warning/30 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">
                Alokasi saham melebihi batas profil risiko
              </AlertTitle>
              <AlertDescription>
                Alokasi saham saat ini{' '}
                <strong>{values.saham.toFixed(0)}%</strong> melebihi batas
                maksimum <strong>{maxEquity}%</strong> untuk profil{' '}
                <strong>{riskLabel}</strong>. Pertimbangkan untuk mengurangi
                alokasi saham atau ulangi asesmen profil risiko.
              </AlertDescription>
            </Alert>
          )}

          {/* Visual allocation bar */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Visualisasi Alokasi
            </p>
            <AllocationBar values={values} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setValues(defaultAlloc)}
              disabled={saving}
            >
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!isComplete || saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Simpan Alokasi
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AllocationBar({ values }: { values: Allocation }) {
  const segments = (
    Object.keys(ASSET_META) as (keyof Allocation)[]
  ).map((key) => ({
    key,
    value: values[key],
    color: ASSET_META[key].color
      .replace('text-', 'bg-')
      .replace('-500', '-500'),
    foreground:
      key === 'saham' || key === 'obligasi' || key === 'kas'
        ? 'text-white'
        : 'text-[#00033d]',
  }))

  return (
    <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border">
      {segments.map((seg) =>
        seg.value > 0 ? (
          <div
            key={seg.key}
            className={cn(
              'flex items-center justify-center text-[10px] font-semibold',
              seg.color,
              seg.foreground
            )}
            style={{ width: `${seg.value}%` }}
            title={`${ASSET_META[seg.key].label}: ${seg.value.toFixed(0)}%`}
          >
            {seg.value >= 8 ? `${seg.value.toFixed(0)}%` : ''}
          </div>
        ) : null
      )}
    </div>
  )
}

// ============================================================
// Tab 4: Import Portofolio (FR-1.4)
// ============================================================

function ImportPortfolioTab() {
  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false)
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<
    { ticker: string; name: string; quantity: number; avgCost: number }[]
  >([])
  const [parsing, setParsing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleFile = async (file: File) => {
    setCsvFile(file)
    setParsing(true)
    setCsvDialogOpen(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const parsed: {
        ticker: string
        name: string
        quantity: number
        avgCost: number
      }[] = []
      // Skip header line if it contains "ticker" (case-insensitive)
      const startIdx = lines[0]?.toLowerCase().includes('ticker') ? 1 : 0
      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim())
        if (cols.length < 4) continue
        const ticker = cols[0]
        const name = cols[1]
        const quantity = parseFloat(cols[2])
        const avgCost = parseFloat(cols[3])
        if (ticker && name && !Number.isNaN(quantity) && !Number.isNaN(avgCost)) {
          parsed.push({ ticker, name, quantity, avgCost })
        }
      }
      setCsvPreview(parsed.slice(0, 50))
      if (parsed.length === 0) {
        toast.error(
          'CSV tidak terbaca. Pastikan format: ticker,name,quantity,avgCost'
        )
      } else {
        toast.success(`${parsed.length} baris berhasil diparse`)
      }
    } catch {
      toast.error('Gagal membaca file CSV')
    } finally {
      setParsing(false)
    }
  }

  const handleConfirmImport = async () => {
    setConfirming(true)
    // Simulated import — for prototype, we just confirm and close
    await new Promise((r) => setTimeout(r, 800))
    toast.success(
      `${csvPreview.length} posisi berhasil diimpor (simulasi). Data portofolio diperbarui.`
    )
    setConfirming(false)
    setCsvDialogOpen(false)
    setCsvFile(null)
    setCsvPreview([])
  }

  const handleLoadSample = async () => {
    setConfirming(true)
    await new Promise((r) => setTimeout(r, 800))
    toast.success(
      'Portofolio contoh berhasil dimuat. 11 posisi aktif dari data seed FinBest AI.'
    )
    setConfirming(false)
    setSampleDialogOpen(false)
  }

  return (
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle>Import Portofolio Eksternal</AlertTitle>
        <AlertDescription>
          FinBest AI bersifat <strong>non-diskrisioner</strong> dan{' '}
          <strong>read-only</strong> terhadap broker eksternal. Anda dapat
          mengimpor posisi dari broker untuk analisis lebih lanjut. Sistem
          tidak akan pernah mengeksekusi transaksi atas nama Anda.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Broker read-only */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="font-serif text-base">Import dari Broker</CardTitle>
            <CardDescription>
              Konektor read-only ke broker sekuritas Anda (BCA, Sinarmas, Mirae,
              dll).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Hanya membaca posisi & riwayat transaksi
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Tidak ada hak eksekusi transaksi
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Data terenkripsi end-to-end
              </li>
            </ul>
          </CardContent>
          <CardContent className="pt-0">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setBrokerDialogOpen(true)}
            >
              <Landmark className="mr-2 h-4 w-4" /> Pelajari Integrasi
            </Button>
          </CardContent>
        </Card>

        {/* CSV upload */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <FileUp className="h-5 w-5 text-warning" />
            </div>
            <CardTitle className="font-serif text-base">Upload CSV</CardTitle>
            <CardDescription>
              Upload file CSV dari broker Anda. Format:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                ticker,name,quantity,avgCost
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Preview data sebelum konfirmasi
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Maksimal 50 baris per import
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Mendukung ekspor BCA, Sinarmas, Mandiri
              </li>
            </ul>
          </CardContent>
          <CardContent className="pt-0">
            <label className="block w-full">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                  e.target.value = ''
                }}
              />
              <Button
                className="w-full"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault()
                  ;(e.currentTarget.parentElement?.querySelector(
                    'input[type="file"]'
                  ) as HTMLInputElement)?.click()
                }}
              >
                <Upload className="mr-2 h-4 w-4" /> Pilih File CSV
              </Button>
            </label>
          </CardContent>
        </Card>

        {/* Sample portfolio */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="font-serif text-base">Load Sample Portfolio</CardTitle>
            <CardDescription>
              Muat portofolio contoh FinBest AI (11 posisi pasar Indonesia) untuk
              eksplorasi fitur.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Saham (BBCA, BBRI, TLKM, ASII, GOTO, ICBP)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Obligasi & Reksa Dana (RDSU, RDPU, INDO23)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Emas (Antam) & Kas Rupiah
              </li>
            </ul>
          </CardContent>
          <CardContent className="pt-0">
            <Button
              className="w-full"
              onClick={() => setSampleDialogOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Load Sample Portfolio
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* CSV format help */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">Format CSV yang Didukung</CardTitle>
          <CardDescription>
            Header wajib: <code className="rounded bg-muted px-1 py-0.5 text-xs">ticker,name,quantity,avgCost</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-56 overflow-auto rounded-lg bg-muted p-3 text-xs scrollbar-custom">
{`ticker,name,quantity,avgCost
BBCA,Bank Central Asia Tbk,200,9200
BBRI,Bank Rakyat Indonesia Tbk,500,4500
TLKM,Telkom Indonesia Tbk,1000,2900
RDSU,Sucorinvest Equity Fund,1000,1380
GLD001,Antam Logam Mulia 1gr,10,1280000`}
          </pre>
        </CardContent>
      </Card>

      {/* Broker info dialog */}
      <Dialog open={brokerDialogOpen} onOpenChange={setBrokerDialogOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Integrasi Broker (Read-Only)
            </DialogTitle>
            <DialogDescription>
              FinBest AI terhubung ke broker sekuritas Anda melalui API read-only
              untuk mengimpor posisi & riwayat transaksi.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm scrollbar-custom sm:px-6">
            <Alert className="border-primary/30 bg-primary/10">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">
                Jaminan Read-Only
              </AlertTitle>
              <AlertDescription>
                FinBest AI hanya memiliki scope <strong>read</strong>. Tidak ada
                scope untuk order, jual, atau beli. Sesuai prinsip
                non-diskrisioner POJK 35/2022.
              </AlertDescription>
            </Alert>
            <div>
              <p className="mb-2 font-medium">Broker yang akan didukung:</p>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                {[
                  'BCA Sekuritas',
                  'Sinarmas Sekuritas',
                  'Mirae Asset',
                  'Mandiri Sekuritas',
                  'BNI Sekuritas',
                  'Phillip Sekuritas',
                ].map((b) => (
                  <div
                    key={b}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-background/40 p-2"
                  >
                    <Landmark className="h-3 w-3 text-primary" />
                    {b}
                  </div>
                ))}
              </div>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Prototype Demo</AlertTitle>
              <AlertDescription>
                Pada prototipe ini, integrasi broker belum diaktifkan. Silakan
                gunakan fitur <strong>Upload CSV</strong> atau{' '}
                <strong>Load Sample Portfolio</strong> untuk demonstrasi.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4">
            <Button className="w-full sm:w-auto" onClick={() => setBrokerDialogOpen(false)}>Mengerti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV preview dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto scrollbar-custom sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-warning" />
              Preview Import CSV
            </DialogTitle>
            <DialogDescription>
              {csvFile?.name} — periksa data sebelum konfirmasi import.
            </DialogDescription>
          </DialogHeader>
          {parsing ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Memproses file...
              </span>
            </div>
          ) : csvPreview.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Tidak ada data valid</AlertTitle>
              <AlertDescription>
                Pastikan CSV memiliki header <code>ticker,name,quantity,avgCost</code> dan
                baris data dengan format angka yang valid.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {csvPreview.length} posisi siap diimpor
                </span>
                <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                  Valid
                </Badge>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-border scrollbar-custom">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Ticker</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Avg Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-border hover:bg-accent/30"
                      >
                        <td className="px-3 py-2 font-medium">{row.ticker}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.name}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(row.quantity, 2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatIDR(row.avgCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Alert className="bg-warning/10">
                <Info className="h-4 w-4 text-warning" />
                <AlertDescription>
                  Import akan menimpa posisi yang ada dengan ticker yang sama.
                  Proses ini bersifat simulasi pada prototipe.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCsvDialogOpen(false)
                setCsvFile(null)
                setCsvPreview([])
              }}
              disabled={confirming}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={parsing || csvPreview.length === 0 || confirming}
            >
              {confirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Konfirmasi Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sample load dialog */}
      <Dialog open={sampleDialogOpen} onOpenChange={setSampleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Load Sample Portfolio
            </DialogTitle>
            <DialogDescription>
              Muat 11 posisi contoh dari data seed FinBest AI untuk eksplorasi
              fitur.
            </DialogDescription>
          </DialogHeader>
          <Alert className="bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              Portofolio contoh sudah aktif di akun demo Anda. Tindakan ini
              akan memverifikasi dan menyegarkan data posisi yang ada.
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSampleDialogOpen(false)}
              disabled={confirming}
            >
              Batal
            </Button>
            <Button onClick={handleLoadSample} disabled={confirming}>
              {confirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Load Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Shared: Disclaimer + Skeleton
// ============================================================

function DisclaimerNote() {
  return (
    <Alert className="border-border bg-muted/40">
      <Info className="h-4 w-4 text-muted-foreground" />
      <AlertDescription className="text-xs text-muted-foreground">
        {DISCLAIMER}
      </AlertDescription>
    </Alert>
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
