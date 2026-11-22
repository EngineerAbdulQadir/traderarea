export interface MarketCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketFeedResult {
  ok: true
  source: 'Binance' | 'Yahoo Finance'
  marketSymbol: string
  resolvedInterval: string
  exactWindow: boolean
  resolvedOpenSec: number
  resolvedCloseSec: number
  tzOffsetHours: number
  candles: MarketCandle[]
}

export interface MarketFeedQuery {
  symbol: string
  interval?: string
  date?: string
  openTime?: string
  closeTime?: string
  entry?: number
  exit?: number
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

const SYMBOL_ALIASES: Record<string, string[]> = {
  XAUUSD: ['GC=F', 'XAUUSD=X'],
  GOLD: ['GC=F', 'XAUUSD=X'],
  XAU: ['GC=F', 'XAUUSD=X'],
  GC: ['GC=F'],
  XAGUSD: ['SI=F', 'XAGUSD=X'],
  SILVER: ['SI=F', 'XAGUSD=X'],
  XAG: ['SI=F', 'XAGUSD=X'],
  SI: ['SI=F'],
  CL: ['CL=F'],
  USOIL: ['CL=F'],
  WTI: ['CL=F'],
  CRUDE: ['CL=F'],
  OIL: ['CL=F'],
  UKOIL: ['BZ=F'],
  BRENT: ['BZ=F'],
  NG: ['NG=F'],
  NATGAS: ['NG=F'],
  NQ: ['NQ=F'],
  NAS100: ['NQ=F', '^NDX'],
  USTEC: ['NQ=F', '^NDX'],
  US100: ['NQ=F', '^NDX'],
  NDX: ['NQ=F', '^NDX'],
  NASDAQ: ['NQ=F', '^IXIC'],
  ES: ['ES=F'],
  US500: ['ES=F', '^GSPC'],
  SPX500: ['ES=F', '^GSPC'],
  SP500: ['ES=F', '^GSPC'],
  SPX: ['ES=F', '^GSPC'],
  YM: ['YM=F'],
  US30: ['YM=F', '^DJI'],
  DJ30: ['YM=F', '^DJI'],
  DOW: ['YM=F', '^DJI'],
  DJI: ['YM=F', '^DJI'],
  RTY: ['RTY=F'],
  US2000: ['RTY=F', '^RUT'],
  RUS2000: ['RTY=F', '^RUT'],
  GER40: ['^GDAXI'],
  GER30: ['^GDAXI'],
  DE40: ['^GDAXI'],
  DAX: ['^GDAXI'],
  UK100: ['^FTSE'],
  FTSE100: ['^FTSE'],
  FTSE: ['^FTSE'],
  JP225: ['^N225'],
  NIKKEI: ['^N225'],
  US10Y: ['^TNX'],
  DXY: ['DX-Y.NYB'],
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

const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']
const CANDIDATE_TZ_OFFSETS = [0, 2, 3, 1, -5, -4, 4, 5, 8, 9, -6, -7, -8, -3, -2, -1, 6, 7, 10]

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

  if (SYMBOL_ALIASES[cleaned]) {
    return {
      binanceSymbol: null,
      yahooSymbols: SYMBOL_ALIASES[cleaned],
    }
  }

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

async function safeFetchJson(url: string, headers?: Record<string, string>): Promise<unknown | null> {
  try {
    const res = await fetch(url, headers ? { headers } : undefined)
    if (!res.ok) return null
    const text = await res.text()
    if (!text || text.trimStart().startsWith('<')) return null
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function closestBar(candles: MarketCandle[], targetSec: number): { bar: MarketCandle; timeDist: number } | null {
  if (!candles.length) return null
  let best = candles[0]
  let bestDist = Infinity
  for (const bar of candles) {
    const d = Math.abs(bar.time - targetSec)
    if (d < bestDist) {
      bestDist = d
      best = bar
    }
  }
  return { bar: best, timeDist: bestDist }
}

function priceRangeDistance(price: number, bar: MarketCandle): number {
  if (price < bar.low) return bar.low - price
  if (price > bar.high) return price - bar.high
  return 0
}

function resolveBestTimezoneWindow(
  candles: MarketCandle[],
  openSec: number,
  closeSec: number,
  stepSec: number,
  entryPrice?: number,
  exitPrice?: number,
): { openSec: number; closeSec: number; tzOffsetHours: number } {
  const hasEntry = typeof entryPrice === 'number' && Number.isFinite(entryPrice) && entryPrice > 0
  if (!hasEntry || !candles.length) {
    return { openSec, closeSec, tzOffsetHours: 0 }
  }

  const hasExit = typeof exitPrice === 'number' && Number.isFinite(exitPrice) && exitPrice > 0
  const maxTimeGap = stepSec >= 86400 ? 2 * 86400 : Math.max(stepSec * 4, 900)
  const zeroBarEntry = closestBar(candles, openSec)
  const zeroBarExit = closestBar(candles, closeSec)

  const evaluateOffset = (offsetHours: number) => {
    const candOpen = openSec - offsetHours * 3600
    const candClose = closeSec - offsetHours * 3600
    const eMatch = closestBar(candles, candOpen)
    const xMatch = closestBar(candles, candClose)
    if (!eMatch || !xMatch) return null
    if (eMatch.timeDist > maxTimeGap || xMatch.timeDist > maxTimeGap) return null

    const distE = priceRangeDistance(entryPrice, eMatch.bar)
    const distX = hasExit ? priceRangeDistance(exitPrice, xMatch.bar) : 0
    const deltaErr = hasExit
      ? Math.abs((xMatch.bar.close - eMatch.bar.open) - (exitPrice - entryPrice))
      : 0
    const centerErr =
      Math.abs(entryPrice - eMatch.bar.close) +
      (hasExit ? Math.abs(exitPrice - xMatch.bar.close) : 0)

    return {
      offsetHours,
      candOpen,
      candClose,
      distE,
      distX,
      score: distE + distX + 0.15 * deltaErr + 0.02 * centerErr,
    }
  }

  const zeroEval = evaluateOffset(0)
  if (zeroEval && zeroBarEntry && zeroBarExit) {
    const barRange = Math.max(zeroBarEntry.bar.high - zeroBarEntry.bar.low, entryPrice * 0.0005)
    if (zeroEval.distE <= barRange * 0.5 && zeroEval.distX <= barRange * 0.5) {
      return { openSec, closeSec, tzOffsetHours: 0 }
    }
  }

  let best = zeroEval
  for (const offsetHours of CANDIDATE_TZ_OFFSETS) {
    if (offsetHours === 0) continue
    const cand = evaluateOffset(offsetHours)
    if (!cand) continue
    if (!best || cand.score < best.score) {
      best = cand
    }
  }

  if (!best) {
    return { openSec, closeSec, tzOffsetHours: 0 }
  }

  if (zeroEval && best.offsetHours !== 0 && best.score >= zeroEval.score * 0.65) {
    return { openSec, closeSec, tzOffsetHours: 0 }
  }

  return {
    openSec: best.candOpen,
    closeSec: best.candClose,
    tzOffsetHours: best.offsetHours,
  }
}

function sliceWindow(
  candles: MarketCandle[],
  targetOpenSec: number,
  targetCloseSec: number,
): { slice: MarketCandle[]; exactWindow: boolean } {
  if (!candles.length) return { slice: [], exactWindow: false }
  const firstTime = candles[0].time
  const lastTime = candles[candles.length - 1].time

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
    const start = Math.max(0, entryIdx - 15)
    const end = Math.min(candles.length, exitIdx + 9)
    return { slice: candles.slice(start, end), exactWindow: true }
  }

  return {
    slice: candles.slice(Math.max(0, candles.length - 40)),
    exactWindow: false,
  }
}

async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  openSec: number,
  closeSec: number,
  entryPrice?: number,
  exitPrice?: number,
): Promise<MarketFeedResult | null> {
  const binanceInterval =
    interval === '1m' || interval === '5m' || interval === '15m' || interval === '1h' || interval === '1d'
      ? interval
      : '5m'
  const step = INTERVAL_SECONDS[binanceInterval] ?? 300
  const nowSec = Math.floor(Date.now() / 1000)
  const hasPriceHint = typeof entryPrice === 'number' && Number.isFinite(entryPrice) && entryPrice > 0
  const lookbackSec = hasPriceHint ? Math.max(step * 20, 10 * 3600) : step * 20
  const lookaheadSec = hasPriceHint ? Math.max(step * 20, 6 * 3600) : step * 20
  const effectiveOpen = Math.min(openSec, nowSec - step * 12)
  const startMs = (effectiveOpen - lookbackSec) * 1000
  const endMs = Math.min(nowSec, closeSec + lookaheadSec) * 1000

  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
    symbol,
  )}&interval=${binanceInterval}&startTime=${startMs}&endTime=${endMs}&limit=1000`

  const raw = await safeFetchJson(url)
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
  const resolved = resolveBestTimezoneWindow(
    candles,
    openSec,
    closeSec,
    step,
    entryPrice,
    exitPrice,
  )
  const sliced = sliceWindow(candles, resolved.openSec, resolved.closeSec)
  return {
    ok: true,
    source: 'Binance',
    marketSymbol: symbol,
    resolvedInterval: binanceInterval,
    exactWindow: resolved.openSec <= nowSec && sliced.exactWindow,
    resolvedOpenSec: resolved.openSec,
    resolvedCloseSec: resolved.closeSec,
    tzOffsetHours: resolved.tzOffsetHours,
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

async function fetchYahooCandles(
  yahooSymbol: string,
  requestedInterval: string,
  openSec: number,
  closeSec: number,
  entryPrice?: number,
  exitPrice?: number,
): Promise<MarketFeedResult | null> {
  const nowSec = Math.floor(Date.now() / 1000)
  const ageSec = Math.max(0, nowSec - openSec)
  const order = ['1m', '5m', '15m', '1h', '1d']
  const startPos = Math.max(0, order.indexOf(requestedInterval))
  const candidates = order
    .slice(startPos)
    .filter((iv) => ageSec <= (YAHOO_MAX_AGE_SEC[iv] ?? Infinity))

  const intervalsToTry = candidates.length ? candidates : ['1h', '1d']
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'application/json',
  }

  const hasPriceHint = typeof entryPrice === 'number' && Number.isFinite(entryPrice) && entryPrice > 0

  for (const iv of intervalsToTry) {
    const step = INTERVAL_SECONDS[iv] ?? 300
    const lookbackSec = hasPriceHint ? Math.max(step * 45, 11 * 3600) : Math.max(step * 45, 2 * 86400)
    const lookaheadSec = hasPriceHint ? Math.max(step * 30, 8 * 3600) : Math.max(step * 30, 86400)

    const pathQuery =
      openSec <= nowSec - step
        ? (() => {
            const p1 = Math.max(0, openSec - lookbackSec)
            const p2 = Math.min(nowSec, closeSec + lookaheadSec)
            return `/v8/finance/chart/${encodeURIComponent(
              yahooSymbol,
            )}?period1=${p1}&period2=${p2}&interval=${iv}&includePrePost=true`
          })()
        : (() => {
            const range = iv === '1m' ? '5d' : iv === '1d' ? '6mo' : '10d'
            return `/v8/finance/chart/${encodeURIComponent(
              yahooSymbol,
            )}?range=${range}&interval=${iv}&includePrePost=true`
          })()

    for (const host of YAHOO_HOSTS) {
      const json = await safeFetchJson(`${host}${pathQuery}`, headers)
      if (!json) continue

      let allCandles = parseYahooResult(json)
      let exactWindow = true

      if (allCandles.length < 10) {
        const fallbackRange = iv === '1m' ? '5d' : iv === '1d' ? '6mo' : '15d'
        const fallbackJson = await safeFetchJson(
          `${host}/v8/finance/chart/${encodeURIComponent(
            yahooSymbol,
          )}?range=${fallbackRange}&interval=${iv}&includePrePost=true`,
          headers,
        )
        if (fallbackJson) {
          allCandles = parseYahooResult(fallbackJson)
          exactWindow = false
        }
      }

      if (!allCandles.length) continue
      const resolved = resolveBestTimezoneWindow(
        allCandles,
        openSec,
        closeSec,
        step,
        entryPrice,
        exitPrice,
      )
      const sliced = sliceWindow(allCandles, resolved.openSec, resolved.closeSec)
      if (!sliced.slice.length) continue

      return {
        ok: true,
        source: 'Yahoo Finance',
        marketSymbol: yahooSymbol,
        resolvedInterval: iv,
        exactWindow: exactWindow && sliced.exactWindow,
        resolvedOpenSec: resolved.openSec,
        resolvedCloseSec: resolved.closeSec,
        tzOffsetHours: resolved.tzOffsetHours,
        candles: sliced.slice,
      }
    }
  }

  return null
}

export async function getMarketCandles(query: MarketFeedQuery): Promise<MarketFeedResult | null> {
  const symbol = query.symbol.trim()
  if (!symbol) return null

  const interval = (query.interval ?? '5m').trim() || '5m'
  const date = (query.date ?? '').trim()
  const openTime = (query.openTime ?? '').trim()
  const closeTime = (query.closeTime ?? '').trim()
  const entry =
    typeof query.entry === 'number' && Number.isFinite(query.entry) && query.entry > 0
      ? query.entry
      : undefined
  const exit =
    typeof query.exit === 'number' && Number.isFinite(query.exit) && query.exit > 0
      ? query.exit
      : undefined

  const cacheKey = `${symbol}|${interval}|${date}|${openTime}|${closeTime}|${entry ?? ''}|${exit ?? ''}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload
  }

  const { binanceSymbol, yahooSymbols } = resolveTargets(symbol)
  const { openSec, closeSec } = parseTradeWindow(date, openTime, closeTime)

  let result: MarketFeedResult | null = null
  if (binanceSymbol) {
    result = await fetchBinanceKlines(binanceSymbol, interval, openSec, closeSec, entry, exit)
  }

  if (!result) {
    for (const ySym of yahooSymbols) {
      result = await fetchYahooCandles(ySym, interval, openSec, closeSec, entry, exit)
      if (result) break
    }
  }

  if (result) {
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload: result })
  }

  return result
}
