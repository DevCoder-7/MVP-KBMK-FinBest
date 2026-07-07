'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  type ReactNode,
} from 'react'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Sparkles,
  Send,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  ExternalLink,
  Brain,
  Shield,
  Plus,
  Trash2,
  Menu,
  MessageSquare,
  AlertTriangle,
  ChevronRight,
  FileText,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  LineChart,
  Calculator,
  Leaf,
  PieChart,
  Target,
  Search,
  GraduationCap,
  ArrowRight,
  Clock,
  Wrench,
  Newspaper,
  Lightbulb,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatRelativeTime, DISCLAIMER } from '@/lib/utils-finance'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface Citation {
  id: string
  title: string
  source: string
  snippet: string
  similarity: number
  type: 'knowledge' | 'market'
  url?: string
  category?: string
}

interface BiasItem {
  type:
    | 'FOMO'
    | 'HERDING'
    | 'OVERCONFIDENCE'
    | 'LOSS_AVERSION'
    | 'ANCHORING'
    | 'NONE'
  confidence: number
  evidence: string
  intervention: string
}

interface BiasDetection {
  biases: BiasItem[]
  hasBias: boolean
}

interface ToolResult {
  tool: string
  query: string
  result: unknown
  sources?: { title: string; url?: string; snippet: string }[]
}

interface FundamentalData {
  per?: number
  pbv?: number
  roe?: number
  der?: number
  marketCap?: string
  sector?: string
}

interface StockAnalysis {
  ticker: string
  name?: string
  currentPrice?: number
  priceChange?: number
  fundamentalData?: FundamentalData
  news?: { title: string; snippet: string; url: string; date?: string }[]
  analysis: string
  sources: { title: string; url: string; snippet: string }[]
}

interface LearningPathItem {
  title: string
  description: string
  difficulty: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  confidence?: number
  intent?: string
  hasAdequateReferences?: boolean
  biasDetection?: BiasDetection
  toolsCalled?: ToolResult[]
  stockAnalysis?: StockAnalysis
  learningPath?: LearningPathItem[]
  feedback?: 'up' | 'down' | null
  feedbackNote?: string | null
  createdAt: string
}

interface ChatSessionSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

interface TemplateQ {
  id: string
  text: string
  category: string
  icon: string
}

// ============================================================
// Constants & helpers
// ============================================================

const BIAS_LABELS: Record<string, string> = {
  FOMO: 'Fear of Missing Out',
  HERDING: 'Herding / Ikut Massa',
  OVERCONFIDENCE: 'Overconfidence',
  LOSS_AVERSION: 'Loss Aversion',
  ANCHORING: 'Anchoring',
  NONE: 'Tidak Ada',
}

const INTENT_META: Record<
  string,
  { label: string; cls: string }
> = {
  faktual: {
    label: 'Faktual',
    cls: 'border-primary/30 bg-primary/5 text-primary',
  },
  analitik: {
    label: 'Analitik',
    cls: 'border-gold/40 bg-gold/10 text-gold-foreground',
  },
  opini: {
    label: 'Opini',
    cls: 'border-rose-300/60 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
  },
  regulasi: {
    label: 'Regulasi',
    cls: 'border-primary/30 bg-primary/5 text-primary',
  },
  edukatif: {
    label: 'Edukatif',
    cls: 'border-border bg-secondary text-secondary-foreground',
  },
}

function getConfidenceTier(conf: number): {
  tier: 'HIGH' | 'MEDIUM' | 'LOW'
  cls: string
  label: string
} {
  if (conf >= 0.8)
    return {
      tier: 'HIGH',
      cls: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
      label: 'Tinggi',
    }
  if (conf >= 0.6)
    return {
      tier: 'MEDIUM',
      cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
      label: 'Sedang',
    }
  return {
    tier: 'LOW',
    cls: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
    label: 'Rendah',
  }
}

function getCitationTier(sim: number): {
  cls: string
  label: string
} {
  if (sim >= 0.8)
    return {
      cls: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
      label: 'HIGH',
    }
  if (sim >= 0.65)
    return {
      cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
      label: 'MEDIUM',
    }
  return {
    cls: 'border-border bg-muted text-muted-foreground',
    label: 'LOW',
  }
}

const TOOL_META: Record<
  string,
  { label: string; icon: typeof Search }
> = {
  knowledge_retrieval: { label: 'Basis Pengetahuan', icon: BookOpen },
  search_market: { label: 'Pencarian Pasar', icon: Search },
  analyze_stock: { label: 'Analisis Saham', icon: LineChart },
  check_portfolio: { label: 'Cek Portofolio', icon: PieChart },
  get_learning_path: { label: 'Saran Pelajaran', icon: GraduationCap },
  detect_bias: { label: 'Deteksi Bias', icon: Brain },
}

