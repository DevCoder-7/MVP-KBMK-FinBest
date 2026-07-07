'use client'

import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
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
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
  Info,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Quote,
  ShieldCheck,
} from 'lucide-react'
import { formatRelativeTime, DISCLAIMER } from '@/lib/utils-finance'
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
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  confidence?: number
  intent?: string
  hasAdequateReferences?: boolean
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
}

// ============================================================
// Helpers
// ============================================================

const INTENT_META: Record<
  string,
  { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }
> = {
  faktual: {
    label: 'Faktual',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    icon: FileText,
  },
  analitik: {
    label: 'Analitik',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    icon: Brain,
  },
  opini: {
    label: 'Opini',
    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-900',
    icon: Quote,
  },
  regulasi: {
    label: 'Regulasi',
    cls: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-900',
    icon: Shield,
  },
  edukatif: {
    label: 'Edukatif',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    icon: BookOpen,
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
      cls: 'bg-emerald-500 text-white',
      label: 'Tinggi',
    }
  if (conf >= 0.6)
    return {
      tier: 'MEDIUM',
      cls: 'bg-amber-500 text-white',
      label: 'Sedang',
    }
  return { tier: 'LOW', cls: 'bg-rose-500 text-white', label: 'Rendah' }
}

/** Detect guardrail-triggered response */
function isGuardrailMessage(content: string): boolean {
  return content.startsWith('⚠️ **Peringatan Guardrail**')
}

// ============================================================
// Inline citation renderer (turns [1] → superscript badge)
// ============================================================

function renderInlineCitations(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') {
    const parts = node.split(/(\[\d+\])/g)
    if (parts.length === 1) return node
    return parts.map((part, i) => {
      if (/^\[\d+\]$/.test(part)) {
        return (
          <sup
            key={`cite-${i}`}
            className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700 align-super dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            {part.replace(/[\[\]]/g, '')}
          </sup>
        )
      }
      return <Fragment key={`txt-${i}`}>{part}</Fragment>
    })
  }
  if (Array.isArray(node)) return node.map((n, i) => renderInlineCitations(n))
  return node
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="leading-relaxed last:mb-0 [&:not(:last-child)]:mb-3">
      {renderInlineCitations(children)}
    </p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-1 text-base font-semibold">{children}</h3>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-1 text-base font-semibold">{children}</h3>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-1.5 mt-1 text-sm font-semibold">{children}</h4>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{renderInlineCitations(children)}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-accent px-1 py-0.5 text-[12px] font-mono text-accent-foreground">
      {children}
    </code>
  ),
  a: ({
    href,
    children,
  }: {
    href?: string
    children?: React.ReactNode
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
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-3 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
}

// ============================================================
// Sub-components
// ============================================================

function TypingIndicator({ statusText }: { statusText: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-emerald">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex items-end gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
          </span>
          <span className="text-xs text-muted-foreground">{statusText}</span>
        </div>
      </div>
    </div>
  )
}

function DisclaimerBox() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        <span className="font-semibold">Disclaimer:</span> Konten ini bersifat
        edukatif, bukan rekomendasi transaksi. Keputusan investasi sepenuhnya
        di tangan Anda.
      </p>
    </div>
  )
}

