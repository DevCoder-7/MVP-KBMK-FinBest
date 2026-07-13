type AssetLike = {
  ticker: string
  type: string
  price: number
  prevPrice: number
  price5dAgo?: number
}

export type MarketProvider = 'yahoo' | 'twelvedata' | 'fallback'

export interface MarketQuote {
  ticker: string
  symbol: string
  provider: MarketProvider
  price: number
  previousClose: number
  price5dAgo?: number
  change: number
  changePct: number
  currency: string
  exchange?: string
  marketState?: string
  asOf: string
  sourceUrl: string
  delayMinutes?: number
  /** Quote berhasil diambil dari provider eksternal; bukan jaminan real-time. */
  isLive: boolean
}

export interface MarketSnapshot {
  quotes: Record<string, MarketQuote>
  provider: MarketProvider
  requested: number
  resolved: number
  updatedAt: string
  delayMinutes?: number
  note?: string
}

type CacheEntry = {
  expiresAt: number
  quote: MarketQuote | null
}

declare global {
  var __finbestMarketQuoteCache: Map<string, CacheEntry> | undefined
}

const DEFAULT_CACHE_TTL_MS = 30_000
const DEFAULT_TIMEOUT_MS = 4_000
const IDX_TICKER = /^[A-Z]{4}$/

function cache() {
  if (!globalThis.__finbestMarketQuoteCache) {
    globalThis.__finbestMarketQuoteCache = new Map()
  }
  return globalThis.__finbestMarketQuoteCache
}

function cacheTtlMs() {
  const parsed = Number(process.env.MARKET_CACHE_TTL_MS)
  return Number.isFinite(parsed) && parsed >= 5_000
    ? parsed
    : DEFAULT_CACHE_TTL_MS
}

function timeoutMs() {
  const parsed = Number(process.env.MARKET_FETCH_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed >= 1_000
    ? parsed
    : DEFAULT_TIMEOUT_MS
}

function isQuotedAsset(asset: AssetLike) {
  return asset.type === 'SAHAM' && IDX_TICKER.test(asset.ticker)
}

function toYahooSymbol(ticker: string) {
  if (ticker.includes('.') || ticker.startsWith('^')) return ticker
  return `${ticker}.JK`
}

function toTwelveDataSymbol(ticker: string) {
  if (ticker.includes('/') || ticker.includes(':')) return ticker
  return ticker
}

async function fetchJsonWithTimeout(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs())
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'FinBest-MVP/1.0',
      },
    })
    if (!res.ok) return null
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

function numberOrUndefined(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function getYahooQuote(asset: AssetLike): Promise<MarketQuote | null> {
  const symbol = toYahooSymbol(asset.ticker)
  const intradayUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=1d&interval=1m`
  const historyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=5d&interval=1d`
  const [intradayData, historyData] = await Promise.all([
    fetchJsonWithTimeout(intradayUrl),
    fetchJsonWithTimeout(historyUrl),
  ])
  const data = intradayData ?? historyData
  const result = data?.chart?.result?.[0]
  const meta = result?.meta
  if (!meta) return null

  const quote = result?.indicators?.quote?.[0]
  const closes = Array.isArray(quote?.close)
    ? quote.close.filter((value: unknown) => Number.isFinite(Number(value)))
    : []
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const latestClose = closes.length > 0 ? Number(closes[closes.length - 1]) : undefined
  const historyResult = historyData?.chart?.result?.[0]
  const historyQuote = historyResult?.indicators?.quote?.[0]
  const historyCloses = Array.isArray(historyQuote?.close)
    ? historyQuote.close.filter((value: unknown) => Number.isFinite(Number(value)))
    : []
  const price5dAgo =
    historyCloses.length > 1
      ? Number(historyCloses[0])
      : numberOrUndefined(meta.chartPreviousClose)
  const price =
    numberOrUndefined(meta.regularMarketPrice) ??
    latestClose ??
    numberOrUndefined(meta.previousClose) ??
    asset.price
  const previousClose =
    numberOrUndefined(meta.previousClose) ??
    numberOrUndefined(meta.chartPreviousClose) ??
    asset.prevPrice ??
    price
  if (!Number.isFinite(price) || price <= 0) return null

  const asOfSeconds =
    numberOrUndefined(meta.regularMarketTime) ??
    numberOrUndefined(timestamps[timestamps.length - 1])
  const asOf = asOfSeconds
    ? new Date(asOfSeconds * 1000).toISOString()
    : new Date().toISOString()
  const change = price - previousClose
  const changePct = previousClose > 0 ? (change / previousClose) * 100 : 0

  return {
    ticker: asset.ticker,
    symbol,
    provider: 'yahoo',
    price,
    previousClose,
    price5dAgo,
    change,
    changePct,
    currency: meta.currency ?? 'IDR',
    exchange: meta.exchangeName ?? meta.fullExchangeName,
    marketState: meta.marketState,
    asOf,
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    delayMinutes: 10,
    isLive: true,
  }
}

async function getTwelveDataQuote(asset: AssetLike): Promise<MarketQuote | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return null

  const symbol = toTwelveDataSymbol(asset.ticker)
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
    symbol
  )}&apikey=${encodeURIComponent(apiKey)}`
  const data = await fetchJsonWithTimeout(url)
  if (!data || data.status === 'error') return null

  const price = numberOrUndefined(data.close ?? data.price)
  const previousClose = numberOrUndefined(data.previous_close) ?? asset.prevPrice
  if (!price || price <= 0) return null

  const change = numberOrUndefined(data.change) ?? price - previousClose
  const changePct =
    numberOrUndefined(data.percent_change) ??
    (previousClose > 0 ? (change / previousClose) * 100 : 0)

  return {
    ticker: asset.ticker,
    symbol,
    provider: 'twelvedata',
    price,
    previousClose,
    change,
    changePct,
    currency: data.currency ?? 'USD',
    exchange: data.exchange,
    asOf: data.timestamp
      ? new Date(Number(data.timestamp) * 1000).toISOString()
      : new Date().toISOString(),
    sourceUrl: `https://twelvedata.com/`,
    isLive: true,
  }
}