const TEMPLATE_ICONS: Record<string, typeof BookOpen> = {
  BookOpen,
  LineChart,
  Brain,
  Calculator,
  Leaf,
  PieChart,
  Target,
}

// ============================================================
// Markdown inline citation rendering
// ============================================================

function renderInlineCitations(
  node: ReactNode,
  onCitationClick?: (n: number) => void
): ReactNode {
  if (typeof node === 'string') {
    const parts = node.split(/(\[\d+\])/g)
    if (parts.length === 1) return node
    return parts.map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/)
      if (m) {
        const n = parseInt(m[1], 10)
        return (
          <button
            key={`cite-${i}`}
            type="button"
            className="citation-badge align-super"
            onClick={(e) => {
              e.preventDefault()
              onCitationClick?.(n)
            }}
            aria-label={`Lihat referensi ${n}`}
          >
            {n}
          </button>
        )
      }
      return <Fragment key={`txt-${i}`}>{part}</Fragment>
    })
  }
  if (Array.isArray(node)) return node.map((n, i) => renderInlineCitations(n, onCitationClick))
  return node
}

const MARKDOWN_COMPONENTS = (
  onCitationClick?: (n: number) => void
) => ({
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-3 leading-relaxed last:mb-0 [&>strong:first-child]:font-serif [&>strong:first-child]:text-base">
      {renderInlineCitations(children, onCitationClick)}
    </p>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-3 font-serif text-base font-semibold">{children}</h3>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-3 font-serif text-base font-semibold">{children}</h3>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h4 className="mb-1.5 mt-2 text-sm font-semibold">{children}</h4>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-relaxed">{renderInlineCitations(children, onCitationClick)}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-accent px-1 py-0.5 text-[12px] font-mono text-accent-foreground">
      {children}
    </code>
  ),
  a: ({
    href,
    children,
  }: {
    href?: string
    children?: ReactNode
  }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <Separator className="my-3" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 max-h-72 overflow-auto rounded-md border scrollbar-custom">
      <table className="w-full min-w-[560px] text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b bg-muted/50 px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b px-3 py-2">{children}</td>
  ),
})

// ============================================================
// Typing indicator with cycling status text
// ============================================================

const TYPING_STATUSES = [
  'Mengambil referensi knowledge base...',
  'Menganalisis konteks pasar...',
  'Memeriksa bias kognitif...',
  'Menyusun jawaban edukatif...',
]

function TypingIndicator() {
  const [statusIdx, setStatusIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setStatusIdx((i) => (i + 1) % TYPING_STATUSES.length)
    }, 1800)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-pine">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-end gap-1">
            <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
            <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
            <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
          </span>
          <span className="text-xs text-muted-foreground">
            {TYPING_STATUSES[statusIdx]}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function DisclaimerBox() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        <span className="font-semibold">Disclaimer:</span> Konten ini bersifat
        edukatif, bukan rekomendasi transaksi. Keputusan investasi sepenuhnya
        di tangan Anda.
      </p>
    </div>
  )
}

