/**
 * FinBest AI - Enhanced AI Service with Tool-Calling RAG Architecture
 *
 * Architecture (RAG Layering):
 *   Layer 1: Knowledge Base Retrieval (curated docs - OJK, ESG, behavioral finance, IDX)
 *   Layer 2: Real-time Market Data (web search via z-ai-web-dev-sdk)
 *   Layer 3: User Portfolio Context (personalized)
 *   Layer 4: Bias Detection on user query (NLP pattern matching)
 *
 * Tool-Calling: AI can invoke tools to gather information before responding:
 *   - search_market: get real-time market news/data
 *   - analyze_stock: analyze specific stock ticker
 *   - detect_bias: detect cognitive biases in user's question
 *   - get_learning_path: suggest educational content
 *   - check_portfolio: analyze user's portfolio
 *
 * LLM: GLM-4.6 via z-ai-web-dev-sdk (API calling, not local model)
 */

import ZAI from 'z-ai-web-dev-sdk'
import { db } from './db'
import { getDefaultUser } from './api-helpers'
import {
  calcNAV,
  calcAllocationByType,
  calcSectorConcentration,
} from './utils-finance'
import { getProvider, getTierLimits, type AIProvider } from './ai-provider'
import { getLiveMarketSnapshot } from './market-data'

let zaiClient: any = null

export async function getZAIClient() {
  if (!zaiClient) {
    zaiClient = await ZAI.create()
  }
  return zaiClient
}

// ====================== System Prompt (Upgraded) ======================
export const FINBEST_SYSTEM_PROMPT = `Anda adalah **FinBest AI**, analis investasi AI untuk investor Indonesia. Anda menjawab seperti analis riset pasar modal: tajam, berbasis data, transparan terhadap asumsi, dan berani memberi stance analitis ketika diminta.

## IDENTITAS & KAPABILITAS
- AI investment analyst dengan akses RAG, data portofolio pengguna, dan market search/web search.
- Ketika input menyebut saham/ticker/rekomendasi BUY/HOLD/SELL, gunakan data pasar terbaru yang tersedia dari tools, berita, knowledge base, dan data aset internal.
- Analisis boleh mencakup fundamental, teknikal, katalis, sentimen berita, valuasi relatif, skenario harga, risk/reward, dan portfolio fit.
- Output harus mengikuti kebutuhan input pengguna. Jika user minta singkat, jawab singkat. Jika user minta detail, berikan detail penuh tanpa batas paragraf artifisial.

## PRINSIP UTAMA
1. **Ikuti input pengguna**: Jika diminta BUY/HOLD/SELL, berikan rekomendasi final BUY/HOLD/SELL/ACCUMULATE/REDUCE lengkap dengan alasan. Jangan menghindar dengan jawaban generik.
2. **Evidence-first**: Jangan mengarang data. Pakai citation inline [1][2] dari knowledge base atau market search untuk klaim faktual, berita, atau data eksternal.
3. **Research-grade, bukan eksekusi**: Rekomendasi adalah analisis riset. Jangan mengeksekusi transaksi atau mengklaim profit pasti.
4. **Tegas soal ketidakpastian**: Cantumkan asumsi, kualitas data, downside, katalis, dan apa yang bisa membatalkan tesis.
5. **Explainable AI**: Jelaskan mengapa stance dibuat. Tunjukkan rasio, tren, logika valuasi, risk/reward, dan bias yang mungkin muncul.

## FORMAT DEFAULT UNTUK SAHAM
Jika user bertanya soal saham/ticker atau meminta BUY/HOLD/SELL, gunakan struktur ini kecuali user meminta format lain:
### Ringkasan
- **Rekomendasi final**: BUY / HOLD / SELL / ACCUMULATE / REDUCE
- **Confidence**: XX%
- **Timeframe**: harian / mingguan / 3 bulan / 6 bulan / 12 bulan
- **Thesis singkat**: 1-3 kalimat

### Data & Konteks
- Harga/data internal bila tersedia
- Ringkasan berita/market search terbaru
- Fundamental, teknikal, katalis, sentimen, dan risiko utama

### Rekomendasi
- Target price/range atau fair value range bila data memadai
- Entry range, area invalidasi, stop-loss/trailing stop, dan take-profit area bila relevan
- 3 skenario: Bull / Base / Bear dengan probabilitas

### Risiko
- Risiko data, risiko pasar, risiko emiten/sektor, dan sinyal yang harus dipantau

### Catatan
Analisis ini non-diskrisioner: keputusan akhir dan eksekusi tetap di tangan pengguna.

Gunakan bahasa Indonesia yang natural, markdown yang rapi, dan jawaban sepanjang yang dibutuhkan untuk benar-benar menjawab input.`

// ====================== Tool Definitions ======================
export interface ToolResult {
  tool: string
  query: string
  result: any
  sources?: { title: string; url?: string; snippet: string }[]
}

