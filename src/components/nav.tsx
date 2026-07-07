'use client'

import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore, type TabKey } from '@/lib/store'
import {
  LayoutDashboard,
  Wallet,
  ShieldCheck,
  Sparkles,
  GraduationCap,
  UserRound,
  Search,
  ArrowRight,
  LineChart,
  Shield,
  Upload,
} from 'lucide-react'
import { motion } from 'framer-motion'

interface NavItem {
  key: TabKey
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'beranda',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Ringkasan portofolio & insight',
  },
  {
    key: 'portofolio',
    label: 'Portofolio',
    shortLabel: 'Portofolio',
    icon: Wallet,
    description: 'Posisi, P&L, alokasi aset',
  },
  {
    key: 'traction',
    label: 'Friction Gate',
    shortLabel: 'Gate',
    icon: ShieldCheck,
    description: 'Cek transaksi & refleksi',
  },
  {
    key: 'ai',
    label: 'AI Mentor',
    shortLabel: 'AI Mentor',
    icon: Sparkles,
    description: 'Mentor investasi & analisis saham',
  },
  {
    key: 'edukasi',
    label: 'Edukasi',
    shortLabel: 'Edukasi',
    icon: GraduationCap,
    description: 'Pelajaran investasi bertahap',
  },
  {
    key: 'profil',
    label: 'Profil',
    shortLabel: 'Profil',
    icon: UserRound,
    description: 'Profil risiko & rencana investasi',
  },
]

const SEARCH_TARGETS: Array<{
  key: TabKey
  label: string
  keywords: string[]
}> = [
  ...NAV_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    keywords: [item.label, item.shortLabel, item.description],
  })),
  {
    key: 'portofolio',
    label: 'Portofolio',
    keywords: ['bbca', 'bbri', 'tlkm', 'goto', 'asii', 'icbp', 'rdpu', 'rdus', 'holding', 'saham'],
  },
  {
    key: 'beranda',
    label: 'Dashboard',
    keywords: ['laporan', 'ekspor', 'market', 'nav', 'grafik', 'ringkasan'],
  },
  {
    key: 'profil',
    label: 'Profil',
    keywords: ['broker', 'csv', 'database', 'tujuan', 'risiko', 'keluar'],
  },
]

const WATCHLIST_TICKERS = [
  'BBCA',
  'BBRI',
  'TLKM',
  'GOTO',
  'ASII',
  'ICBP',
  'EMTK',
  'RDSU',
  'RDPU',
  'INDO23',
  'GLD001',
]

type SearchResult = {
  id: string
  title: string
  description: string
  category: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  score: number
}

/** Brand mark — refined FinBest logo */
function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-lg bg-white/10 p-0.5',
        className
      )}
    >
      <img src="/logo.svg" alt="FinBest" className="h-full w-full rounded-md object-cover" />
    </div>
  )
}

function useActiveNavItem() {
  const activeTab = useAppStore((s) => s.activeTab)
  return NAV_ITEMS.find((item) => item.key === activeTab) ?? NAV_ITEMS[0]
}