function BiasDetectionBanner({ bias }: { bias: BiasDetection }) {
  if (!bias.hasBias) return null
  return (
    <div className="mb-3 space-y-2">
      {bias.biases.map((b, i) => (
        <div
          key={`bias-${i}`}
          className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <Brain className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-serif text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Bias Terdeteksi: {b.type}
                </h4>
                <span className="bias-tag bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                  {BIAS_LABELS[b.type] || b.type}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-200/70 dark:bg-amber-900/40">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${Math.round(b.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  {Math.round(b.confidence * 100)}% keyakinan
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                {b.intervention}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ToolsCalledRow({ tools }: { tools: ToolResult[] }) {
  if (!tools || tools.length === 0) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Analisis dipakai:
      </span>
      {tools.map((t, i) => {
        const meta = TOOL_META[t.tool] || { label: t.tool, icon: Wrench }
        const Icon = meta.icon
        const label =
          t.tool === 'analyze_stock'
            ? `Analisis ${t.query}`
            : meta.label
        return (
          <span key={`tool-${i}`} className="tool-call-pill">
            <Icon className="h-3 w-3" />
            {label}
          </span>
        )
      })}
    </div>
  )
}

function StockAnalysisCard({ analysis }: { analysis: StockAnalysis }) {
  const fd = analysis.fundamentalData || {}
  const priceUp = (analysis.priceChange ?? 0) >= 0
  const metrics: { label: string; value?: string | number }[] = [
    { label: 'PER', value: fd.per ? fd.per.toFixed(1) + 'x' : undefined },
    { label: 'PBV', value: fd.pbv ? fd.pbv.toFixed(2) + 'x' : undefined },
    { label: 'ROE', value: fd.roe ? fd.roe.toFixed(1) + '%' : undefined },
    { label: 'DER', value: fd.der ? fd.der.toFixed(2) : undefined },
    { label: 'Kapitalisasi', value: fd.marketCap },
    { label: 'Sektor', value: fd.sector },
  ].filter((m) => m.value !== undefined)

  return (
    <Card className="mb-3 overflow-hidden border-primary/30 bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-semibold text-foreground">
                {analysis.ticker}
              </span>
              {analysis.name && (
                <span className="truncate text-xs text-muted-foreground">
                  · {analysis.name}
                </span>
              )}
            </div>
            <CardDescription className="mt-1 flex items-center gap-2">
              <LineChart className="h-3 w-3" />
              Analisis Saham
            </CardDescription>
          </div>
          {analysis.currentPrice !== undefined && (
            <div className="shrink-0 text-right">
              <div className="font-mono text-sm font-semibold text-foreground">
                Rp {analysis.currentPrice.toLocaleString('id-ID')}
              </div>
              {analysis.priceChange !== undefined && (
                <div
                  className={cn(
                    'text-xs font-medium',
                    priceUp ? 'text-success' : 'text-destructive'
                  )}
                >
                  {priceUp ? '+' : ''}
                  {analysis.priceChange.toFixed(2)}%
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {metrics.map((m, i) => (
              <div key={i} className="overflow-hidden rounded-md border bg-muted/30 px-2 py-1.5">
                <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </div>
                <div className="truncate font-mono text-xs font-medium text-foreground">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}
        {analysis.news && analysis.news.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Newspaper className="h-3 w-3" />
              Berita Terkini
            </div>
            <ul className="space-y-1.5">
              {analysis.news.slice(0, 3).map((n, i) => (
                <li key={i} className="text-xs">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-1.5 hover:text-primary"
                  >
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2 text-foreground/80 group-hover:text-primary">
                      {n.title}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.sources && analysis.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-t pt-2">
            <span className="text-[10px] text-muted-foreground">Sumber:</span>
            {analysis.sources.slice(0, 3).map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                {i + 1}
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LearningPathList({ items }: { items: LearningPathItem[] }) {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  if (!items || items.length === 0) return null
  const difficultyColor = (d: string) => {
    const dl = d.toLowerCase()
    if (dl.includes('pemula') || dl.includes('beginner'))
      return 'border-primary/30 bg-primary/5 text-primary'
    if (dl.includes('lanjut') || dl.includes('advanced'))
      return 'border-destructive/30 bg-destructive/5 text-destructive'
    return 'border-warning/30 bg-warning/5 text-warning'
  }
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center gap-1.5">
        <GraduationCap className="h-3.5 w-3.5 text-gold" />
        <span className="font-serif text-xs font-semibold text-foreground">
          Saran Learning Path
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((l, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveTab('edukasi')}
            className="group flex w-full items-start gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-left transition-colors hover:border-gold/50 hover:bg-gold/10"
          >
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{l.title}</span>
                <span
                  className={cn(
                    'rounded border px-1.5 py-0 text-[9px] font-medium',
                    difficultyColor(l.difficulty)
                  )}
                >
                  {l.difficulty}
                </span>
              </div>
              {l.description && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {l.description}
                </p>
              )}
            </div>
            <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  )
}

function CitationsList({
  citations,
  messageId,
}: {
  citations: Citation[]
  messageId: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (!citations || citations.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-3" data-citation-list>
      <div className="mb-2 flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        <span className="font-serif text-xs font-semibold text-foreground">
          Referensi ({citations.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {citations.map((c, i) => {
          const isOpen = openId === c.id
          const tier = getCitationTier(c.similarity)
          return (
            <div
              key={c.id}
              data-citation-idx={i + 1}
              data-message-id={messageId}
              className="overflow-hidden rounded-md border bg-background transition-shadow"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(isOpen ? null : c.id)
                }}
                className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-accent/40 transition-colors"
              >
                <Badge
                  variant="outline"
                  className="mt-0.5 shrink-0 border-primary/30 bg-primary/10 text-primary"
                >
                  {i + 1}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-medium text-foreground">
                    {c.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {c.source}
                    </span>
                    {c.type === 'market' ? (
                      <Badge
                        variant="outline"
                        className="h-3.5 px-1 text-[9px] font-medium text-gold-foreground border-gold/40 bg-gold/10"
                      >
                        Web
                      </Badge>
                    ) : (
                      c.category && (
                        <Badge
                          variant="outline"
                          className="h-3.5 px-1 text-[9px] font-medium border-primary/30 bg-primary/5 text-primary"
                        >
                          {c.category}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn('text-[9px] font-medium', tier.cls)}
                  >
                    {tier.label} {Math.round(c.similarity * 100)}%
                  </Badge>
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform',
                      isOpen && 'rotate-90'
                    )}
                  />
                </div>
              </button>
              {isOpen && (
                <div className="border-t bg-muted/30 px-3 py-2 text-xs">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cuplikan
                  </p>
                  <p className="leading-relaxed text-foreground/80">{c.snippet}</p>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      Buka sumber asli
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InadequateWarning() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
      <p>
        <span className="font-semibold text-warning">Referensi memadai tidak ditemukan.</span>{' '}
        Jawaban ini mungkin kurang akurat. Pertimbangkan untuk mengubah pertanyaan
        atau berkonsultasi dengan sumber resmi.
      </p>
    </div>
  )
}

function ConfidenceIntentRow({
  confidence,
  intent,
}: {
  confidence?: number
  intent?: string
}) {
  if (confidence === undefined && !intent) return null
  const confTier =
    confidence !== undefined ? getConfidenceTier(confidence) : null
  const intentMeta = intent ? INTENT_META[intent.toLowerCase()] : null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {confTier && (
        <Badge
          variant="outline"
          className={cn('text-[10px] font-medium', confTier.cls)}
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          Keyakinan {confTier.label} ({Math.round((confidence ?? 0) * 100)}%)
        </Badge>
      )}
      {intent && (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-medium',
            intentMeta?.cls || 'border-border bg-muted text-muted-foreground'
          )}
        >
          <FileText className="h-2.5 w-2.5" />
          {intentMeta?.label || intent}
        </Badge>
      )}
    </div>
  )
}

function FeedbackBar({
  message,
  onFeedback,
}: {
  message: Message
  onFeedback: (
    messageId: string,
    feedback: 'up' | 'down',
    note?: string
  ) => Promise<void>
}) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState(message.feedbackNote || '')
  const [submitting, setSubmitting] = useState(false)
  const [localFeedback, setLocalFeedback] = useState<'up' | 'down' | null>(
    message.feedback || null
  )

  const handle = async (fb: 'up' | 'down') => {
    if (submitting) return
    if (fb === 'down') {
      setShowNote(true)
      setLocalFeedback('down')
      // submit immediately; user can add note later
      if (localFeedback !== 'down') {
        setSubmitting(true)
        await onFeedback(message.id, 'down')
        setSubmitting(false)
      }
      return
    }
    setSubmitting(true)
    setLocalFeedback('up')
    await onFeedback(message.id, 'up')
    setSubmitting(false)
    setShowNote(false)
  }

  const submitNote = async () => {
    setSubmitting(true)
    await onFeedback(message.id, 'down', note.trim() || undefined)
    setSubmitting(false)
    setShowNote(false)
    toast.success('Terima kasih atas feedback', {
      description: 'Masukan Anda membantu kami meningkatkan kualitas jawaban.',
    })
  }

  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          Apakah jawaban ini membantu?
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'h-6 w-6',
              localFeedback === 'up' && 'bg-primary/10 text-primary'
            )}
            onClick={() => handle('up')}
            disabled={submitting}
            aria-label="Feedback positif"
          >
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'h-6 w-6',
              localFeedback === 'down' && 'bg-destructive/10 text-destructive'
            )}
            onClick={() => handle('down')}
            disabled={submitting}
            aria-label="Feedback negatif"
          >
            <ThumbsDown className="h-3 w-3" />
          </Button>
        </div>
        {submitting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <AnimatePresence>
        {showNote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2"
          >
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan tambahan (opsional) — apa yang bisa diperbaiki?"
              className="min-h-[60px] resize-none text-xs"
              rows={2}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNote(false)
                  setNote('')
                }}
                className="h-7"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={submitNote}
                disabled={submitting}
                className="h-7"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Kirim Catatan'
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================
// Message bubble
// ============================================================

function MessageBubble({
  message,
  onFeedback,
}: {
  message: Message
  onFeedback: (
    messageId: string,
    feedback: 'up' | 'down',
    note?: string
  ) => Promise<void>
}) {
  const isUser = message.role === 'user'

  const handleCitationClick = useCallback(
    (n: number) => {
      const selector = `[data-message-id="${message.id}"][data-citation-idx="${n}"]`
      const el = document.querySelector<HTMLElement>(selector)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-gold')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-gold')
        }, 1500)
      }
    },
    [message.id]
  )

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="max-w-[min(82%,42rem)] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-w-0 items-start gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-pine">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden rounded-2xl rounded-tl-sm border bg-card px-4 py-3 shadow-sm">
          {message.biasDetection && message.biasDetection.hasBias && (
            <BiasDetectionBanner bias={message.biasDetection} />
          )}
          {message.toolsCalled && message.toolsCalled.length > 0 && (
            <ToolsCalledRow tools={message.toolsCalled} />
          )}
          {message.stockAnalysis && (
            <StockAnalysisCard analysis={message.stockAnalysis} />
          )}
          {message.learningPath && message.learningPath.length > 0 && (
            <LearningPathList items={message.learningPath} />
          )}
          <div className="prose prose-sm max-w-none break-words text-sm text-foreground/90 dark:prose-invert">
            <ReactMarkdown components={MARKDOWN_COMPONENTS(handleCitationClick)}>
              {message.content}
            </ReactMarkdown>
          </div>
          {message.hasAdequateReferences === false && <InadequateWarning />}
          {(message.confidence !== undefined || message.intent) && (
            <ConfidenceIntentRow
              confidence={message.confidence}
              intent={message.intent}
            />
          )}
          {message.citations && message.citations.length > 0 && (
            <CitationsList citations={message.citations} messageId={message.id} />
          )}
          <DisclaimerBox />
          <FeedbackBar message={message} onFeedback={onFeedback} />
        </div>
        <div className="mt-1 px-1 text-[10px] text-muted-foreground">
          {formatRelativeTime(message.createdAt)}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================
// Empty state
// ============================================================

const FEATURE_CARDS = [
  {
    icon: LineChart,
    title: 'Analisis Saham',
    example: 'Analisis saham BBCA',
    desc: 'Analisis fundamental + berita terkini',
    accent: 'text-primary',
  },
  {
    icon: Brain,
    title: 'Deteksi Bias',
    example: 'Saham GOTO naik gila, harus beli?',
    desc: 'Identifikasi FOMO, herding, loss aversion',
    accent: 'text-warning',
  },
  {
    icon: BookOpen,
    title: 'Edukasi Investasi',
    example: 'Apa itu DCA?',
    desc: '18 dokumen terkurasi OJK + ESG',
    accent: 'text-gold',
  },
  {
    icon: Target,
    title: 'Evaluasi Portofolio',
    example: 'Evaluasi portofolio saya',
    desc: 'Analisis alokasi vs target + sektor',
    accent: 'text-primary',
  },
]

function EmptyState({
  templates,
  onPick,
}: {
  templates: TemplateQ[]
  onPick: (text: string) => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-8 sm:px-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex h-16 w-16 items-center justify-center rounded-full gradient-pine shadow-md"
      >
        <Sparkles className="h-8 w-8 text-primary-foreground" />
      </motion.div>
      <h2 className="mt-5 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Halo! Saya FinBest AI
      </h2>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        Mentor investasi 24/7 Anda. Saya dapat menganalisis saham, mendeteksi
        bias kognitif, dan memberi edukasi investasi berbasis data pasar
        real-time.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURE_CARDS.map((f, i) => {
          const Icon = f.icon
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(f.example)}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted',
                  f.accent
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-sm font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
                <p className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-primary opacity-80 group-hover:opacity-100">
                  <Search className="h-2.5 w-2.5" />
                  <span className="truncate">Tanya: &ldquo;{f.example}&rdquo;</span>
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {templates.length > 0 && (
        <div className="mt-8 w-full">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="h-3 w-3" />
            Pertanyaan populer
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.slice(0, 6).map((t) => {
              const Icon = TEMPLATE_ICONS[t.icon] || BookOpen
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPick(t.text)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <Icon className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                  <span className="max-w-[280px] truncate">{t.text}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Input area
// ============================================================

function InputArea({
  value,
  onChange,
  onSend,
  loading,
  templates,
  onPickTemplate,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  loading: boolean
  templates: TemplateQ[]
  onPickTemplate: (text: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!loading && value.trim()) onSend()
    }
  }

  return (
    <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {/* Template chips - horizontal scroll on mobile */}
      {templates.length > 0 && (
        <div className="mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto px-3 pt-2 pb-1 scrollbar-custom sm:px-4">
          {templates.slice(0, 6).map((t) => {
            const Icon = TEMPLATE_ICONS[t.icon] || BookOpen
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPickTemplate(t.text)}
                disabled={loading}
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <Icon className="h-2.5 w-2.5 text-muted-foreground group-hover:text-primary" />
                <span className="max-w-[min(58vw,200px)] truncate">{t.text}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="mx-auto flex w-full max-w-4xl items-end gap-2 p-2.5 sm:p-4">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanyakan seputar investasi..."
          className="max-h-36 min-h-[44px] min-w-0 flex-1 resize-none overflow-y-auto border-border bg-card text-sm"
          rows={1}
          disabled={loading}
        />
        <Button
          type="button"
          size="icon"
          onClick={onSend}
          disabled={loading || !value.trim()}
          className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
          aria-label="Kirim pesan"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Session sidebar (shared between desktop and mobile Sheet)
// ============================================================

function SessionList({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onDelete,
  onCreate,
}: {
  sessions: ChatSessionSummary[]
  activeSessionId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onCreate: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-3">
        <Button
          type="button"
          onClick={onCreate}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Sesi Baru
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">
                Belum ada sesi.
                <br />
                Mulai percakapan baru.
              </p>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'group flex min-w-0 items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent',
                  activeSessionId === s.id && 'bg-accent'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={cn(
                      'truncate text-xs font-medium',
                      activeSessionId === s.id
                        ? 'text-primary'
                        : 'text-foreground'
                    )}
                  >
                    {s.title}
                  </p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{formatRelativeTime(s.updatedAt)}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">{s.messageCount} pesan</span>
                  </div>
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Hapus sesi"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus sesi ini?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sesi &ldquo;{s.title}&rdquo; beserta seluruh {s.messageCount}{' '}
                        pesan akan dihapus permanen. Tindakan ini tidak dapat
                        dibatalkan (sesuai UU PDP No. 27/2022).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(s.id)}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================
// Right context panel
// ============================================================

function ContextPanel({
  messages,
  onClose,
}: {
  messages: Message[]
  onClose?: () => void
}) {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const totalTools =
    messages.reduce(
      (sum, m) => sum + (m.toolsCalled?.length || 0),
      0
    ) || 0
  const totalBiases =
    messages.filter((m) => m.biasDetection?.hasBias).length || 0
  const totalCitations =
    messages.reduce(
      (sum, m) => sum + (m.citations?.length || 0),
      0
    ) || 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-3 py-2.5">
        <div className="min-w-0">
          <span className="block truncate font-serif text-sm font-semibold">
            Konteks
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            Sumber, tools, dan statistik sesi
          </span>
        </div>
        {onClose && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Tutup panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {/* About card */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-sm">
                <Sparkles className="h-4 w-4 text-gold" />
                Tentang AI FinBest
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Sumber pengetahuan.</strong>{' '}
                  Basis pengetahuan terkurasi, data pasar, portofolio, &amp;
                  deteksi bias.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
                <span>
                  <strong className="text-foreground">Analisis otomatis.</strong>{' '}
                  Pencarian pasar, analisis saham, dan saran pelajaran.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Brain className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                <span>
                  <strong className="text-foreground">Deteksi bias.</strong>{' '}
                  FOMO, herding, overconfidence, loss aversion, anchoring.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Shield className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Non-diskrisioner.</strong>{' '}
                  Tidak ada eksekusi transaksi. Hanya edukasi & analisis.
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Session stats */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-sm">
                Statistik Sesi
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pesan
                </div>
                <div className="font-mono text-sm font-semibold text-foreground">
                  {messages.length}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Tools
                </div>
                <div className="font-mono text-sm font-semibold text-foreground">
                  {totalTools}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Referensi
                </div>
                <div className="font-mono text-sm font-semibold text-foreground">
                  {totalCitations}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Bias
                </div>
                <div className="font-mono text-sm font-semibold text-foreground">
                  {totalBiases}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick link to Edukasi */}
          <button
            type="button"
            onClick={() => setActiveTab('edukasi')}
            className="group flex w-full items-center gap-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5 text-left transition-colors hover:border-gold/50 hover:bg-gold/10"
          >
            <GraduationCap className="h-5 w-5 shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Buka Edukasi
              </div>
              <div className="text-[10px] text-muted-foreground">
                Learning path adaptif + kuis
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Privacy note */}
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="mb-1 h-3 w-3 text-primary" />
            <p>
              Riwayat percakapan disimpan secara lokal dan dapat dihapus
              kapan saja sesuai UU PDP No. 27/2022.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================
// Main module
// ============================================================

export default function AIFinBestModule() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [templates, setTemplates] = useState<TemplateQ[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingQueryRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  const pendingAIQuery = useAppStore((s) => s.pendingAIQuery)
  const setPendingAIQuery = useAppStore((s) => s.setPendingAIQuery)

  // ---- Load sessions + templates on mount ----
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/ai-finbest/sessions')
      if (!res.ok) throw new Error('Gagal memuat sesi')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (e) {
      console.error('loadSessions:', e)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-finbest/templates')
      if (!res.ok) return
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (e) {
      console.error('loadTemplates:', e)
    }
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    loadSessions()
    loadTemplates()
  }, [loadSessions, loadTemplates])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)')
    const syncPanel = () => setPanelOpen(media.matches)
    syncPanel()
    media.addEventListener('change', syncPanel)
    return () => media.removeEventListener('change', syncPanel)
  }, [])

  // ---- Create new session ----
  const createSession = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-finbest/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Sesi Baru' }),
      })
      if (!res.ok) throw new Error('Gagal membuat sesi')
      await loadSessions()
      const data = await res.json()
      if (data.session?.id) {
        setActiveSessionId(data.session.id)
        setMessages([])
      }
      setSheetOpen(false)
    } catch (e) {
      console.error('createSession:', e)
      toast.error('Gagal membuat sesi baru')
    }
  }, [loadSessions])

  // ---- Load session messages ----
  const loadSession = useCallback(
    async (id: string) => {
      setMessagesLoading(true)
      setActiveSessionId(id)
      setSheetOpen(false)
      try {
        const res = await fetch(`/api/ai-finbest/sessions/${id}`)
        if (!res.ok) throw new Error('Gagal memuat sesi')
        const data = await res.json()
        setMessages(
          (data.messages || []).map((m: Message) => ({
            ...m,
            // Loaded historical messages may not have rich fields — that's OK
          }))
        )
      } catch (e) {
        console.error('loadSession:', e)
        toast.error('Gagal memuat pesan sesi')
        setMessages([])
      } finally {
        setMessagesLoading(false)
      }
    },
    []
  )

  // ---- Delete session ----
  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/ai-finbest/sessions/${id}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Gagal menghapus sesi')
        toast.success('Sesi dihapus', {
          description: 'Sesuai UU PDP, data Anda telah dihapus permanen.',
        })
        if (activeSessionId === id) {
          setActiveSessionId(null)
          setMessages([])
        }
        await loadSessions()
      } catch (e) {
        console.error('deleteSession:', e)
        toast.error('Gagal menghapus sesi')
      }
    },
    [activeSessionId, loadSessions]
  )

  // ---- Send message ----
  const sendMessage = useCallback(
    async (text: string) => {
      const query = text.trim()
      if (!query || sending) return

      setError(null)
      setSending(true)
      setInput('')

      // Optimistic user message
      const tempUserId = `temp-user-${Date.now()}`
      const optimisticUser: Message = {
        id: tempUserId,
        role: 'user',
        content: query,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimisticUser])

      try {
        const res = await fetch('/api/ai-finbest/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId || undefined,
            query,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Gagal mengirim pesan')
        }
        const data = await res.json()

        // Update active session id
        if (data.sessionId && data.sessionId !== activeSessionId) {
          setActiveSessionId(data.sessionId)
        }

        // Replace optimistic user message with persisted one, append assistant
        setMessages((prev) => [
          ...prev.map((m) =>
            m.id === tempUserId
              ? {
                  ...m,
                  id: data.userMessage.id,
                  createdAt: data.userMessage.createdAt,
                }
              : m
          ),
          data.assistantMessage as Message,
        ])

        // Refresh sessions list (to update message count + last activity)
        loadSessions()
      } catch (e) {
        console.error('sendMessage:', e)
        const msg = e instanceof Error ? e.message : 'Gagal mengirim pesan'
        setError(msg)
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempUserId))
        toast.error('Gagal mengirim pesan', { description: msg })
      } finally {
        setSending(false)
      }
    },
    [activeSessionId, sending, loadSessions]
  )

  // ---- pendingAIQuery auto-send (must come after sendMessage) ----
  useEffect(() => {
    if (pendingAIQuery && pendingAIQuery !== pendingQueryRef.current) {
      const q = pendingAIQuery
      pendingQueryRef.current = q
      setPendingAIQuery(null)
      const timer = window.setTimeout(() => {
        void sendMessage(q)
        pendingQueryRef.current = null
      }, 100)

      return () => window.clearTimeout(timer)
    }
  }, [pendingAIQuery, setPendingAIQuery, sendMessage])

  // ---- Feedback ----
  const handleFeedback = useCallback(
    async (messageId: string, feedback: 'up' | 'down', note?: string) => {
      try {
        const res = await fetch('/api/ai-finbest/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, feedback, note }),
        })
        if (!res.ok) throw new Error('Gagal menyimpan feedback')
        // Local update
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, feedback, feedbackNote: note || m.feedbackNote }
              : m
          )
        )
        if (feedback === 'up') {
          toast.success('Terima kasih atas feedback', {
            description: 'Masukan Anda membantu kami meningkatkan kualitas jawaban.',
          })
        }
      } catch (e) {
        console.error('handleFeedback:', e)
        toast.error('Gagal menyimpan feedback')
      }
    },
    []
  )

  // ---- Auto scroll to bottom on new messages ----
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, sending])

  // ---- Helpers ----
  const handleSend = () => sendMessage(input)
  const handlePickTemplate = (text: string) => {
    sendMessage(text)
  }
  const handlePickFromEmpty = (text: string) => {
    sendMessage(text)
  }

  const showEmptyState = messages.length === 0 && !sending && !messagesLoading

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-0 max-w-full overflow-hidden bg-background text-foreground lg:h-[calc(100dvh-4rem)]">
      {/* ============ Desktop sidebar ============ */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:block xl:w-72">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-muted p-0.5">
              <img src="/logo.svg" alt="FinBest" className="h-full w-full rounded object-cover" />
            </div>
            <div className="min-w-0">
              <div className="font-serif text-sm font-semibold leading-tight">
                AI FinBest
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                Mentor investasi 24/7
              </div>
            </div>
          </div>
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            loading={sessionsLoading}
            onSelect={loadSession}
            onDelete={deleteSession}
            onCreate={createSession}
          />
        </div>
      </aside>

      {/* ============ Center column ============ */}
      <div className="flex min-w-0 flex-1 flex-col bg-paper">
        {/* Mobile top bar */}
        <div className="flex shrink-0 items-center justify-between border-b bg-background px-3 py-2 lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Menu className="h-4 w-4" />
                Sesi
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-80 max-w-[88vw] flex-col p-0">
              <SheetHeader className="shrink-0 border-b">
                <SheetTitle className="flex items-center gap-2 font-serif">
                  <Sparkles className="h-4 w-4 text-gold" />
                  AI FinBest
                </SheetTitle>
                <SheetDescription>
                  Riwayat percakapan Anda
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-hidden">
                <SessionList
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  loading={sessionsLoading}
                  onSelect={loadSession}
                  onDelete={deleteSession}
                  onCreate={createSession}
                />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setPanelOpen((v) => !v)}
            >
              {panelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden shrink-0 items-center justify-between border-b bg-background px-4 py-2 lg:flex">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="truncate font-serif text-sm font-semibold">
              {activeSessionId
                ? sessions.find((s) => s.id === activeSessionId)?.title ||
                  'Percakapan'
                : 'Percakapan Baru'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setPanelOpen((v) => !v)}
          >
            {panelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
            {panelOpen ? 'Sembunyikan' : 'Tampilkan'} Panel
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <Alert variant="destructive" className="m-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Terjadi kesalahan</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Message stream */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-custom">
          {messagesLoading ? (
            <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-2/3 ml-auto" />
            </div>
          ) : showEmptyState ? (
            <EmptyState templates={templates} onPick={handlePickFromEmpty} />
          ) : (
            <div className="mx-auto w-full max-w-4xl space-y-4 p-3 sm:p-4">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onFeedback={handleFeedback}
                  />
                ))}
              </AnimatePresence>
              {sending && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Input area */}
        <InputArea
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={sending}
          templates={templates}
          onPickTemplate={handlePickTemplate}
        />
      </div>

      {/* ============ Right context panel (desktop) ============ */}
      {panelOpen && (
        <aside className="hidden w-72 shrink-0 border-l bg-background xl:block 2xl:w-80">
          <ContextPanel messages={messages} />
        </aside>
      )}

      {/* ============ Right context panel (mobile, Sheet-like overlay) ============ */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed bottom-20 right-0 top-16 z-40 flex w-[min(22rem,calc(100vw-1rem))] overflow-hidden border-l bg-background shadow-xl xl:hidden"
          >
            <ContextPanel
              messages={messages}
              onClose={() => setPanelOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