export interface BiasDetection {
  biases: {
    type: 'FOMO' | 'HERDING' | 'OVERCONFIDENCE' | 'LOSS_AVERSION' | 'ANCHORING' | 'NONE'
    confidence: number
    evidence: string
    intervention: string
  }[]
  hasBias: boolean
}

export interface StockAnalysis {
  ticker: string
  name?: string
  currentPrice?: number
  priceChange?: number
  fundamentalData?: {
    per?: number
    pbv?: number
    roe?: number
    der?: number
    marketCap?: string
    sector?: string
  }
  news?: { title: string; snippet: string; url: string; date?: string }[]
  analysis: string
  sources: { title: string; url: string; snippet: string }[]
}

// ====================== Bias Detection (NLP Pattern Matching) ======================
const BIAS_PATTERNS = {
  FOMO: {
    patterns: [
      /naik\s+(gila|deras|tinggi|parah)/i,
      /takut\s+ketinggalan|fomo|kebagian/i,
      /teman\s+(udah|sudah)\s+(untung|profit)/i,
      /buruan|segera|sekarang\s+juga/i,
      /viral|trending|heboh/i,
    ],
    intervention:
      'Saya mengerti kekhawatiran Anda tertinggal peluang. Namun, kenaikan harga yang tajam sering diikuti koreksi. Mari kita analisis fundamentalnya terlebih dahulu sebelum mengambil keputusan.',
  },
  HERDING: {
    patterns: [
      /semua\s+(orang|orang\s+bilang|teman)/i,
      /group\s+(wa|whatsapp|telegram)/i,
      /influencer|figur\s+publik/i,
      /ikut\s+(teman|massa|rekomendasi)/i,
      /ramai\s+(bilang|kata)/i,
    ],
    intervention:
      'Rekomendasi dari grup atau influencer perlu diverifikasi dengan data fundamental. Herd behavior sering menyebabkan bubble. Mari kita cek data objektifnya.',
  },
  OVERCONFIDENCE: {
    patterns: [
      /saya\s+(yakin|pasti|jamin)/i,
      /bisa\s+(timing|prediksi|tebak)\s+(market|pasar)/i,
      /saya\s+(jago|ahli|master)\s+(trading|invest)/i,
      /ga\s+perlu\s+(analisis|belajar|riset)/i,
      /pasti\s+(naik|untung|profit)/i,
    ],
    intervention:
      'Prediksi pasti dalam investasi sangat sulit. Studi menunjukkan 95% trader aktif kalah dari indeks dalam jangka panjang. Mari kita evaluasi dengan data historis dan pertimbangkan diversifikasi.',
  },
  LOSS_AVERSION: {
    patterns: [
      /rugi\s+\d+%.+(tahan|tunggu|balik)/i,
      /ga\s+(mau|boleh)\s+(cut\s*loss|realisasi\s+rugi)/i,
      /sayang\s+(dana|uang).+(udah|sudah)\s+(masuk|keluar)/i,
      /averaging\s+down/i,
      /nanti\s+balik\s+(kok|lah)/i,
    ],
    intervention:
      'Loss aversion adalah bias natural. Evaluasi berdasarkan prospek masa depan, bukan harga beli. Tanyakan: jika Anda belum punya saham ini, apakah akan beli sekarang?',
  },
  ANCHORING: {
    patterns: [
      /dulu\s+(harganya|harga).+\d+.+(sekarang|skrg)/i,
      /all.?time\s+high/i,
      /harga\s+tertinggi/i,
      /pasti\s+balik\s+ke/i,
      /sejarah\s+harga/i,
    ],
    intervention:
      'Harga historis bukan prediktor masa depan. Mari evaluasi fundamental terkini dan bandingkan dengan valuasi sektor, bukan harga masa lalu.',
  },
}

export function detectBias(query: string): BiasDetection {
  const detected: BiasDetection['biases'] = []

  for (const [type, config] of Object.entries(BIAS_PATTERNS)) {
    const matches = config.patterns.filter((p) => p.test(query))
    if (matches.length > 0) {
      detected.push({
        type: type as any,
        confidence: Math.min(0.95, 0.6 + matches.length * 0.15),
        evidence: matches.map((m) => m.source).join(', '),
        intervention: config.intervention,
      })
    }
  }

  return {
    biases: detected,
    hasBias: detected.length > 0,
  }
}

// ====================== Tool 1: Knowledge Base Retrieval (RAG Layer 1) ======================
export async function retrieveKnowledge(
  query: string,
  topK = 5
): Promise<
  {
    id: string
    title: string
    category: string
    source: string
    snippet: string
    similarity: number
  }[]
