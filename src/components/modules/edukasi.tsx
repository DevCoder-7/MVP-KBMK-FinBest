'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertCircle,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  HelpCircle,
  ListChecks,
  Loader2,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ====================== Types ======================
interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
}

interface Lesson {
  id: string
  title: string
  description: string
  difficulty: 'Pemula' | 'Menengah' | 'Lanjut'
  duration: number
  category: string
  keyPoints: string[]
  content: string[]
  quiz: QuizQuestion[]
  completed: boolean
}

interface LessonsResponse {
  lessons: Lesson[]
  stats: {
    total: number
    completed: number
    progressPct: number
    dueForReview: number
  }
  nextLesson: Lesson | null
  dueForReview: Lesson[]
}

const MASTERY_THRESHOLD = 70

// Muted editorial tones (NO blue/indigo) — emerald / amber / rose
const DIFFICULTY_STYLE: Record<
  Lesson['difficulty'],
  { badge: string; dot: string }
> = {
  Pemula: {
    badge: 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  Menengah: {
    badge: 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  Lanjut: {
    badge: 'border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
}

// ====================== Progress Ring ======================
function ProgressRing({ pct }: { pct: number }) {
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(pct, 0), 100)
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="rgba(67, 62, 171, 0.16)"
          strokeWidth="8"
          fill="none"
          className="dark:stroke-white/10"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          stroke="#433eab"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="dark:stroke-[#9AA9FF]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl font-semibold leading-none text-foreground">
          {Math.round(pct)}
          <span className="ml-0.5 text-lg text-muted-foreground">%</span>
        </span>
        <span className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Selesai
        </span>
      </div>
    </div>
  )
}

// ====================== Stat Card ======================
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint?: string
  accent: string
}