function CitationsList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (citations.length === 0) return null
  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-2">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        Referensi ({citations.length})
      </div>
      <div className="space-y-1">
        {citations.map((c, i) => {
          const isOpen = open === c.id
          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-md border bg-background"
            >
              <button
                onClick={() => setOpen(isOpen ? null : c.id)}
                className="flex w-full items-start gap-2 px-2.5 py-2 text-left text-xs hover:bg-accent/40 transition-colors"
              >
                <Badge
                  variant="outline"
                  className="mt-0.5 shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  {i + 1}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium text-foreground">
                    {c.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-muted-foreground">
                    {c.source}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px]',
                      c.similarity >= 0.8
                        ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300'
                        : c.similarity >= 0.65
                          ? 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300'
                          : 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300'
                    )}
                  >
                    {(c.similarity * 100).toFixed(0)}%
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
                  <p className="leading-relaxed text-foreground/80">
                    {c.snippet}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FeedbackBar({
  message,
  onFeedback,
}: {
  message: Message
  onFeedback: (messageId: string, feedback: 'up' | 'down', note?: string) => void
}) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')

  const handleUp = () => {
    onFeedback(message.id, 'up')
    setShowNote(false)
  }
  const handleDown = () => {
    if (message.feedback === 'down') {
      setShowNote(!showNote)
      return
    }
    setShowNote(true)
    onFeedback(message.id, 'down')
  }
  const submitNote = () => {
    onFeedback(message.id, 'down', note)
    setShowNote(false)
    setNote('')
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUp}
          className={cn(
            'h-7 gap-1 px-2 text-xs',
            message.feedback === 'up'
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Bermanfaat
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDown}
          className={cn(
            'h-7 gap-1 px-2 text-xs',
            message.feedback === 'down'
              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Kurang
        </Button>
      </div>
      {showNote && (
        <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">
            Bantu kami meningkatkan kualitas jawaban (opsional):
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan Anda..."
            className="min-h-[60px] resize-none text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setShowNote(false)
                setNote('')
              }}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={submitNote}
            >
              Kirim
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AssistantMessage({
  message,
  onFeedback,
}: {
  message: Message
  onFeedback: (messageId: string, feedback: 'up' | 'down', note?: string) => void
}) {
  const intent = message.intent ? INTENT_META[message.intent] : null
  const IntentIcon = intent?.icon ?? Sparkles
  const conf = message.confidence ?? 0
  const confTier = getConfidenceTier(conf)
  const guardrail = isGuardrailMessage(message.content)
  const inadequate =
    message.hasAdequateReferences === false && !guardrail

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-emerald">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            FinBest AI
          </span>
          {intent && (
            <Badge
              variant="outline"
              className={cn('gap-1 text-[10px]', intent.cls)}
            >
              <IntentIcon className="h-3 w-3" />
              {intent.label}
            </Badge>
          )}
          <Badge
            className={cn('gap-1 text-[10px] font-semibold', confTier.cls)}
            title={`Confidence ${(conf * 100).toFixed(0)}%`}
          >
            <Brain className="h-3 w-3" />
            {confTier.label} · {(conf * 100).toFixed(0)}%
          </Badge>
        </div>

        {guardrail ? (
          <Alert
            variant="destructive"
            className="border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <Shield className="h-4 w-4" />
            <AlertTitle className="text-rose-900 dark:text-rose-200">
              Guardrail Terpicu
            </AlertTitle>
            <AlertDescription className="text-rose-800 dark:text-rose-300">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div
            className={cn(
              'rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm',
              inadequate && 'border-amber-300 dark:border-amber-900/60'
            )}
          >
            <div className="prose prose-sm max-w-none text-foreground/90">
              <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                {message.content}
              </ReactMarkdown>
            </div>

            {inadequate && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Referensi memadai tidak ditemukan untuk pertanyaan ini
                  (similarity &lt; 0.65). Jawaban mungkin kurang akurat.
                </p>
              </div>
            )}

            {message.citations && message.citations.length > 0 && (
              <CitationsList citations={message.citations} />
            )}

            <DisclaimerBox />
          </div>
        )}

        {!guardrail && <FeedbackBar message={message} onFeedback={onFeedback} />}
      </div>
    </div>
  )
}

function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <span className="text-xs font-semibold">Anda</span>
      </div>
    </div>
  )
}