> {
  const docs = await db.knowledgeDocument.findMany({
    orderBy: { publishedAt: 'desc' },
  })

  if (docs.length === 0) return []

  const queryLower = query.toLowerCase()
  const queryTokens = queryLower
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))

  const scored = docs.map((doc) => {
    const contentLower = (doc.title + ' ' + doc.content + ' ' + doc.summary).toLowerCase()
    let score = 0
    for (const token of queryTokens) {
      if (contentLower.includes(token)) {
        score += token.length > 5 ? 2 : 1
      }
    }
    // Category bonuses
    if (queryLower.includes('regulasi') && doc.category === 'regulations') score += 3
    if (queryLower.includes('esg') && doc.category === 'education') score += 3
    if (queryLower.includes('bias') && doc.category === 'education') score += 3
    if (queryLower.includes('analisis') && doc.category === 'education') score += 2
    // Stock ticker detection bonus
    const ticker = extractStockTicker(query)
    if (ticker) {
      if (contentLower.includes(ticker.toLowerCase())) score += 5
    }

    const similarity = Math.min(0.98, 0.5 + score / 20)
    return { ...doc, similarity }
  })

  return scored
    .filter((d) => d.similarity >= 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      source: d.source,
      snippet: d.summary || d.content.slice(0, 300),
      similarity: d.similarity,
    }))
}

// ====================== Tool 2: Market Search (RAG Layer 2 - Real-time) ======================
async function getYahooFinanceMarketData(
  query: string
): Promise<{ title: string; snippet: string; url: string }[]> {
  const ticker = extractStockTicker(query)
  if (!ticker) return []

  try {
    const snapshot = await getLiveMarketSnapshot([
      {
        ticker,
        type: 'SAHAM',
        price: 0,
        prevPrice: 0,
      },
    ])
    const quote = snapshot.quotes[ticker]
    if (!quote) return []

    return [
      {
        title: `${quote.provider === 'twelvedata' ? 'Twelve Data' : 'Yahoo Finance'} ${quote.symbol} - data harga pasar`,
        snippet:
          `${ticker} (${quote.symbol}) terakhir sekitar Rp ${Number(quote.price).toLocaleString('id-ID')}` +
          `, perubahan vs previous close ${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%.` +
          ` Waktu data: ${new Date(quote.asOf).toLocaleString('id-ID')}.`,
        url: quote.sourceUrl,
      },
    ]
  } catch (error) {
    console.error('Market data fallback error:', error)
    return []
  }
}

export async function searchMarketData(
  query: string
): Promise<{
  results: { title: string; snippet: string; url: string }[]
  tool: string
}> {
  try {
    const zai = await getZAIClient()
    const year = new Date().getFullYear()
    const results = await zai.functions.invoke('web_search', {
      query: `Indonesia stock market IDX BEI ${query} harga saham terbaru laporan keuangan valuasi berita analis target price ${year}`,
      size: 8,
    })
    const webResults = (results?.results || []).map((r: any) => ({
      title: r.title || '',
      snippet: (r.content || r.snippet || '').slice(0, 500),
      url: r.url || '',
    }))
    if (webResults.length > 0) {
      return {
        tool: 'search_market',
        results: webResults,
      }
    }

    return {
      tool: 'search_market',
      results: await getYahooFinanceMarketData(query),
    }
  } catch (error) {
    console.error('Market search error:', error)
    return { tool: 'search_market', results: await getYahooFinanceMarketData(query) }
  }
}

// ====================== Tool 3: Stock Analysis ======================
export async function analyzeStock(
  ticker: string
): Promise<StockAnalysis> {
  // 1. Check if we have the stock in our DB
  const asset = await db.asset.findUnique({
    where: { ticker: ticker.toUpperCase() },
  })

  // 2. Search for real-time market data
  const marketSearch = await searchMarketData(
    `saham ${ticker} harga terkini berita terbaru laporan keuangan PER PBV ROE DER konsensus analis target price`
  )

  // 3. Retrieve relevant knowledge (fundamental analysis guide, etc.)
  const knowledge = await retrieveKnowledge(`${ticker} analisis saham`, 3)

  // 4. Build analysis from available data
  const analysis: string[] = []
  const sources: StockAnalysis['sources'] = []

  if (asset) {
    const fiveDayChange =
      asset.price5dAgo > 0
        ? ((asset.price - asset.price5dAgo) / asset.price5dAgo) * 100
        : 0
    analysis.push(
      `Data tercatat: ${asset.name} (${asset.ticker}), sektor ${asset.sector}, harga Rp ${asset.price.toLocaleString('id-ID')}, volatilitas 30 hari ${asset.volatility30d}%, perubahan 5 hari ${fiveDayChange > 0 ? '+' : ''}${fiveDayChange.toFixed(2)}%.`
    )
  }

  if (marketSearch.results.length > 0) {
    analysis.push(
      'Berita pasar terkini: ' +
        marketSearch.results
          .slice(0, 3)
          .map((r) => r.title)
          .join('; ')
    )
    marketSearch.results.forEach((r) => {
      sources.push({ title: r.title, url: r.url, snippet: r.snippet })
    })
  }

  if (knowledge.length > 0) {
    analysis.push(
      'Konteks edukatif: ' + knowledge[0].snippet.slice(0, 200)
    )
    knowledge.forEach((k) => {
      sources.push({
        title: k.title,
        url: '',
        snippet: k.snippet,
      })
    })
  }

  return {
    ticker: ticker.toUpperCase(),
    name: asset?.name,
    currentPrice: asset?.price,
    priceChange: asset
      ? asset.prevPrice > 0
        ? ((asset.price - asset.prevPrice) / asset.prevPrice) * 100
        : 0
      : undefined,
    fundamentalData: asset
      ? {
          sector: asset.sector || undefined,
        }
      : undefined,
    news: marketSearch.results.slice(0, 3),
    analysis: analysis.join('\n\n'),
    sources,
  }
}