function StatCard({ icon: Icon, label, value, hint, accent }: StatCardProps) {
  return (
    <Card className="card-editorial overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1.5 font-serif text-2xl font-semibold leading-none text-foreground">
              {value}
            </p>
            {hint && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
            )}
          </div>
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================== Lesson Timeline Card ======================
interface TimelineCardProps {
  lesson: Lesson
  index: number
  isNext: boolean
  onOpen: () => void
}

function LessonTimelineCard({ lesson, index, isNext, onOpen }: TimelineCardProps) {
  const diff = DIFFICULTY_STYLE[lesson.difficulty]
  return (
    <div className="relative pl-11">
      {/* Number / status badge — sits on the timeline */}
      <div
        className={cn(
          'absolute left-0 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs font-semibold shadow-sm transition-colors',
          lesson.completed
            ? 'bg-primary text-primary-foreground'
            : isNext
              ? 'border-gold bg-background text-gold'
              : 'border-border bg-background text-muted-foreground'
        )}
      >
        {lesson.completed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      <motion.button
        type="button"
        onClick={onOpen}
        whileHover={{ y: -1 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'card-editorial group block w-full rounded-lg border bg-card p-4 text-left transition-colors',
          isNext
            ? 'border-gold/40 hover:border-gold/60'
            : 'border-border hover:border-primary/30'
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
              diff.badge
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', diff.dot)} />
            {lesson.difficulty}
          </span>
          <Badge variant="secondary" className="text-[11px] font-normal">
            {lesson.category}
          </Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {lesson.duration} menit
          </span>
          {lesson.completed && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selesai
            </span>
          )}
          {!lesson.completed && isNext && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-gold">
              <Target className="h-3.5 w-3.5" />
              Berikutnya
            </span>
          )}
        </div>

        <h3 className="mt-2.5 font-serif text-base font-semibold leading-snug text-foreground">
          {lesson.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {lesson.description}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {lesson.keyPoints.length} poin kunci · {lesson.quiz.length} soal kuis
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Buka
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </motion.button>
    </div>
  )
}

// ====================== Lesson Detail Dialog ======================
interface LessonDialogProps {
  lesson: Lesson | null
  open: boolean
  onOpenChange: (v: boolean) => void
  prereqHint: string | null
  onCompleted: () => void
}

function LessonDetailDialog({
  lesson,
  open,
  onOpenChange,
  prereqHint,
  onCompleted,
}: LessonDialogProps) {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setPendingAIQuery = useAppStore((s) => s.setPendingAIQuery)

  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    score: number
    passed: boolean
  } | null>(null)

  // Reset state whenever the dialog opens for a (different) lesson
  useEffect(() => {
    if (open) {
      setAnswers({})
      setResult(null)
    }
  }, [open, lesson?.id])

  const allAnswered = useMemo(
    () => !!lesson && lesson.quiz.every((_, i) => answers[i] !== undefined),
    [lesson, answers]
  )

  if (!lesson) return null

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    const correct = lesson.quiz.reduce(
      (acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0),
      0
    )
    const score = Math.round((correct / lesson.quiz.length) * 100)

    try {
      const res = await fetch('/api/edukasi/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, quizScore: score }),
      })
      const json = await res.json()

      if (json.success) {
        const isReview = json.reviewed === true
        setResult({ score, passed: true })
        toast.success(
          isReview ? 'Review berhasil!' : 'Lesson selesai!',
          {
            description: isReview
              ? `Skor ${score}/100. Ingatan diperbarui dengan pengulangan bertahap.`
              : `Skor ${score}/100 — penguasaan tercapai. Lanjut ke materi berikutnya.`,
          }
        )
        setTimeout(() => {
          onOpenChange(false)
          onCompleted()
        }, 1500)
      } else {
        setResult({ score, passed: false })
        toast.warning('Skor belum mencapai mastery', {
          description: `Skor Anda ${score}/${100}. Pelajari ulang materinya, lalu coba kuis lagi.`,
        })
      }
    } catch {
      toast.error('Gagal menyimpan progress', {
        description: 'Periksa koneksi Anda dan coba lagi.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAskAI = () => {
    setPendingAIQuery(
      `Jelaskan lebih lanjut tentang "${lesson.title}" dalam konteks investasi di pasar modal Indonesia. Saya sedang mempelajari materi edukasi FinBest AI tentang: ${lesson.description}.`
    )
    setActiveTab('ai')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,760px)] max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="shrink-0 space-y-2 border-b border-border px-4 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
                DIFFICULTY_STYLE[lesson.difficulty].badge
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  DIFFICULTY_STYLE[lesson.difficulty].dot
                )}
              />
              {lesson.difficulty}
            </span>
            <Badge variant="secondary" className="text-[11px] font-normal">
              {lesson.category}
            </Badge>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {lesson.duration} menit
            </span>
            {lesson.completed && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                Sudah Selesai
              </span>
            )}
          </div>
          <DialogTitle className="font-serif text-2xl font-semibold leading-tight">
            {lesson.title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {lesson.description}
          </DialogDescription>
        </DialogHeader>

        {/* Prerequisite hint — non-blocking, non-diskrisioner */}
        {prereqHint && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{prereqHint}</span>
          </div>
        )}

        {/* Scrollable body */}
        <ScrollArea className="min-h-0 flex-1 px-4 sm:px-6">
          <div className="py-5">
            {/* Key Points */}
            <section>
              <h4 className="flex items-center gap-2 font-serif text-base font-semibold text-foreground">
                <ListChecks className="h-4 w-4 text-primary" />
                Poin Kunci
              </h4>
              <ul className="mt-3 space-y-2">
                {lesson.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground/90">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </section>

            <Separator className="my-5" />

            {/* Content */}
            <section>
              <h4 className="flex items-center gap-2 font-serif text-base font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Materi
              </h4>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/85">
                {lesson.content.map((c, i) => (
                  <p key={i}>{c}</p>
                ))}
              </div>
            </section>

            <Separator className="my-5" />

            {/* Quiz */}
            <section>
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-serif text-base font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Kuis Mastery
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Ambang mastery: {MASTERY_THRESHOLD}/100
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {lesson.quiz.map((q, qi) => (
                  <div
                    key={qi}
                    className="rounded-md border border-border bg-card/60 p-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      <span className="text-muted-foreground">{qi + 1}.</span>{' '}
                      {q.question}
                    </p>
                    <RadioGroup
                      className="mt-3 gap-2"
                      value={answers[qi] !== undefined ? String(answers[qi]) : ''}
                      onValueChange={(v) =>
                        setAnswers((prev) => ({ ...prev, [qi]: Number(v) }))
                      }
                    >
                      {q.options.map((opt, oi) => (
                        <div
                          key={oi}
                          className="flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/40"
                        >
                          <RadioGroupItem
                            value={String(oi)}
                            id={`${lesson.id}-${qi}-${oi}`}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`${lesson.id}-${qi}-${oi}`}
                            className="cursor-pointer text-sm font-normal leading-relaxed text-foreground/90"
                          >
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </section>

            {/* Result feedback */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={cn(
                    'mt-4 flex items-start gap-2 rounded-md border p-3 text-sm',
                    result.passed
                      ? 'border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300'
                  )}
                >
                  {result.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">
                      {result.passed
                        ? `Mastery tercapai — Skor ${result.score}/100`
                        : `Skor ${result.score}/100 — belum mencapai mastery`}
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">
                      {result.passed
                        ? 'Menutup dialog otomatis...'
                        : 'Pelajari ulang Poin Kunci & Materi di atas, lalu coba kuis lagi.'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="shrink-0 items-stretch justify-between gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAskAI}
            className="w-full justify-center text-primary hover:bg-primary/5 hover:text-primary sm:w-auto"
          >
            <Sparkles className="h-4 w-4" />
            Tanya AI FinBest
          </Button>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {!allAnswered && (
              <span className="text-center text-[11px] text-muted-foreground sm:text-left">
                Jawab semua soal untuk mengaktifkan tombol
              </span>
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered || submitting || result?.passed}
              size="sm"
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {lesson.completed ? 'Review Ulang' : 'Selesaikan & Lanjut'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ====================== Loading Skeleton ======================
function EdukasiSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      {/* Progress overview skeleton */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 w-full rounded-lg" />
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 pl-11">
            <Skeleton className="absolute left-0 h-8 w-8 rounded-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ====================== Main Module ======================
export default function EdukasiModule() {
  const [data, setData] = useState<LessonsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchLessons = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/edukasi/lessons', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat lessons')
      const json: LessonsResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  const lessons = data?.lessons ?? []
  const stats = data?.stats ?? {
    total: 0,
    completed: 0,
    progressPct: 0,
    dueForReview: 0,
  }
  const isAllComplete = stats.total > 0 && stats.completed === stats.total

  // Determine prerequisite hint for a clicked lesson (non-blocking)
  const getPrereqHint = useCallback(
    (lesson: Lesson): string | null => {
      const idx = lessons.findIndex((l) => l.id === lesson.id)
      if (idx <= 0) return null
      if (lesson.difficulty === 'Pemula') return null
      const firstIncompletePrior = lessons
        .slice(0, idx)
        .find((l) => !l.completed)
      if (!firstIncompletePrior) return null
      return `Kami sarankan selesaikan lesson "${firstIncompletePrior.title}" dulu untuk pemahaman optimal. Anda tetap bisa mempelajari materi ini (prinsip non-diskrisioner).`
    },
    [lessons]
  )

  const openLesson = useCallback((lesson: Lesson) => {
    setSelectedLesson(lesson)
    setDialogOpen(true)
  }, [])

  // ============ Loading ============
  if (loading) return <EdukasiSkeleton />

  // ============ Error ============
  if (error || !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <p className="font-serif text-lg font-semibold">Gagal memuat Edukasi</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error ?? 'Terjadi kesalahan tidak diketahui.'}
          </p>
        </div>
        <Button onClick={fetchLessons} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
          Coba lagi
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-8 lg:p-6">
      {/* ============ Header ============ */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md gradient-pine">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Edukasi Investasi
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pelajaran bertahap dengan evaluasi &amp; pengulangan tersusun
              sesuai tingkat penguasaan Anda
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchLessons}
          className="self-start text-muted-foreground hover:text-foreground sm:self-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {/* ============ Stats Bar ============ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Total Lesson"
          value={stats.total}
          hint="8 jalur kurikulum"
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Selesai"
          value={stats.completed}
          hint={`${stats.total - stats.completed} tersisa`}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
        />
        <StatCard
          icon={Award}
          label="Progress"
          value={`${stats.progressPct}%`}
          hint="Mastery-based"
          accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
        />
        <StatCard
          icon={RotateCcw}
          label="Due for Review"
          value={stats.dueForReview}
          hint="Spaced repetition"
          accent={
            stats.dueForReview > 0
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
              : 'bg-muted text-muted-foreground'
          }
        />
      </div>

      {/* ============ All Completed Celebration ============ */}
      {isAllComplete && (
        <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-card dark:border-emerald-900/40 dark:from-emerald-950/20">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <PartyPopper className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  Selamat! Semua lesson selesai.
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Anda telah menguasai kurikulum dasar investasi FinBest AI.
                  Terus asah pengetahuan dengan pengulangan bertahap di bawah.
                </p>
              </div>
            </div>
            {data.dueForReview.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  data.dueForReview[0] && openLesson(data.dueForReview[0])
                }
                className="shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                <RotateCcw className="h-4 w-4" />
                Mulai Review
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============ Progress Overview ============ */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Progress ring card */}
        <Card className="card-editorial">
          <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <ProgressRing pct={stats.progressPct} />
            <div className="text-center">
              <p className="font-serif text-sm font-semibold text-foreground">
                {stats.completed} dari {stats.total} lesson
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mastery-based · ambang 70/100
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Next lesson + due for review */}
        <div className="space-y-4 lg:col-span-2">
          {/* Next lesson */}
          {data.nextLesson && !isAllComplete && (
            <Card className="border-gold/40 bg-gradient-to-br from-accent/50 to-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-gold" />
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Lanjutkan Belajar
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl font-semibold leading-tight text-foreground">
                      {data.nextLesson.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.nextLesson.description}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
                          DIFFICULTY_STYLE[data.nextLesson.difficulty].badge
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            DIFFICULTY_STYLE[data.nextLesson.difficulty].dot
                          )}
                        />
                        {data.nextLesson.difficulty}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-normal"
                      >
                        {data.nextLesson.category}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {data.nextLesson.duration} menit
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => openLesson(data.nextLesson!)}
                    size="sm"
                    className="shrink-0"
                  >
                    Mulai
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Due for review (spaced repetition) */}
          {data.dueForReview.length > 0 && (
            <Card className="border-amber-200/60 dark:border-amber-900/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <CardTitle className="font-serif text-base font-semibold">
                    Due for Review
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[11px] font-normal"
                  >
                    {data.dueForReview.length} lesson
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Spaced repetition — pelajari ulang untuk memperkuat ingatan
                  jangka panjang.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                <div className="h-72 max-h-[calc(100dvh-22rem)] min-h-48 space-y-2 overflow-y-auto scrollbar-custom pr-1">
                  {data.dueForReview.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => openLesson(lesson)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {lesson.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                              DIFFICULTY_STYLE[lesson.difficulty].badge
                            )}
                          >
                            {lesson.difficulty}
                          </span>
                          {lesson.category}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
                        <RotateCcw className="h-3 w-3" />
                        Review
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* If all complete & nothing due for review */}
          {isAllComplete && data.dueForReview.length === 0 && (
            <Card className="border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/10">
              <CardContent className="flex items-center gap-3 p-5">
                <Brain className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Ingatan Anda masih segar
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Lesson akan muncul kembali untuk review setelah 7 hari
                    (pengulangan bertahap aktif).
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ============ Learning Path Timeline ============ */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              Jalur Belajar
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pemula → Menengah → Lanjut. Selesaikan secara berurutan untuk
              pemahaman optimal.
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {stats.completed}/{stats.total} selesai
          </span>
        </div>

        <div className="relative">
          {/* Vertical timeline line — blue, 2px */}
          <div
            className="absolute bottom-3 left-4 top-3 w-0.5 bg-primary/20"
            aria-hidden
          />
          <div className="space-y-3">
            {lessons.map((lesson, idx) => (
              <LessonTimelineCard
                key={lesson.id}
                lesson={lesson}
                index={idx}
                isNext={data.nextLesson?.id === lesson.id}
                onOpen={() => openLesson(lesson)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============ Footer note ============ */}
      <p className="border-t border-border pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        Konten edukatif & informasional — bukan nasihat keuangan berizin.
        Keputusan investasi sepenuhnya menjadi tanggung jawab Anda. FinBest AI
        bersifat non-diskrisioner.
      </p>

      {/* ============ Lesson Detail Dialog ============ */}
      <LessonDetailDialog
        lesson={selectedLesson}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prereqHint={selectedLesson ? getPrereqHint(selectedLesson) : null}
        onCompleted={fetchLessons}
      />
    </div>
  )
}