/** Desktop sidebar navigation */
export function DesktopNav() {
  const { activeTab, setActiveTab } = useAppStore()

  return (
    <aside className="hidden w-[220px] shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <BrandMark className="h-9 w-9" />
        <div className="flex flex-col leading-tight">
          <span className="text-[22px] font-bold tracking-tight text-[#F8F8F2]">
            Fin<span className="text-[#6D83F2]">Best</span>
          </span>
        </div>
      </div>

      <div className="mx-3 mb-5 flex items-center gap-3 rounded-xl px-3 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#433eab] text-sm font-bold text-[#F8F8F2]">
          T
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-[#F8F8F2]">Tanjung</p>
          <p className="truncate text-[11px] text-[#9AA9FF]">Investor Pemula · Lv3</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.key
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors',
                isActive
                  ? 'bg-[#433eab] text-[#F8F8F2]'
                  : 'text-[#F8F8F2]/55 hover:bg-white/5 hover:text-[#F8F8F2]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn('font-medium', isActive && 'font-bold')}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="px-5 pb-6">
        <div className="mb-7 h-px bg-white/10" />
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-[#9AA9FF]">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            OJK Compliant
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#9AA9FF]">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            UU PDP Certified
          </div>
        </div>
        <p className="mt-8 text-[11px] text-[#F8F8F2]/30">FinBest v1.0.0</p>
      </div>
    </aside>
  )
}

/** Mobile bottom tab navigation — 6 tabs compact */
export function MobileNav() {
  const { activeTab, setActiveTab } = useAppStore()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#00033d] pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-6 px-0.5 py-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.key
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 rounded-md py-1.5 text-[9px] font-medium transition-colors',
                isActive ? 'text-[#F8F8F2]' : 'text-[#F8F8F2]/55'
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', isActive && 'stroke-[2.5]')} />
              <span className="truncate max-w-full leading-tight">
                {item.shortLabel}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="pointer-events-none absolute -top-0.5 h-0.5 w-8 rounded-full bg-[#6D83F2]"
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Mobile top bar */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[#00033d] px-4 text-[#F8F8F2] lg:hidden">
      <div className="flex items-center gap-2">
        <BrandMark className="h-8 w-8" />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold">Fin<span className="text-[#6D83F2]">Best</span></span>
        </div>
      </div>
      <span className="rounded-full border border-[#6D83F2]/30 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-[#9AA9FF]">
        Sistem Aktif
      </span>
    </header>
  )
}

/** Desktop top bar */
export function DesktopTopBar() {
  const activeItem = useActiveNavItem()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setPendingAIQuery = useAppStore((s) => s.setPendingAIQuery)
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(0)

  const closeSearch = () => {
    setIsSearchOpen(false)
    setActiveResultIndex(0)
  }

  const clearSearch = () => {
    setQuery('')
    closeSearch()
  }

  const openTab = (tab: TabKey) => {
    setActiveTab(tab)
    clearSearch()
  }

  const askAI = (prompt: string) => {
    setPendingAIQuery(prompt)
    setActiveTab('ai')
    clearSearch()
  }

  const searchResults = useMemo<SearchResult[]>(() => {
    const raw = query.trim()
    const term = raw.toLowerCase()
    const ticker = WATCHLIST_TICKERS.find((t) => {
      const normalized = t.toLowerCase()
      return normalized === term || normalized.startsWith(term) || term.includes(normalized)
    })

    const results: SearchResult[] = []

    if (ticker) {
      results.push(
        {
          id: `ai-${ticker}`,
          title: `Analisis saham ${ticker}`,
          description: 'Buka AI Mentor dengan riset harga, fundamental, berita, dan risiko.',
          category: 'Riset saham',
          icon: Sparkles,
          action: () =>
            askAI(
              `Analisis saham ${ticker}: harga terbaru, fundamental, valuasi, katalis, risiko, dan stance BUY/HOLD/SELL.`
            ),
          score: 100,
        },
        {
          id: `portfolio-${ticker}`,
          title: `Lihat ${ticker} di Portofolio`,
          description: 'Cek posisi, bobot, P&L, dan kontribusi terhadap NAV.',
          category: 'Portofolio',
          icon: Wallet,
          action: () => openTab('portofolio'),
          score: 90,
        },
        {
          id: `gate-${ticker}`,
          title: `Evaluasi transaksi ${ticker}`,
          description: 'Gunakan Friction Gate sebelum beli/jual agar tidak impulsif.',
          category: 'Friction Gate',
          icon: Shield,
          action: () => openTab('traction'),
          score: 80,
        }
      )
    }

    SEARCH_TARGETS.forEach((item) => {
      const haystack = [item.label, ...item.keywords].join(' ').toLowerCase()
      const exactLabel = item.label.toLowerCase() === term
      const keywordHit = term.length > 0 && haystack.includes(term)
      const reverseHit =
        term.length > 2 &&
        item.keywords.some((keyword) => term.includes(keyword.toLowerCase()))

      if (ticker && !exactLabel && item.key === 'portofolio') return

      if (!term || exactLabel || keywordHit || reverseHit) {
        const navItem = NAV_ITEMS.find((nav) => nav.key === item.key)
        if (!navItem) return

        results.push({
          id: `module-${item.key}-${item.label}`,
          title: `Buka ${item.label}`,
          description: navItem.description,
          category: 'Navigasi',
          icon: navItem.icon,
          action: () => openTab(item.key),
          score: exactLabel ? 95 : keywordHit ? 65 : 45,
        })
      }
    })

    const intentResults: SearchResult[] = [
      {
        id: 'learn-valuation',
        title: 'Pelajari valuasi saham',
        description: 'Masuk ke Edukasi untuk PER, PBV, ROE, DER, dan analisis fundamental.',
        category: 'Edukasi',
        icon: GraduationCap,
        action: () => openTab('edukasi'),
        score: /valuasi|fundamental|per|pbv|roe|der|belajar|edukasi/.test(term) ? 88 : 0,
      },
      {
        id: 'import-csv',
        title: 'Import portofolio CSV',
        description: 'Buka Profil untuk upload CSV atau load sample portfolio.',
        category: 'Data',
        icon: Upload,
        action: () => openTab('profil'),
        score: /csv|import|upload|broker|sample/.test(term) ? 86 : 0,
      },
      {
        id: 'portfolio-risk',
        title: 'Tanya AI soal portofolio saya',
        description: 'Minta AI Mentor membaca alokasi, risiko konsentrasi, dan bias.',
        category: 'AI Mentor',
        icon: Sparkles,
        action: () =>
          askAI('Evaluasi portofolio saya: alokasi, konsentrasi posisi, risiko sektor, dan bias perilaku.'),
        score: /analisis|evaluasi|risiko|bias|portofolio|portfolio/.test(term) ? 82 : 0,
      },
      {
        id: 'market-question',
        title: raw ? `Tanyakan "${raw}" ke AI Mentor` : 'Tanya AI Mentor',
        description: 'Gunakan AI untuk pertanyaan investasi yang tidak cocok dengan menu tertentu.',
        category: 'AI Mentor',
        icon: LineChart,
        action: () => askAI(raw || 'Bantu saya memahami kondisi portofolio dan pasar hari ini.'),
        score: raw && results.length === 0 ? 70 : 10,
      },
    ].filter((result) => result.score > 0)

    return [...results, ...intentResults]
      .filter(
        (result, index, all) =>
          all.findIndex((candidate) => candidate.id === result.id) === index
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
  }, [query, setActiveTab, setPendingAIQuery])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = searchResults[activeResultIndex] ?? searchResults[0]
    if (result) result.action()
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsSearchOpen(true)
      setActiveResultIndex((current) =>
        searchResults.length === 0 ? 0 : (current + 1) % searchResults.length
      )
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsSearchOpen(true)
      setActiveResultIndex((current) =>
        searchResults.length === 0
          ? 0
          : (current - 1 + searchResults.length) % searchResults.length
      )
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
    }
  }

  return (
    <header className="hidden h-16 items-center justify-between bg-[#00033d] px-7 text-[#F8F8F2] lg:flex">
      <div className="min-w-0">
        <h1 className="truncate text-base font-bold">
          {activeItem.label}
        </h1>
        <p className="truncate text-xs text-[#9AA9FF]">
          {activeItem.description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <form onSubmit={handleSearch} className="relative hidden xl:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9AA9FF]" />
          <input
            value={query}
            name="global-search"
            onChange={(event) => {
              setQuery(event.target.value)
              setIsSearchOpen(true)
              setActiveResultIndex(0)
            }}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => {
              window.setTimeout(() => closeSearch(), 120)
            }}
            onKeyDown={handleSearchKeyDown}
            className="h-9 w-[345px] rounded-xl border border-[#6D83F2]/30 bg-white/10 pl-9 pr-3 text-xs text-[#F8F8F2] outline-none transition-colors placeholder:text-[#F8F8F2]/45 focus:border-[#9AA9FF] focus:bg-white/15"
            placeholder="Cari saham, fitur, atau tanya AI..."
            aria-label="Cari saham, fitur, atau tanya AI"
            role="combobox"
            aria-expanded={isSearchOpen}
            aria-controls="global-search-results"
            aria-autocomplete="list"
          />
          {isSearchOpen ? (
            <div
              id="global-search-results"
              className="absolute right-0 top-full z-50 mt-2 w-[430px] overflow-hidden rounded-xl border border-[#6D83F2]/25 bg-[#070a45] shadow-2xl ring-1 ring-white/10"
              role="listbox"
            >
              <div className="border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-wide text-[#9AA9FF]">
                {query.trim()
                  ? 'Pilih tujuan pencarian'
                  : 'Shortcut investor'}
              </div>
              <div className="max-h-[360px] overflow-y-auto p-1.5 scrollbar-custom">
                {searchResults.length > 0 ? (
                  searchResults.map((result, index) => {
                    const Icon = result.icon
                    const isActive = index === activeResultIndex

                    return (
                      <button
                        key={result.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActiveResultIndex(index)}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          result.action()
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                          isActive
                            ? 'bg-[#433eab] text-white'
                            : 'text-[#F8F8F2] hover:bg-white/8'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                            isActive
                              ? 'border-white/20 bg-white/15'
                              : 'border-[#6D83F2]/20 bg-white/8'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {result.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[#C8D0FF]">
                              {result.category}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[#C8D0FF]/75">
                            {result.description}
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      </button>
                    )
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-xs text-[#9AA9FF]">
                    Tidak ada hasil. Tekan Enter untuk bertanya ke AI Mentor.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-[#9AA9FF]">
                <span>↑↓ pilih hasil</span>
                <span>Enter buka · Esc tutup</span>
              </div>
            </div>
          ) : null}
        </form>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#9AA9FF]">
          <span className="mr-1 text-[#22C55E]">●</span> Sistem Aktif
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#433eab] text-sm font-bold text-white">
          T
        </div>
      </div>
    </header>
  )
}