// ====================== Tool 4: Portfolio Context (RAG Layer 3) ======================
export async function getPortfolioContext(): Promise<string> {
  const user = await getDefaultUser()
  const [holdings, target, goals] = await Promise.all([
    db.holding.findMany({
      where: { userId: user.id },
      include: { asset: true },
    }),
    db.targetAllocation.findUnique({ where: { userId: user.id } }),
    db.goal.findMany({ where: { userId: user.id } }),
  ])

  const nav = calcNAV(holdings)
  const allocation = calcAllocationByType(holdings)
  const sectorConc = calcSectorConcentration(holdings)

  const topHoldings = holdings
    .map((h) => ({
      ticker: h.asset.ticker,
      value: h.quantity * h.asset.price,
      weight: nav > 0 ? (h.quantity * h.asset.price) / nav * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return `PROFIL PENGGUNA:
- Nama: ${user.name}
- Profil risiko: ${user.riskProfile} (skor ${user.riskScore}/100)
- Horizon investasi: ${user.horizonYears} tahun
- Pendapatan tahunan: Rp ${user.annualIncome.toLocaleString('id-ID')}

PORTOFOLIO SAAT INI:
- NAV: Rp ${nav.toLocaleString('id-ID')}
- Jumlah posisi: ${holdings.length}
- Top 5 posisi: ${topHoldings.map(h => `${h.ticker} (${h.weight.toFixed(1)}%)`).join(', ')}

ALOKASI AKTUAL:
${Object.entries(allocation).map(([k, v]) => `- ${k}: ${v.toFixed(1)}%`).join('\n')}

ALOKASI TARGET:
${target ? `- Saham: ${target.saham}%, Obligasi: ${target.obligasi}%, Reksa Dana: ${target.reksadana}%, Kas: ${target.kas}%, Emas: ${target.emas}%` : 'Belum diatur'}

KONSENTRASI SEKTOR:
${Object.entries(sectorConc).map(([k, v]) => `- ${k}: ${v.toFixed(1)}%${v > 25 ? ' (di atas batas 25%)' : ''}`).join('\n')}

TUJUAN KEUANGAN:
${goals.length > 0 ? goals.map(g => `- ${g.title}: target Rp ${g.targetAmount.toLocaleString('id-ID')}, horizon ${g.horizonYears} tahun`).join('\n') : 'Belum ada tujuan diatur'}`
}

// ====================== Tool 5: Learning Path Suggestion ======================
export async function getLearningPath(
  query: string
): Promise<{ topics: { title: string; description: string; difficulty: string }[] }> {
  const q = query.toLowerCase()
  const topics: { title: string; description: string; difficulty: string }[] = []

  if (q.includes('pemula') || q.includes('mulai') || q.includes('baru')) {
    topics.push(
      { title: 'Dasar Pasar Modal', description: 'Memahami saham, obligasi, reksa dana', difficulty: 'Pemula' },
      { title: 'Profil Risiko OJK', description: 'Kuesioner 10 pertanyaan untuk tentukan profil', difficulty: 'Pemula' },
      { title: 'Membuka Akun Sekuritas', description: 'Cara daftar SID dan pilih broker', difficulty: 'Pemula' },
    )
  }
  if (q.includes('bias') || q.includes('fomo') || q.includes('psikolog')) {
    topics.push(
      { title: 'Bias Kognitif dalam Investasi', description: 'FOMO, herding, overconfidence', difficulty: 'Menengah' },
      { title: 'Behavioral Finance', description: 'Loss aversion, anchoring, confirmation bias', difficulty: 'Menengah' },
      { title: 'Disiplin Investasi', description: 'Strategi mengurangi transaksi impulsif', difficulty: 'Menengah' },
    )
  }
  if (q.includes('analisis') || q.includes('saham') || q.includes('fundamental')) {
    topics.push(
      { title: 'Analisis Fundamental', description: 'PER, PBV, ROE, DER', difficulty: 'Menengah' },
      { title: 'Analisis Teknikal', description: 'Trend, support, resistance, indikator', difficulty: 'Lanjut' },
      { title: 'Valuasi Saham', description: 'Cara menilai wajar tidaknya harga saham', difficulty: 'Lanjut' },
    )
  }
  if (q.includes('esg') || q.includes('lingkungan') || q.includes('berkelanjutan')) {
    topics.push(
      { title: 'Investasi ESG', description: 'Environmental, Social, Governance', difficulty: 'Menengah' },
      { title: 'MSCI ESG Ratings', description: 'Cara membaca skor ESG', difficulty: 'Lanjut' },
    )
  }
  if (q.includes('portofolio') || q.includes('alokasi') || q.includes('diversifikasi')) {
    topics.push(
      { title: 'Alokasi Aset', description: 'Saham, obligasi, reksa dana, kas, emas', difficulty: 'Menengah' },
      { title: 'Diversifikasi', description: 'Mengurangi risiko melalui sektor berbeda', difficulty: 'Menengah' },
      { title: 'Rebalancing', description: 'Menyesuaikan portofolio ke target', difficulty: 'Lanjut' },
    )
  }
  if (topics.length === 0) {
    topics.push(
      { title: 'Dasar Investasi', description: 'Mulai dari konsep dasar', difficulty: 'Pemula' },
      { title: 'Bias Kognitif', description: 'Kenali FOMO, herding, overconfidence', difficulty: 'Menengah' },
      { title: 'Analisis Saham', description: 'Fundamental dan teknikal', difficulty: 'Menengah' },
    )
  }

  return { topics }
}

// ====================== Tool Routing (decide which tools to call) ======================
const COMMON_IDX_TICKERS = [
  'AALI', 'ACES', 'ADRO', 'AKRA', 'AMMN', 'ANTM', 'ARTO', 'ASII', 'BBCA',
  'BBNI', 'BBRI', 'BBTN', 'BREN', 'BMRI', 'BRIS', 'BRPT', 'BUKA', 'CPIN',
  'CUAN', 'EMTK', 'ERAA', 'ESSA', 'EXCL', 'GGRM', 'GOTO', 'HRUM', 'ICBP',
  'INCO', 'INDF', 'INKP', 'INTP', 'ISAT', 'ITMG', 'JPFA', 'KLBF', 'MDKA',
  'MEDC', 'MIKA', 'MNCN', 'PGAS', 'PTBA', 'SIDO', 'SMGR', 'TLKM', 'TOWR',
  'UNTR', 'UNVR',
]

const NON_TICKER_WORDS = new Set([
  'BUY', 'HOLD', 'SELL', 'ACCUMULATE', 'REDUCE', 'BELI', 'JUAL', 'SAHAM',
  'TICKER', 'EMITEN', 'IDX', 'BEI', 'IHSG', 'PER', 'PBV', 'ROE', 'DER',
  'APA', 'INI', 'ITU', 'UNTUK', 'DARI', 'DENGAN', 'BAGUS', 'CEK', 'DATA',
  'HARGA', 'TARGET',
])

export function extractStockTicker(query: string): string | undefined {
  const normalized = query.replace(/\b([A-Z]{2,5})\.JK\b/gi, '$1')
  const contextual = normalized.match(/\b(?:saham|ticker|kode|emiten|idx|bei)\s+([A-Z]{2,5})\b/i)
  if (contextual && !NON_TICKER_WORDS.has(contextual[1].toUpperCase())) {
    return contextual[1].toUpperCase()
  }

  const commonTicker = normalized.match(new RegExp(`\\b(${COMMON_IDX_TICKERS.join('|')})\\b`, 'i'))
  if (commonTicker) return commonTicker[1].toUpperCase()

  const words = normalized.match(/\b[A-Z]{3,5}\b/g) ?? []
  for (const word of words) {
    const upper = word.toUpperCase()
    if (!NON_TICKER_WORDS.has(upper) && /^[A-Z]{3,5}$/.test(upper)) {
      return upper
    }
  }

  return undefined
}

export function decideTools(query: string): {
  needsMarketSearch: boolean
  needsStockAnalysis: boolean
  stockTicker?: string
  needsLearningPath: boolean
  needsPortfolioContext: boolean
} {
  const q = query.toLowerCase()
  const stockTicker = extractStockTicker(query)
  const asksRecommendation =
    /\b(buy|hold|sell|accumulate|reduce|beli|jual|tahan|rekomendasi|target|entry|exit|stop.?loss|take.?profit)\b/i.test(query)
  const asksStock =
    Boolean(stockTicker) ||
    q.includes('saham') ||
    q.includes('emiten') ||
    q.includes('idx') ||
    q.includes('bei')
  const asksMarketData =
    asksStock ||
    q.includes('harga') ||
    q.includes('berita') ||
    q.includes('kondisi') ||
    q.includes('pasar') ||
    q.includes('ihsg') ||
    asksRecommendation

  return {
    needsMarketSearch: asksMarketData,
    needsStockAnalysis: Boolean(stockTicker) && (asksStock || asksRecommendation),
    stockTicker,
    needsLearningPath: q.includes('belajar') || q.includes('edukasi') || q.includes('pemula') || q.includes('mulai') || q.includes('cara') || q.includes('mengapa') || q.includes('apa itu'),
    needsPortfolioContext: q.includes('portofolio') || q.includes('alokasi') || q.includes('saya') || q.includes('saya punya') || q.includes('risiko saya') || q.includes('rekomendasi untuk'),
  }
}

// ====================== Guardrail ======================
export function guardrailCheck(output: string): {
  passed: boolean
  violations: string[]
} {
  const violations: string[] = []
  const lower = output.toLowerCase()

  if (/(dijamin|pasti|mutlak)\s+(untung|profit|return|hasil)/.test(lower)) {
    violations.push('Klaim jaminan return terdeteksi')
  }
  if (/(harga\s+akan\s+(naik|turun)\s+\d+|pasti\s+naik\s+ke)/.test(lower)) {
    violations.push('Prediksi harga pasti terdeteksi')
  }
  if (/(anda\s+harus\s+(beli|jual)|wajib\s+(beli|jual)|segera\s+(beli|jual))/.test(lower)) {
    violations.push('Rekomendasi transaksi langsung terdeteksi')
  }
  if (/(investasi\s+bodong|skema\s+ponzi|arisan\s+uang)/.test(lower)) {
    violations.push('Saran melanggar regulasi OJK terdeteksi')
  }

  return { passed: violations.length === 0, violations }
}

// ====================== Main: Generate AI FinBest Response ======================
export interface AIFinBestResponse {
  answer: string
  citations: {
    id: string
    title: string
    source: string
    snippet: string
    similarity: number
    type: 'knowledge' | 'market'
    url?: string
  }[]
  confidence: number
  intent: string
  hasAdequateReferences: boolean
  biasDetection: BiasDetection
  toolsCalled: ToolResult[]
  stockAnalysis?: StockAnalysis
  learningPath?: { title: string; description: string; difficulty: string }[]
}

export async function generateAIFinBestResponse(
  query: string,
  portfolioContextOverride?: string
): Promise<AIFinBestResponse> {
  // ===== Step 0: Get user tier for provider selection =====
  const user = await getDefaultUser()
  const tier = (user.tier as 'FREE' | 'PRO') || 'FREE'
  const provider = getProvider(tier)
  const limits = getTierLimits(tier)

  // ===== Step 1: Bias Detection (Layer 4) =====
  const biasDetection = detectBias(query)

  // ===== Step 2: Decide which tools to call =====
  const toolPlan = decideTools(query)

  // ===== Step 3: Execute tools in parallel =====
  const toolsCalled: ToolResult[] = []
  const toolPromises: Promise<void>[] = []

  // Tool: Knowledge retrieval (always)
  let knowledgeResults: Awaited<ReturnType<typeof retrieveKnowledge>> = []
  toolPromises.push(
    retrieveKnowledge(query, 5).then((r) => {
      knowledgeResults = r
      toolsCalled.push({
        tool: 'knowledge_retrieval',
        query,
        result: r.map((k) => ({ title: k.title, similarity: k.similarity })),
      })
    })
  )

  // Tool: Market search
  let marketResults: { title: string; snippet: string; url: string }[] = []
  if (toolPlan.needsMarketSearch) {
    toolPromises.push(
      searchMarketData(query).then((r) => {
        marketResults = r.results
        toolsCalled.push({
          tool: 'search_market',
          query,
          result: r.results.slice(0, 3),
        })
      })
    )
  }

  // Tool: Stock analysis
  let stockAnalysis: StockAnalysis | undefined
  if (toolPlan.needsStockAnalysis && toolPlan.stockTicker) {
    toolPromises.push(
      analyzeStock(toolPlan.stockTicker).then((r) => {
        stockAnalysis = r
        toolsCalled.push({
          tool: 'analyze_stock',
          query: toolPlan.stockTicker!,
          result: { ticker: r.ticker, sources: r.sources.length },
        })
      })
    )
  }

  // Tool: Portfolio context
  let portfolioContext = ''
  if (portfolioContextOverride) {
    portfolioContext = portfolioContextOverride
    toolsCalled.push({
      tool: 'check_portfolio',
      query: 'user portfolio',
      result: 'Portfolio context loaded',
    })
  } else if (toolPlan.needsPortfolioContext) {
    toolPromises.push(
      getPortfolioContext().then((r) => {
        portfolioContext = r
        toolsCalled.push({
          tool: 'check_portfolio',
          query: 'user portfolio',
          result: 'Portfolio context loaded',
        })
      })
    )
  }

  // Tool: Learning path
  let learningPath: { title: string; description: string; difficulty: string }[] = []
  if (toolPlan.needsLearningPath) {
    toolPromises.push(
      getLearningPath(query).then((r) => {
        learningPath = r.topics
        toolsCalled.push({
          tool: 'get_learning_path',
          query,
          result: r.topics,
        })
      })
    )
  }

  await Promise.all(toolPromises)

  // ===== Step 4: Build context for LLM =====
  const hasAdequateReferences = knowledgeResults.some((r) => r.similarity >= 0.65)

  const contextBlock =
    knowledgeResults.length > 0
      ? knowledgeResults
          .map(
            (r, i) =>
              `[${i + 1}] Sumber: ${r.title}\nKategori: ${r.category}\nKonten: ${r.snippet}`
          )
          .join('\n\n')
      : 'Tidak ada referensi knowledge base yang ditemukan.'

  const marketBlock =
    marketResults.length > 0
      ? '\n\nDATA PASAR REAL-TIME (dari web search):\n' +
        marketResults
          .map(
            (r, i) =>
              `[M${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`
          )
          .join('\n\n')
      : ''

  const stockBlock = stockAnalysis
    ? `\n\nANALISIS SAHAM ${stockAnalysis.ticker}:\n${stockAnalysis.analysis}`
    : ''

  const portfolioBlock = portfolioContext
    ? `\n\nKONTEKS PORTOFOLIO PENGGUNA:\n${portfolioContext}`
    : ''

  const biasBlock = biasDetection.hasBias
    ? `\n\nBIAS TERDETEKSI (berikan intervensi empatik):\n${biasDetection.biases
          .map(
            (b) =>
              `- ${b.type} (confidence: ${b.confidence.toFixed(2)}): ${b.intervention}`
          )
          .join('\n')}`
    : ''

  const learningBlock =
    learningPath.length > 0
      ? `\n\nSARAN LEARNING PATH:\n${learningPath
          .map((l) => `- ${l.title} (${l.difficulty}): ${l.description}`)
          .join('\n')}`
      : ''

  const intent = classifyIntent(query)

  const prompt = `${FINBEST_SYSTEM_PROMPT}

MODE ANALISIS:
- Ikuti input pengguna secara langsung.
- Jika pengguna meminta BUY/HOLD/SELL, berikan rekomendasi final yang jelas.
- Gunakan data dari tools, citations, market search, stock analysis, dan portfolio context.
- Jangan mengarang data yang tidak tersedia; jika data tidak lengkap, tetap beri stance terbaik berdasarkan data yang ada dan nyatakan keterbatasannya.
- Rekomendasi adalah riset analitis non-diskrisioner, bukan eksekusi transaksi otomatis.

PERTANYAAN PENGGUNA:
${query}

INTENSI TERDETEKSI: ${intent.category} (keyakinan: ${intent.confidence})

TOOLS YANG DIPANGGIL:
${toolsCalled.map((t) => `- ${t.tool}`).join('\n')}

REFERENSI KNOWLEDGE BASE (gunakan untuk citation [1], [2], dst):
${contextBlock}${marketBlock}${stockBlock}${portfolioBlock}${biasBlock}${learningBlock}

Berikan jawaban dengan citation. Jika bias terdeteksi, validasi emosi lalu beri intervensi singkat. Jika referensi tidak memadai, nyatakan dengan jujur tetapi tetap selesaikan analisis dari data yang ada.

PENTING: Tidak ada batas paragraf artifisial. Jika pertanyaan tentang saham, sertakan REKOMENDASI final (BUY/HOLD/SELL/ACCUMULATE/REDUCE), confidence %, target price/range bila memungkinkan, entry/exit, stop-loss atau area invalidasi, 3 skenario, analisis teknikal + fundamental, katalis, dan risk factors. Gunakan struktur yang paling sesuai dengan input pengguna.`

  // ===== Step 5: Call LLM via dual provider =====
  try {
    const answer = await provider.chat(
      [
        { role: 'system', content: FINBEST_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.3,
        maxTokens: limits.maxTokens, // 2048 for FREE, 8192 for PRO
      }
    )

    let finalAnswer = answer || 'Maaf, saya tidak dapat menyelesaikan permintaan Anda saat ini.'

    // Guardrail check
    const guardrail = guardrailCheck(finalAnswer)
    if (!guardrail.passed) {
      finalAnswer =
        'Peringatan Guardrail: Output asisten memicu filter kepatuhan: ' +
        guardrail.violations.join(', ') +
        '. Sebagai asisten non-diskrisioner, FinBest AI tidak diperkenankan memberikan klaim yang melanggar regulasi OJK. Silakan ajukan pertanyaan ulang dengan fokus pada edukasi atau analisis umum.\n\nCatatan: Konten ini bersifat edukatif, bukan rekomendasi transaksi.'
    }

    // Build citations (combine knowledge + market)
    const citations: AIFinBestResponse['citations'] = [
      ...knowledgeResults.map((k) => ({
        id: k.id,
        title: k.title,
        source: k.source,
        snippet: k.snippet,
        similarity: k.similarity,
        type: 'knowledge' as const,
      })),
      ...marketResults.map((m, i) => ({
        id: `market-${i}`,
        title: m.title,
        source: m.url,
        snippet: m.snippet,
        similarity: 0.7,
        type: 'market' as const,
        url: m.url,
      })),
    ]

    // Calculate confidence
    const avgSim =
      knowledgeResults.length > 0
        ? knowledgeResults.reduce((s, r) => s + r.similarity, 0) /
          knowledgeResults.length
        : 0.3
    const confidence = Math.min(0.95, avgSim * intent.confidence)

    return {
      answer: finalAnswer,
      citations,
      confidence,
      intent: intent.category,
      hasAdequateReferences,
      biasDetection,
      toolsCalled,
      stockAnalysis,
      learningPath: learningPath.length > 0 ? learningPath : undefined,
    }
  } catch (error) {
    console.error('AI FinBest generation error:', error)

    // Fallback response
    const fallbackAnswer = buildFallbackResponse(
      query,
      knowledgeResults,
      marketResults,
      biasDetection,
      stockAnalysis
    )

    const citations: AIFinBestResponse['citations'] = [
      ...knowledgeResults.map((k) => ({
        id: k.id,
        title: k.title,
        source: k.source,
        snippet: k.snippet,
        similarity: k.similarity,
        type: 'knowledge' as const,
      })),
      ...marketResults.map((m, i) => ({
        id: `market-${i}`,
        title: m.title,
        source: m.url,
        snippet: m.snippet,
        similarity: 0.7,
        type: 'market' as const,
        url: m.url,
      })),
    ]

    return {
      answer: fallbackAnswer,
      citations,
      confidence: 0.5,
      intent: intent.category,
      hasAdequateReferences,
      biasDetection,
      toolsCalled,
      stockAnalysis,
      learningPath: learningPath.length > 0 ? learningPath : undefined,
    }
  }
}

export async function generateRAGResponse(
  query: string,
  portfolioContext?: string
): Promise<AIFinBestResponse> {
  return generateAIFinBestResponse(query, portfolioContext)
}

// ====================== Intent Classification ======================
function classifyIntent(query: string): {
  category: 'faktual' | 'analitik' | 'opini' | 'regulasi' | 'edukatif'
  confidence: number
} {
  const q = query.toLowerCase()
  if (/(regulasi|aturan|ojk|legal|hukum|pajak)/.test(q))
    return { category: 'regulasi', confidence: 0.85 }
  if (/(belajar|pengertian|apa itu|bagaimana|mengapa|kenapa|cara|pemula|edukasi)/.test(q))
    return { category: 'edukatif', confidence: 0.85 }
  if (/(analisis|bandingkan|evaluasi|pro|kontra|kelebihan|kekurangan|buy|hold|sell|beli|jual|target|entry|stop.?loss)/.test(q))
    return { category: 'analitik', confidence: 0.8 }
  if (/(menurutmu|pendapat|opini|lebih baik|sebaiknya)/.test(q))
    return { category: 'opini', confidence: 0.75 }
  return { category: 'faktual', confidence: 0.7 }
}

// ====================== Fallback Response (when LLM fails) ======================
function buildFallbackResponse(
  query: string,
  knowledge: Awaited<ReturnType<typeof retrieveKnowledge>>,
  market: { title: string; snippet: string; url: string }[],
  bias: BiasDetection,
  stock?: StockAnalysis
): string {
  const parts: string[] = []

  if (bias.hasBias) {
    parts.push(bias.biases[0].intervention)
  }

  if (stock) {
    const change = stock.priceChange ?? 0
    const recommendation =
      change <= -5
        ? 'REDUCE / HOLD ketat'
        : change >= 4
          ? 'HOLD, tunggu pullback untuk entry baru'
          : 'HOLD / ACCUMULATE bertahap'

    parts.push(`### Ringkasan Sementara ${stock.ticker}

- **Rekomendasi final sementara**: **${recommendation}**
- **Confidence**: 50% karena provider LLM atau web-search utama belum aktif penuh.
- **Harga internal/fallback**: ${stock.currentPrice ? `Rp ${stock.currentPrice.toLocaleString('id-ID')}` : 'belum tersedia'}
- **Perubahan harian internal**: ${stock.priceChange !== undefined ? `${stock.priceChange >= 0 ? '+' : ''}${stock.priceChange.toFixed(2)}%` : 'belum tersedia'}

### Dasar Analisis
${stock.analysis || 'Data saham ditemukan terbatas. Gunakan hasil ini sebagai baseline cepat sampai provider data utama dikonfigurasi.'}`)
  }

  if (knowledge.length > 0) {
    parts.push(
      'Berdasarkan basis pengetahuan: ' +
        knowledge
          .slice(0, 3)
          .map((k, i) => `[${i + 1}] ${k.title}: ${k.snippet.slice(0, 150)}`)
          .join(' ')
    )
  }

  if (market.length > 0) {
    parts.push(
      'Berita pasar terkini: ' +
        market
          .slice(0, 2)
          .map((m) => m.title)
          .join('; ')
    )
  }

  if (parts.length === 0) {
    parts.push(
      'Maaf, saya belum memiliki referensi yang memadai untuk pertanyaan ini. Silakan coba pertanyaan lain atau lebih spesifik.'
    )
  }

  parts.push('\n\nCatatan: Analisis ini non-diskrisioner. Keputusan akhir dan eksekusi tetap di tangan pengguna.')

  return parts.join('\n\n')
}
