import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Request, type Response } from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000
const IS_PROD = process.env.NODE_ENV === 'production'

export interface MarketCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface MarketFeedResult {
  ok: true
  source: 'Binance' | 'Yahoo Finance'
  marketSymbol: string
  resolvedInterval: string
  exactWindow: boolean
  candles: MarketCandle[]
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { expiresAt: number; payload: MarketFeedResult }>()

const CRYPTO_QUOTES = ['USDT', 'USD', 'BUSD', 'USDC']
const KNOWN_CRYPTO_BASES = new Set([
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'BNB',
  'ADA',
  'DOGE',
  'AVAX',
  'LTC',
  'LINK',
  'MATIC',
  'DOT',
  'SUI',
  'PEPE',
  'TON',
  'NEAR',
  'ARB',
  'OP',
  'ATOM',
])

const SYMBOL_ALIASES: Record<string, string> = {
  XAUUSD: 'GC=F',
  GOLD: 'GC=F',
  XAU: 'GC=F',
  GC: 'GC=F',
  XAGUSD: 'SI=F',
  SILVER: 'SI=F',
  XAG: 'SI=F',
  SI: 'SI=F',
  CL: 'CL=F',
  USOIL: 'CL=F',
  WTI: 'CL=F',
  CRUDE: 'CL=F',
  OIL: 'CL=F',
  UKOIL: 'BZ=F',
  BRENT: 'BZ=F',
  NG: 'NG=F',
  NATGAS: 'NG=F',
  NQ: 'NQ=F',
  NAS100: 'NQ=F',
  USTEC: 'NQ=F',
  US100: 'NQ=F',
  NDX: 'NQ=F',
  NASDAQ: 'NQ=F',
  ES: 'ES=F',
  US500: 'ES=F',
  SPX500: 'ES=F',
  SP500: 'ES=F',
  SPX: 'ES=F',
  YM: 'YM=F',
  US30: 'YM=F',
  DJ30: 'YM=F',
  DOW: 'YM=F',
  DJI: 'YM=F',
  RTY: 'RTY=F',
  US2000: 'RTY=F',
  RUS2000: 'RTY=F',
  GER40: '^GDAXI',
  GER30: '^GDAXI',
  DE40: '^GDAXI',
  DAX: '^GDAXI',
  UK100: '^FTSE',
  FTSE100: '^FTSE',
  FTSE: '^FTSE',
  JP225: '^N225',
  NIKKEI: '^N225',
  US10Y: '^TNX',
  DXY: 'DX-Y.NYB',
}

const FX_CURRENCIES = new Set([
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'NZD',
  'CNH',
  'SEK',
  'NOK',
  'SGD',
  'HKD',
  'MXN',
  'ZAR',
  'TRY',
])

function cleanTicker(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^\//, '')
    .replace(/(\.PRO|\.RAW|\.ECN|\.STD|\.M|\.I|\.C|_SB|\.CASH)$/i, '')
    .replace(/[^A-Z0-9.-]/g, '')
}

function resolveTargets(rawSymbol: string): {
  binanceSymbol: string | null
  yahooSymbols: string[]
} {
  const cleaned = cleanTicker(rawSymbol)
  if (!cleaned) return { binanceSymbol: null, yahooSymbols: [] }

  // Check crypto pairs first (e.g. BTCUSD, BTCUSDT, BTC-USD, ETH)
  const strippedCrypto = cleaned.replace(/-/g, '')
  for (const quote of CRYPTO_QUOTES) {
    if (strippedCrypto.endsWith(quote)) {
      const base = strippedCrypto.slice(0, -quote.length)
      if (KNOWN_CRYPTO_BASES.has(base)) {
        return {
          binanceSymbol: `${base}USDT`,
          yahooSymbols: [`${base}-USD`],
        }
      }
    }
  }
  if (KNOWN_CRYPTO_BASES.has(strippedCrypto)) {
    return {
      binanceSymbol: `${strippedCrypto}USDT`,
      yahooSymbols: [`${strippedCrypto}-USD`],
    }
  }

  // Known futures / CFD / commodities / indices aliases
  if (SYMBOL_ALIASES[cleaned]) {
    return {
      binanceSymbol: null,
      yahooSymbols: [SYMBOL_ALIASES[cleaned]],
    }
  }

  // 6-letter FX pair like EURUSD, GBPJPY
  if (cleaned.length === 6) {
    const base = cleaned.slice(0, 3)
    const quote = cleaned.slice(3)
    if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) {
      return {
        binanceSymbol: null,
        yahooSymbols: [`${cleaned}=X`],
      }
    }
  }

  return {
    binanceSymbol: null,
    yahooSymbols: [cleaned],
  }
}