async function getQuote(
  asset: AssetLike,
  bypassCache = false
): Promise<MarketQuote | null> {
  if (!isQuotedAsset(asset)) return null

  const key = `${asset.ticker}:${asset.price}:${asset.prevPrice}`
  const cached = cache().get(key)
  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.quote
  }

  const provider = process.env.MARKET_DATA_PROVIDER?.toLowerCase()
  const quote =
    provider === 'twelvedata'
      ? (await getTwelveDataQuote(asset)) ?? (await getYahooQuote(asset))
      : (await getYahooQuote(asset)) ?? (await getTwelveDataQuote(asset))

  cache().set(key, {
    expiresAt: Date.now() + cacheTtlMs(),
    quote,
  })
  return quote
}

export async function getLiveMarketSnapshot(
  assets: AssetLike[],
  options: { bypassCache?: boolean } = {}
): Promise<MarketSnapshot> {
  const quotedAssets = assets.filter(isQuotedAsset)
  if (quotedAssets.length === 0) {
    return {
      quotes: {},
      provider: 'fallback',
      requested: 0,
      resolved: 0,
      updatedAt: new Date().toISOString(),
      note: 'Tidak ada aset saham IDX yang dapat disegarkan.',
    }
  }

  const settled = await Promise.allSettled(
    quotedAssets.map((asset) => getQuote(asset, options.bypassCache))
  )
  const quotes: Record<string, MarketQuote> = {}
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value) {
      quotes[result.value.ticker] = result.value
    }
  }

  const providers = new Set(Object.values(quotes).map((quote) => quote.provider))
  const delayMinutes = Math.max(
    0,
    ...Object.values(quotes).map((quote) => quote.delayMinutes ?? 0)
  )
  return {
    quotes,
    provider:
      providers.size === 1
        ? (Array.from(providers)[0] as MarketProvider)
        : Object.keys(quotes).length > 0
          ? 'yahoo'
          : 'fallback',
    requested: quotedAssets.length,
    resolved: Object.keys(quotes).length,
    updatedAt: new Date().toISOString(),
    delayMinutes: delayMinutes || undefined,
    note:
      Object.keys(quotes).length > 0
        ? delayMinutes > 0
          ? `Data saham IDX dari Yahoo Finance tersedia dengan jeda sekitar ${delayMinutes} menit; aset non-saham tetap memakai data NAV/seeded.`
          : 'Data harga provider eksternal digunakan untuk saham IDX; aset non-saham tetap memakai data NAV/seeded.'
        : 'Provider market tidak tersedia, memakai data seeded dari database.',
  }
}

export function livePriceFor(asset: AssetLike, snapshot: MarketSnapshot) {
  const quote = snapshot.quotes[asset.ticker]
  return {
    price: quote?.price ?? asset.price,
    prevPrice: quote?.previousClose ?? asset.prevPrice,
    price5dAgo: quote?.price5dAgo ?? asset.price5dAgo ?? asset.price,
    quote: quote ?? null,
  }
}