function EmptyState({
  templates,
  onPick,
}: {
  templates: TemplateQ[]
  onPick: (text: string) => void
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-none bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md dark:from-emerald-950/30 dark:to-teal-950/20">
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-emerald shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="mt-2 text-xl">
            Halo! Saya FinBest AI
          </CardTitle>
          <CardDescription className="text-sm">
            Asisten edukasi investasi non-diskrisioner Anda. Saya menjawab
            pertanyaan berbasis{' '}
            <span className="font-semibold text-foreground">
              Retrieval-Augmented Generation (RAG)
            </span>{' '}
            dari basis pengetahuan tepercaya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-2 rounded-lg border bg-background/60 p-3 text-xs">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Berbasis sumber:
                </span>{' '}
                Setiap klaim disertai citation [1][2] ke dokumen sumber.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border bg-background/60 p-3 text-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Non-diskrisioner:
                </span>{' '}
                Saya tidak mengeksekusi atau merekomendasikan transaksi
                spesifik.
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Coba pertanyaan ini
            </p>
            <div className="flex flex-col gap-1.5">
              {templates.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t.text)}
                  className="group flex items-center justify-between gap-2 rounded-lg border bg-background/70 px-3 py-2 text-left text-xs transition-all hover:border-primary/40 hover:bg-accent/40"
                >
                  <span className="flex-1 text-foreground">{t.text}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SessionItem({
  session,
  active,
  onClick,
  onDelete,
}: {
  session: ChatSessionSummary
  active: boolean
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group relative flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
        active
          ? 'bg-primary/10 ring-1 ring-primary/30'
          : 'hover:bg-accent/50'
      )}
    >
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 flex-col items-start text-left"
      >
        <div className="flex w-full items-center gap-1.5">
          <MessageSquare
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <span
            className={cn(
              'line-clamp-1 flex-1 text-xs font-medium',
              active ? 'text-primary' : 'text-foreground'
            )}
          >
            {session.title}
          </span>
        </div>
        <span className="mt-0.5 ml-5 text-[10px] text-muted-foreground">
          {formatRelativeTime(session.updatedAt)} · {session.messageCount}{' '}
          pesan
        </span>
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="absolute right-1.5 top-1.5 hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
            aria-label="Hapus sesi"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus sesi ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Sesi &ldquo;{session.title}&rdquo; beserta seluruh {session.messageCount}{' '}
              pesan akan dihapus permanen sesuai hak Anda di bawah UU PDP.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={onDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Main component
// ============================================================

export default function AIChatModule() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [includePortfolioContext, setIncludePortfolioContext] = useState(true)
  const [templates, setTemplates] = useState<TemplateQ[]>([])
  const [knowledgeStats, setKnowledgeStats] = useState<{
    count: number
    categories: { name: string; label: string }[]
  }>({ count: 0, categories: [] })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // ----------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch('/api/ai/sessions', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat sesi')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat daftar sesi')
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/templates', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchKnowledgeStats = useCallback(async () => {
    try {
      const res = await fetch('/api', { cache: 'no-store' })
      if (!res.ok) return
      // Just demonstrate we have access; categories are static labels
      setKnowledgeStats({
        count: 8,
        categories: [
          { name: 'regulations', label: 'Regulasi' },
          { name: 'education', label: 'Edukasi' },
          { name: 'financials', label: 'Laporan Keuangan' },
          { name: 'prospectus', label: 'Prospektus' },
        ],
      })
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadSession = useCallback(async (sessionId: string) => {
    setLoadingMessages(true)
    setMessages([])
    try {
      const res = await fetch(`/api/ai/sessions/${sessionId}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Gagal memuat sesi')
      const data = await res.json()
      setActiveSessionId(sessionId)
      setActiveSessionTitle(data.session?.title || '')
      setMessages(data.messages || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat pesan sesi')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // ----------------------------------------------------------
  // Effects
  // ----------------------------------------------------------

  useEffect(() => {
    fetchSessions()
    fetchTemplates()
    fetchKnowledgeStats()
  }, [fetchSessions, fetchTemplates, fetchKnowledgeStats])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  // Cleanup status interval
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
    }
  }, [])

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const startNewSession = useCallback(async () => {
    setActiveSessionId(null)
    setActiveSessionTitle('')
    setMessages([])
    setInput('')
    setMobileSessionsOpen(false)
  }, [])

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) {
        setMobileSessionsOpen(false)
        return
      }
      loadSession(sessionId)
      setMobileSessionsOpen(false)
    },
    [activeSessionId, loadSession]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch(`/api/ai/sessions/${sessionId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Gagal menghapus')
        if (sessionId === activeSessionId) {
          setActiveSessionId(null)
          setActiveSessionTitle('')
          setMessages([])
        }
        toast.success('Sesi berhasil dihapus')
        fetchSessions()
      } catch (e) {
        console.error(e)
        toast.error('Gagal menghapus sesi')
      }
    },
    [activeSessionId, fetchSessions]
  )

  const startStatusAnimation = useCallback(() => {
    setStatusText('Mengambil referensi...')
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
    statusIntervalRef.current = setInterval(() => {
      setStatusText((prev) =>
        prev === 'Mengambil referensi...'
          ? 'Menyusun jawaban...'
          : 'Mengambil referensi...'
      )
    }, 2200)
  }, [])

  const stopStatusAnimation = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = null
    }
    setStatusText('')
  }, [])

  const sendMessage = useCallback(
    async (query?: string) => {
      const text = (query ?? input).trim()
      if (!text || loading) return
      setInput('')
      stopStatusAnimation()

      // Optimistic: append user message + typing indicator
      const tempUserId = `temp-user-${Date.now()}`
      const optimisticUser: Message = {
        id: tempUserId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimisticUser])
      setLoading(true)
      startStatusAnimation()

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            query: text,
            includePortfolioContext,
          }),
        })
        if (!res.ok) throw new Error('Gagal mengirim pesan')
        const data = await res.json()

        // Replace temp user message with real one + add assistant
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserId),
          {
            id: data.userMessage.id,
            role: 'user',
            content: data.userMessage.content,
            createdAt: data.userMessage.createdAt,
          },
          {
            id: data.assistantMessage.id,
            role: 'assistant',
            content: data.assistantMessage.content,
            citations: data.assistantMessage.citations,
            confidence: data.assistantMessage.confidence,
            intent: data.assistantMessage.intent,
            hasAdequateReferences: data.assistantMessage.hasAdequateReferences,
            createdAt: data.assistantMessage.createdAt,
          },
        ])

        // Update active session if new
        if (!activeSessionId) {
          setActiveSessionId(data.sessionId)
        }
        // Refresh session list to reflect new/updated session + title
        fetchSessions()
        // Fetch session title
        if (!activeSessionId) {
          try {
            const sr = await fetch(`/api/ai/sessions/${data.sessionId}`, {
              cache: 'no-store',
            })
            if (sr.ok) {
              const sd = await sr.json()
              setActiveSessionTitle(sd.session?.title || text.slice(0, 40))
            }
          } catch {
            setActiveSessionTitle(text.slice(0, 40))
          }
        }
      } catch (e) {
        console.error(e)
        toast.error('Gagal mendapatkan respons AI. Silakan coba lagi.')
        // Remove optimistic user message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempUserId))
      } finally {
        setLoading(false)
        stopStatusAnimation()
      }
    },
    [
      input,
      loading,
      activeSessionId,
      includePortfolioContext,
      fetchSessions,
      startStatusAnimation,
      stopStatusAnimation,
    ]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  const handleFeedback = useCallback(
    async (messageId: string, feedback: 'up' | 'down', note?: string) => {
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, feedback, feedbackNote: note ?? m.feedbackNote }
            : m
        )
      )
      try {
        const res = await fetch('/api/ai/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, feedback, note }),
        })
        if (!res.ok) throw new Error('Gagal menyimpan feedback')
        toast.success('Terima kasih atas feedback Anda')
      } catch (e) {
        console.error(e)
        toast.error('Gagal menyimpan feedback')
        // Revert
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, feedback: null } : m
          )
        )
      }
    },
    []
  )

  // ----------------------------------------------------------
  // Derived values
  // ----------------------------------------------------------

  const assistantMessages = messages.filter((m) => m.role === 'assistant')
  const avgConfidence =
    assistantMessages.length > 0
      ? assistantMessages.reduce((s, m) => s + (m.confidence ?? 0), 0) /
        assistantMessages.length
      : 0
  const feedbackRate =
    assistantMessages.length > 0
      ? (assistantMessages.filter((m) => m.feedback === 'up').length /
          assistantMessages.length) *
        100
      : 0

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  const sessionListContent = (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Button
          onClick={startNewSession}
          className="w-full gap-1.5"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Sesi Baru
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-custom p-2">
        {loadingSessions ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Belum ada sesi. Mulai chat untuk membuat sesi pertama Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                onClick={() => handleSelectSession(s.id)}
                onDelete={() => handleDeleteSession(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] lg:h-[calc(100dvh-4rem)] overflow-hidden bg-background">
      {/* Desktop sidebar - sessions */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-card/30">
        <div className="flex h-12 items-center gap-2 border-b px-4">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Riwayat Sesi</span>
        </div>
        {sessionListContent}
      </aside>

      {/* Mobile sessions sheet */}
      <Sheet open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-12 justify-center border-b px-4">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-primary" />
              Riwayat Sesi
            </SheetTitle>
            <SheetDescription className="sr-only">
              Daftar sesi chat Anda
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">{sessionListContent}</div>
        </SheetContent>
      </Sheet>

      {/* Center column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-card/30 px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Buka menu sesi"
              onClick={() => setMobileSessionsOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">
                {activeSessionTitle || 'FinBest AI Chat'}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {messages.length > 0
                  ? `${messages.length} pesan · ${formatRelativeTime(messages[messages.length - 1].createdAt)}`
                  : 'Non-diskrisioner · Berbasis RAG'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="hidden xl:inline-flex"
              onClick={() => setRightPanelOpen((v) => !v)}
              aria-label="Toggle panel kanan"
            >
              {rightPanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Messages stream */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto scrollbar-custom"
        >
          {loadingMessages ? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 && !loading ? (
            <EmptyState
              templates={templates}
              onPick={(t) => sendMessage(t)}
            />
          ) : (
            <div className="space-y-5 p-4">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <UserMessage key={m.id} message={m} />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    onFeedback={handleFeedback}
                  />
                )
              )}
              {loading && <TypingIndicator statusText={statusText} />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t bg-card/30 p-3">
          {/* Template chips */}
          {messages.length > 0 && templates.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {templates.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  onClick={() => sendMessage(t.text)}
                  disabled={loading}
                  className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-50"
                >
                  {t.text.length > 42 ? t.text.slice(0, 42) + '…' : t.text}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pertanyaan investasi Anda... (Enter untuk kirim, Shift+Enter baris baru)"
              disabled={loading}
              className="min-h-[44px] flex-1 resize-none"
              rows={1}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-[44px] w-[44px] shrink-0"
              aria-label="Kirim pesan"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            FinBest AI bersifat non-diskrisioner. Jawaban bersifat edukatif,
            bukan rekomendasi transaksi.
          </p>
        </div>
      </div>

      {/* Right panel - context & info */}
      {rightPanelOpen && (
        <aside className="hidden xl:flex w-72 shrink-0 flex-col border-l bg-card/30">
          <div className="flex h-12 items-center gap-2 border-b px-4">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Konteks & Info</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto scrollbar-custom p-4">
            {/* Portfolio context toggle */}
            <Card className="gap-3 py-3">
              <CardHeader className="px-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Konteks Portofolio
                </CardTitle>
                <CardDescription className="text-xs">
                  Sertakan ringkasan portofolio Anda untuk jawaban yang lebih
                  personal.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3">
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5">
                  <div>
                    <p className="text-xs font-medium">Sertakan konteks</p>
                    <p className="text-[10px] text-muted-foreground">
                      NAV, alokasi, profil risiko
                    </p>
                  </div>
                  <Switch
                    checked={includePortfolioContext}
                    onCheckedChange={setIncludePortfolioContext}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Knowledge base info */}
            <Card className="gap-3 py-3">
              <CardHeader className="px-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Basis Pengetahuan
                </CardTitle>
                <CardDescription className="text-xs">
                  Sumber RAG untuk jawaban FinBest AI.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-3">
                <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Total dokumen
                  </span>
                  <Badge className="bg-primary text-primary-foreground">
                    {knowledgeStats.count}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {knowledgeStats.categories.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between rounded-md bg-accent/40 px-2.5 py-1.5 text-xs"
                    >
                      <span className="text-foreground">{c.label}</span>
                      <FileText className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ))}
                </div>
                <a
                  href="https://www.ojk.go.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Sumber eksternal OJK
                  <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>

            {/* Session stats */}
            {messages.length > 0 && (
              <Card className="gap-3 py-3">
                <CardHeader className="px-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Statistik Sesi
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Metrik kualitas percakapan saat ini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 px-3">
                  <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      Total pesan
                    </span>
                    <span className="text-xs font-semibold">
                      {messages.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      Rata-rata confidence
                    </span>
                    <Badge
                      className={cn(
                        'text-[10px] font-semibold text-white',
                        getConfidenceTier(avgConfidence).cls
                      )}
                    >
                      {(avgConfidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      Feedback positif
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      <ThumbsUp className="h-3 w-3 text-emerald-600" />
                      {feedbackRate.toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Disclaimer */}
            <Alert className="border-amber-300/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-xs text-amber-800 dark:text-amber-300">
                Disclaimer Penting
              </AlertTitle>
              <AlertDescription className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                {DISCLAIMER}
              </AlertDescription>
            </Alert>
          </div>
        </aside>
      )}
    </div>
  )
}