function parseTradeWindow(
  dateStr: string,
  openTimeStr: string,
  closeTimeStr: string,
): { openSec: number; closeSec: number } {
  const nowSec = Math.floor(Date.now() / 1000)
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  const parseClock = (clock: string, fallbackH: number, fallbackM: number) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(clock.trim())
    if (!m) return { h: fallbackH, m: fallbackM }
    return {
      h: Math.max(0, Math.min(23, Number(m[1]))),
      m: Math.max(0, Math.min(59, Number(m[2]))),
    }
  }

  if (!dateMatch) {
    return { openSec: nowSec - 3600, closeSec: nowSec }
  }

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2]) - 1
  const day = Number(dateMatch[3])
  const openClock = parseClock(openTimeStr, 9, 30)
  const closeClock = parseClock(closeTimeStr, openClock.h, openClock.m + 45)

  const openSec = Math.floor(Date.UTC(year, month, day, openClock.h, openClock.m, 0) / 1000)
  let closeSec = Math.floor(Date.UTC(year, month, day, closeClock.h, closeClock.m, 0) / 1000)
  if (closeSec <= openSec) closeSec = openSec + 45 * 60

  return { openSec, closeSec }
}

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
}

const YAHOO_MAX_AGE_SEC: Record<string, number> = {
  '1m': 6.5 * 86400,
  '5m': 56 * 86400,
  '15m': 56 * 86400,
  '1h': 700 * 86400,
  '1d': 3650 * 86400,
}

async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  openSec: number,
  closeSec: number,
): Promise<MarketFeedResult | null> {
  const binanceInterval = interval === '1m' || interval === '5m' || interval === '15m' || interval === '1h' || interval === '1d'
    ? interval
    : '5m'
  const step = INTERVAL_SECONDS[binanceInterval] ?? 300
  const nowSec = Math.floor(Date.now() / 1000)
  const effectiveOpen = Math.min(openSec, nowSec - step * 12)
  const startMs = (effectiveOpen - step * 10) * 1000
  const endMs = Math.min(nowSec, closeSec + step * 10) * 1000

  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
    symbol,
  )}&interval=${binanceInterval}&startTime=${startMs}&endTime=${endMs}&limit=240`

  const res = await fetch(url)
  if (!res.ok) return null
  const raw = (await res.json()) as unknown[]
  if (!Array.isArray(raw) || !raw.length) return null

  const candles: MarketCandle[] = []
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue
    const time = Math.floor(Number(row[0]) / 1000)
    const open = Number(row[1])
    const high = Number(row[2])
    const low = Number(row[3])
    const close = Number(row[4])
    const volume = Number(row[5]) || 0
    if (
      Number.isFinite(time) &&
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close)
    ) {
      candles.push({ time, open, high, low, close, volume })
    }
  }

  if (!candles.length) return null
  const sliced = sliceWindow(candles, openSec, closeSec)
  return {
    ok: true,
    source: 'Binance',
    marketSymbol: symbol,
    resolvedInterval: binanceInterval,
    exactWindow: openSec <= nowSec && sliced.exactWindow,
    candles: sliced.slice,
  }
}

function parseYahooResult(json: unknown): MarketCandle[] {
  const result = (json as { chart?: { result?: Array<Record<string, unknown>> } })?.chart
    ?.result?.[0]
  if (!result) return []

  const timestamps = Array.isArray(result.timestamp) ? (result.timestamp as number[]) : []
  const quoteList = (result.indicators as { quote?: Array<Record<string, unknown>> } | undefined)
    ?.quote?.[0]
  if (!timestamps.length || !quoteList) return []

  const opens = (quoteList.open as Array<number | null>) ?? []
  const highs = (quoteList.high as Array<number | null>) ?? []
  const lows = (quoteList.low as Array<number | null>) ?? []
  const closes = (quoteList.close as Array<number | null>) ?? []
  const volumes = (quoteList.volume as Array<number | null>) ?? []

  const seen = new Set<number>()
  const out: MarketCandle[] = []

  for (let i = 0; i < timestamps.length; i++) {
    const time = Number(timestamps[i])
    const open = opens[i]
    const high = highs[i]
    const low = lows[i]
    const close = closes[i]
    const volume = Number(volumes[i]) || 0
    if (
      !Number.isFinite(time) ||
      seen.has(time) ||
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue
    }
    seen.add(time)
    out.push({ time, open, high, low, close, volume })
  }

  return out.sort((a, b) => a.time - b.time)
}

function sliceWindow(
  candles: MarketCandle[],
  targetOpenSec: number,
  targetCloseSec: number,
): { slice: MarketCandle[]; exactWindow: boolean } {
  if (!candles.length) return { slice: [], exactWindow: false }
  const firstTime = candles[0].time
  const lastTime = candles[candles.length - 1].time

  // If the trade timestamp falls within the fetched market range, center right on it
  if (targetOpenSec >= firstTime - 3600 && targetOpenSec <= lastTime + 3600) {
    let entryIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < candles.length; i++) {
      const dist = Math.abs(candles[i].time - targetOpenSec)
      if (dist < bestDist) {
        bestDist = dist
        entryIdx = i
      }
    }
    let exitIdx = entryIdx
    let bestExitDist = Infinity
    for (let i = entryIdx; i < candles.length; i++) {
      const dist = Math.abs(candles[i].time - targetCloseSec)
      if (dist < bestExitDist) {
        bestExitDist = dist
        exitIdx = i
      }
    }
    const start = Math.max(0, entryIdx - 5)
    const end = Math.min(candles.length, exitIdx + 6)
    return { slice: candles.slice(start, end), exactWindow: true }
  }

  // Fallback to recent market candles if requested date was weekend/future/out-of-window
  return {
    slice: candles.slice(Math.max(0, candles.length - 40)),
    exactWindow: false,
  }
}

async function fetchYahooCandles(
  yahooSymbol: string,
  requestedInterval: string,
  openSec: number,
  closeSec: number,
): Promise<MarketFeedResult | null> {
  const nowSec = Math.floor(Date.now() / 1000)
  const ageSec = Math.max(0, nowSec - openSec)
  const order = ['1m', '5m', '15m', '1h', '1d']
  const startPos = Math.max(0, order.indexOf(requestedInterval))
  const candidates = order
    .slice(startPos)
    .filter((iv) => ageSec <= (YAHOO_MAX_AGE_SEC[iv] ?? Infinity))

  const intervalsToTry = candidates.length ? candidates : ['1h', '1d']

  for (const iv of intervalsToTry) {
    const step = INTERVAL_SECONDS[iv] ?? 300
    let url = ''

    if (openSec <= nowSec - step) {
      const p1 = Math.max(0, openSec - Math.max(step * 45, 2 * 86400))
      const p2 = Math.min(nowSec, closeSec + Math.max(step * 30, 86400))
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol,
      )}?period1=${p1}&period2=${p2}&interval=${iv}&includePrePost=true`
    } else {
      const range = iv === '1m' ? '5d' : iv === '1d' ? '6mo' : '10d'
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol,
      )}?range=${range}&interval=${iv}&includePrePost=true`
    }

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradersArea/2.0)' },
      })
      if (!res.ok) continue
      const json = await res.json()
      let allCandles = parseYahooResult(json)

      // If narrow window fell on weekend/holiday closure, retry broader recent real market range
      let exactWindow = true
      if (allCandles.length < 10) {
        const fallbackRange = iv === '1m' ? '5d' : iv === '1d' ? '6mo' : '15d'
        const fallbackUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          yahooSymbol,
        )}?range=${fallbackRange}&interval=${iv}&includePrePost=true`
        const fallbackRes = await fetch(fallbackUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradersArea/2.0)' },
        })
        if (fallbackRes.ok) {
          allCandles = parseYahooResult(await fallbackRes.json())
          exactWindow = false
        }
      }

      if (!allCandles.length) continue
      const sliced = sliceWindow(allCandles, openSec, closeSec)
      if (!sliced.slice.length) continue

      return {
        ok: true,
        source: 'Yahoo Finance',
        marketSymbol: yahooSymbol,
        resolvedInterval: iv,
        exactWindow: exactWindow && sliced.exactWindow,
        candles: sliced.slice,
      }
    } catch {
      // Try next interval/provider
    }
  }

  return null
}

async function createApp() {
  const app = express()

  app.get('/api/market/candles', async (req: Request, res: Response) => {
    const symbol = String(req.query.symbol ?? '').trim()
    const interval = String(req.query.interval ?? '5m').trim()
    const date = String(req.query.date ?? '').trim()
    const openTime = String(req.query.openTime ?? '').trim()
    const closeTime = String(req.query.closeTime ?? '').trim()

    if (!symbol) {
      res.status(400).json({ ok: false, error: 'Symbol is required.' })
      return
    }

    const cacheKey = `${symbol}|${interval}|${date}|${openTime}|${closeTime}`
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload)
      return
    }

    const { binanceSymbol, yahooSymbols } = resolveTargets(symbol)
    const { openSec, closeSec } = parseTradeWindow(date, openTime, closeTime)

    let result: MarketFeedResult | null = null
    if (binanceSymbol) {
      try {
        result = await fetchBinanceKlines(binanceSymbol, interval, openSec, closeSec)
      } catch {
        result = null
      }
    }

    if (!result) {
      for (const ySym of yahooSymbols) {
        result = await fetchYahooCandles(ySym, interval, openSec, closeSec)
        if (result) break
      }
    }

    if (!result) {
      res.status(404).json({
        ok: false,
        error: `No real market candles available for ${symbol}.`,
      })
      return
    }

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload: result })
    res.json(result)
  })

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) {
        next()
        return
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html')
        const rawHtml = fs.readFileSync(indexPath, 'utf-8')
        const html = await vite.transformIndexHtml(req.originalUrl, rawHtml)
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
      } catch (err) {
        vite.ssrFixStacktrace(err as Error)
        next(err)
      }
    })
  } else {
    const distDir = path.resolve(__dirname, 'dist')
    app.use(express.static(distDir))
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}

createApp().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
