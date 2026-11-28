export interface MarketCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type MarketSource = 'Binance' | 'Coinbase' | 'Yahoo Finance'
export type PriceMatchStatus = 'exact' | 'proxy' | 'mismatch' | 'unknown'

export interface MarketFeedResult {
  ok: true
  source: MarketSource
  marketSymbol: string
  requestedInterval: string
  resolvedInterval: string
  exactWindow: boolean
  isProxy: boolean
  priceMatch: PriceMatchStatus
  tzMode: 'manual' | 'auto'
  resolvedOpenSec: number
  resolvedCloseSec: number
  tzOffsetHours: number
  candles: MarketCandle[]
}

export interface MarketFeedError {
  ok: false
  reason: 'no_symbol' | 'future_date' | 'outside_retention' | 'no_data'
  error: string
}

export interface MarketFeedQuery {
  symbol: string
  interval?: string
  date?: string
  openDate?: string
  openTime?: string
  closeTime?: string
  entry?: number
  exit?: number
  tzOffsetHours?: number
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

const SYMBOL_ALIASES: Record<
  string,
  { yahoo: string[]; binanceFutures?: string; isProxy: boolean }
> = {
  XAUUSD: { yahoo: ['GC=F', 'XAUUSD=X'], binanceFutures: 'XAUUSDT', isProxy: true },
  GOLD: { yahoo: ['GC=F', 'XAUUSD=X'], binanceFutures: 'XAUUSDT', isProxy: true },
  XAU: { yahoo: ['GC=F', 'XAUUSD=X'], binanceFutures: 'XAUUSDT', isProxy: true },
  GC: { yahoo: ['GC=F'], isProxy: false },
  XAGUSD: { yahoo: ['SI=F', 'XAGUSD=X'], binanceFutures: 'XAGUSDT', isProxy: true },
  SILVER: { yahoo: ['SI=F', 'XAGUSD=X'], binanceFutures: 'XAGUSDT', isProxy: true },
  XAG: { yahoo: ['SI=F', 'XAGUSD=X'], binanceFutures: 'XAGUSDT', isProxy: true },
  SI: { yahoo: ['SI=F'], isProxy: false },
  CL: { yahoo: ['CL=F'], isProxy: false },
  USOIL: { yahoo: ['CL=F'], isProxy: true },
  WTI: { yahoo: ['CL=F'], isProxy: true },
  CRUDE: { yahoo: ['CL=F'], isProxy: true },
  OIL: { yahoo: ['CL=F'], isProxy: true },
  UKOIL: { yahoo: ['BZ=F'], isProxy: true },
  BRENT: { yahoo: ['BZ=F'], isProxy: true },
  NG: { yahoo: ['NG=F'], isProxy: false },
  NATGAS: { yahoo: ['NG=F'], isProxy: true },
  NQ: { yahoo: ['NQ=F'], isProxy: false },
  NAS100: { yahoo: ['NQ=F', '^NDX'], isProxy: true },
  USTEC: { yahoo: ['NQ=F', '^NDX'], isProxy: true },
  US100: { yahoo: ['NQ=F', '^NDX'], isProxy: true },
  NDX: { yahoo: ['NQ=F', '^NDX'], isProxy: true },
  NASDAQ: { yahoo: ['NQ=F', '^IXIC'], isProxy: true },
  ES: { yahoo: ['ES=F'], isProxy: false },
  US500: { yahoo: ['ES=F', '^GSPC'], isProxy: true },
  SPX500: { yahoo: ['ES=F', '^GSPC'], isProxy: true },
  SP500: { yahoo: ['ES=F', '^GSPC'], isProxy: true },
  SPX: { yahoo: ['ES=F', '^GSPC'], isProxy: true },
  YM: { yahoo: ['YM=F'], isProxy: false },
  US30: { yahoo: ['YM=F', '^DJI'], isProxy: true },
  DJ30: { yahoo: ['YM=F', '^DJI'], isProxy: true },
  DOW: { yahoo: ['YM=F', '^DJI'], isProxy: true },
  DJI: { yahoo: ['YM=F', '^DJI'], isProxy: true },
  RTY: { yahoo: ['RTY=F'], isProxy: false },
  US2000: { yahoo: ['RTY=F', '^RUT'], isProxy: true },
  RUS2000: { yahoo: ['RTY=F', '^RUT'], isProxy: true },
  GER40: { yahoo: ['^GDAXI'], isProxy: true },
  GER30: { yahoo: ['^GDAXI'], isProxy: true },
  DE40: { yahoo: ['^GDAXI'], isProxy: true },
  DAX: { yahoo: ['^GDAXI'], isProxy: true },
  UK100: { yahoo: ['^FTSE'], isProxy: true },
  FTSE100: { yahoo: ['^FTSE'], isProxy: true },
  FTSE: { yahoo: ['^FTSE'], isProxy: true },
  JP225: { yahoo: ['^N225'], isProxy: true },
  NIKKEI: { yahoo: ['^N225'], isProxy: true },
  US10Y: { yahoo: ['^TNX'], isProxy: true },
  DXY: { yahoo: ['DX-Y.NYB'], isProxy: false },
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
const CANDIDATE_TZ_OFFSETS = [0, 2, 3, 1, -5, -4, 4, 5, 5.5, 8, 9, -6, -7, -8, -3, -2, -1, 6, 7, 10]

function cleanTicker(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^\//, '')
    .replace(/(\.PRO|\.RAW|\.ECN|\.STD|\.M|\.I|\.C|_SB|\.CASH)$/i, '')
    .replace(/[^A-Z0-9.-]/g, '')
}

function resolveTargets(rawSymbol: string): {
  cryptoBase: string | null
  preferUsdQuote: boolean
  binanceSymbol: string | null
  binanceFuturesOnly: boolean
  yahooSymbols: string[]
  isProxy: boolean
} {
  const cleaned = cleanTicker(rawSymbol)
  if (!cleaned) {
    return {
      cryptoBase: null,
      preferUsdQuote: false,
      binanceSymbol: null,
      binanceFuturesOnly: false,
      yahooSymbols: [],
      isProxy: false,
    }
  }

  const strippedCrypto = cleaned.replace(/-/g, '')
  for (const quote of CRYPTO_QUOTES) {
    if (strippedCrypto.endsWith(quote)) {
      const base = strippedCrypto.slice(0, -quote.length)
      if (KNOWN_CRYPTO_BASES.has(base)) {
        return {
          cryptoBase: base,
          preferUsdQuote: quote === 'USD',
          binanceSymbol: `${base}USDT`,
          binanceFuturesOnly: false,
          yahooSymbols: [`${base}-USD`],
          isProxy: quote === 'USD',
        }
      }
    }
  }
  if (KNOWN_CRYPTO_BASES.has(strippedCrypto)) {
    return {
      cryptoBase: strippedCrypto,
      preferUsdQuote: false,
      binanceSymbol: `${strippedCrypto}USDT`,
      binanceFuturesOnly: false,
      yahooSymbols: [`${strippedCrypto}-USD`],
      isProxy: false,
    }
  }

  if (SYMBOL_ALIASES[cleaned]) {
    const alias = SYMBOL_ALIASES[cleaned]
    return {
      cryptoBase: null,
      preferUsdQuote: false,
      binanceSymbol: alias.binanceFutures ?? null,
      binanceFuturesOnly: Boolean(alias.binanceFutures),
      yahooSymbols: alias.yahoo,
      isProxy: alias.isProxy,
    }
  }

  if (cleaned.length === 6) {
    const base = cleaned.slice(0, 3)
    const quote = cleaned.slice(3)
    if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) {
      return {
        cryptoBase: null,
        preferUsdQuote: false,
        binanceSymbol: null,
        binanceFuturesOnly: false,
        yahooSymbols: [`${cleaned}=X`],
        isProxy: false,
      }
    }
  }

  return {
    cryptoBase: null,
    preferUsdQuote: false,
    binanceSymbol: null,
    binanceFuturesOnly: false,
    yahooSymbols: [cleaned],
    isProxy: false,
  }
}

function parseClock(clock: string, fallbackH: number, fallbackM: number): { h: number; m: number; s: number } {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(clock.trim())
  if (!m) return { h: fallbackH, m: fallbackM, s: 0 }
  return {
    h: Math.max(0, Math.min(23, Number(m[1]))),
    m: Math.max(0, Math.min(59, Number(m[2]))),
    s: Math.max(0, Math.min(59, Number(m[3] ?? 0))),
  }
}

function parseIsoParts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
}

function parseTradeWindow(
  dateStr: string,
  openTimeStr: string,
  closeTimeStr: string,
  openDateStr?: string,
): { openSec: number; closeSec: number } {
  const nowSec = Math.floor(Date.now() / 1000)
  const closeParts = parseIsoParts(dateStr)
  if (!closeParts) {
    return { openSec: nowSec - 3600, closeSec: nowSec }
  }

  const openParts = (openDateStr ? parseIsoParts(openDateStr) : null) ?? closeParts
  const openClock = parseClock(openTimeStr, 9, 30)
  const hasExplicitClose = Boolean(closeTimeStr.trim())
  const closeClock = parseClock(
    closeTimeStr,
    openClock.h,
    Math.min(59, openClock.m + 45),
  )

  let openSec = Math.floor(
    Date.UTC(openParts[0], openParts[1], openParts[2], openClock.h, openClock.m, openClock.s) / 1000,
  )
  let closeSec = Math.floor(
    Date.UTC(closeParts[0], closeParts[1], closeParts[2], closeClock.h, closeClock.m, closeClock.s) / 1000,
  )

  if (!openDateStr && openTimeStr.trim() && hasExplicitClose && closeSec <= openSec) {
    // Legacy overnight trade where only the close date was stored.
    openSec -= 86400
  }

  if (closeSec <= openSec) {
    closeSec = openSec + (hasExplicitClose ? 60 : 45 * 60)
  }

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

function resolveTimezoneWindow(
  candles: MarketCandle[],
  openSec: number,
  closeSec: number,
  stepSec: number,
  explicitTzOffsetHours?: number,
  entryPrice?: number,
  exitPrice?: number,
  exchangeGmtOffsetHours?: number,
): { openSec: number; closeSec: number; tzOffsetHours: number; tzMode: 'manual' | 'auto' } {
  if (typeof explicitTzOffsetHours === 'number' && Number.isFinite(explicitTzOffsetHours)) {
    return {
      openSec: openSec - explicitTzOffsetHours * 3600,
      closeSec: closeSec - explicitTzOffsetHours * 3600,
      tzOffsetHours: explicitTzOffsetHours,
      tzMode: 'manual',
    }
  }

  const hasEntry = typeof entryPrice === 'number' && Number.isFinite(entryPrice) && entryPrice > 0
  if (!hasEntry || !candles.length) {
    return { openSec, closeSec, tzOffsetHours: 0, tzMode: 'auto' }
  }

  const hasExit = typeof exitPrice === 'number' && Number.isFinite(exitPrice) && exitPrice > 0
  const maxTimeGap = stepSec >= 86400 ? 2 * 86400 : Math.max(stepSec * 6, 1800)

  const evaluateOffset = (offsetHours: number) => {
    const candOpen = openSec - offsetHours * 3600
    const candClose = closeSec - offsetHours * 3600
    const eMatch = closestBar(candles, candOpen)
    const xMatch = closestBar(candles, candClose)
    if (!eMatch || !xMatch) return null
    if (eMatch.timeDist > maxTimeGap || xMatch.timeDist > maxTimeGap) return null

    const distE = priceRangeDistance(entryPrice, eMatch.bar)
    const distX = hasExit ? priceRangeDistance(exitPrice, xMatch.bar) : 0
    const basisSpread = hasExit
      ? Math.abs((entryPrice - eMatch.bar.close) - (exitPrice - xMatch.bar.close))
      : 0
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
      score: distE + distX + 0.35 * basisSpread + 0.2 * deltaErr + 0.02 * centerErr,
    }
  }

  const zeroEval = evaluateOffset(0)
  if (zeroEval) {
    const zeroEntry = closestBar(candles, openSec)
    const barRange = zeroEntry
      ? Math.max(zeroEntry.bar.high - zeroEntry.bar.low, entryPrice * 0.0005)
      : entryPrice * 0.0005
    if (zeroEval.distE <= barRange * 0.5 && zeroEval.distX <= barRange * 0.5) {
      return { openSec, closeSec, tzOffsetHours: 0, tzMode: 'auto' }
    }
  }

  const candidates = new Set<number>(CANDIDATE_TZ_OFFSETS)
  if (typeof exchangeGmtOffsetHours === 'number' && Number.isFinite(exchangeGmtOffsetHours)) {
    candidates.add(exchangeGmtOffsetHours)
  }

  let best = zeroEval
  for (const offsetHours of candidates) {
    if (offsetHours === 0) continue
    const cand = evaluateOffset(offsetHours)
    if (!cand) continue
    if (!best || cand.score < best.score) {
      best = cand
    }
  }

  if (!best) {
    return { openSec, closeSec, tzOffsetHours: 0, tzMode: 'auto' }
  }

  if (zeroEval && best.offsetHours !== 0 && best.score >= zeroEval.score * 0.7) {
    return { openSec, closeSec, tzOffsetHours: 0, tzMode: 'auto' }
  }

  return {
    openSec: best.candOpen,
    closeSec: best.candClose,
    tzOffsetHours: best.offsetHours,
    tzMode: 'auto',
  }
}

function sliceWindow(
  candles: MarketCandle[],
  targetOpenSec: number,
  targetCloseSec: number,
  stepSec: number,
): { slice: MarketCandle[]; exactWindow: boolean } {
  if (!candles.length) return { slice: [], exactWindow: false }
  const firstTime = candles[0].time
  const lastTime = candles[candles.length - 1].time
  const edgePad = Math.max(stepSec * 6, 3600)

  if (targetOpenSec < firstTime - edgePad || targetOpenSec > lastTime + edgePad) {
    return { slice: [], exactWindow: false }
  }

  let entryIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < candles.length; i++) {
    const dist = Math.abs(candles[i].time - targetOpenSec)
    if (dist < bestDist) {
      bestDist = dist
      entryIdx = i
    }
  }

  // Ensure the matched open bar is actually near the trade timestamp (allow weekend/session open gaps up to 12h on 1h or 4h on intraday)
  const maxEntryGap = stepSec >= 86400 ? 3 * 86400 : Math.max(stepSec * 12, 4 * 3600)
  if (bestDist > maxEntryGap) {
    return { slice: [], exactWindow: false }
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

function assessPriceMatch(
  candles: MarketCandle[],
  resolvedOpenSec: number,
  resolvedCloseSec: number,
  isProxy: boolean,
  entryPrice?: number,
  exitPrice?: number,
): PriceMatchStatus {
  const hasEntry = typeof entryPrice === 'number' && Number.isFinite(entryPrice) && entryPrice > 0
  const hasExit = typeof exitPrice === 'number' && Number.isFinite(exitPrice) && exitPrice > 0
  if (!hasEntry || !candles.length) return 'unknown'

  const eMatch = closestBar(candles, resolvedOpenSec)
  const xMatch = closestBar(candles, resolvedCloseSec)
  if (!eMatch || !xMatch) return 'unknown'

  const eTol = Math.max((eMatch.bar.high - eMatch.bar.low) * 0.25, entryPrice * 0.0005)
  const eDist = priceRangeDistance(entryPrice, eMatch.bar)
  const xDist = hasExit ? priceRangeDistance(exitPrice, xMatch.bar) : 0
  const xTol = hasExit
    ? Math.max((xMatch.bar.high - xMatch.bar.low) * 0.25, exitPrice * 0.0005)
    : eTol

  if (eDist <= eTol && xDist <= xTol) {
    return 'exact'
  }

  if (isProxy && hasExit) {
    const spreadTol = Math.max(eTol, xTol)
    const entryMinB = entryPrice - eMatch.bar.high - spreadTol
    const entryMaxB = entryPrice - eMatch.bar.low + spreadTol
    const exitMinB = exitPrice - xMatch.bar.high - spreadTol
    const exitMaxB = exitPrice - xMatch.bar.low + spreadTol
    const overlapMin = Math.max(entryMinB, exitMinB)
    const overlapMax = Math.min(entryMaxB, exitMaxB)
    const midBasis = (overlapMin + overlapMax) / 2
    if (overlapMin <= overlapMax && Math.abs(midBasis) <= entryPrice * 0.015) {
      return 'proxy'
    }
  }

  return 'mismatch'
}

async function fetchBinanceEndpoint(
  baseUrl: string,
  symbol: string,
  binanceInterval: string,
  startMs: number,
  endMs: number,
  stepSec: number,
): Promise<MarketCandle[]> {
  const stepMs = stepSec * 1000
  const candles: MarketCandle[] = []
  const seen = new Set<number>()
  let cursorMs = startMs
  const maxPages = 5

  for (let page = 0; page < maxPages && cursorMs < endMs; page++) {
    const url = `${baseUrl}?symbol=${encodeURIComponent(
      symbol,
    )}&interval=${binanceInterval}&startTime=${cursorMs}&endTime=${endMs}&limit=1000`
    const raw = await safeFetchJson(url)
    if (!Array.isArray(raw) || !raw.length) break

    let lastTimeMs = cursorMs
    for (const row of raw) {
      if (!Array.isArray(row) || row.length < 6) continue
      const openTimeMs = Number(row[0])
      const time = Math.floor(openTimeMs / 1000)
      const open = Number(row[1])
      const high = Number(row[2])
      const low = Number(row[3])
      const close = Number(row[4])
      const volume = Number(row[5]) || 0
      if (
        Number.isFinite(time) &&
        !seen.has(time) &&
        Number.isFinite(open) &&
        Number.isFinite(high) &&
        Number.isFinite(low) &&
        Number.isFinite(close)
      ) {
        seen.add(time)
        candles.push({ time, open, high, low, close, volume })
        lastTimeMs = Math.max(lastTimeMs, openTimeMs)
      }
    }

    if (raw.length < 1000) break
    const nextCursor = lastTimeMs + stepMs
    if (nextCursor <= cursorMs) break
    cursorMs = nextCursor
  }

  return candles.sort((a, b) => a.time - b.time)
}

async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  openSec: number,
  closeSec: number,
  options: { futuresOnly?: boolean; isProxy?: boolean } = {},
  explicitTzOffsetHours?: number,
  entryPrice?: number,
  exitPrice?: number,
): Promise<MarketFeedResult | null> {
  const binanceInterval =
    interval === '1m' || interval === '5m' || interval === '15m' || interval === '1h' || interval === '1d'
      ? interval
      : '5m'
  const step = INTERVAL_SECONDS[binanceInterval] ?? 300
  const nowSec = Math.floor(Date.now() / 1000)
  if (openSec > nowSec + 14 * 3600) return null

  const hasManualTz = typeof explicitTzOffsetHours === 'number' && Number.isFinite(explicitTzOffsetHours)
  const hasPriceHint = !hasManualTz && typeof entryPrice === 'number' && Number.isFinite(entryPrice) && entryPrice > 0
  const baseOpen = hasManualTz ? openSec - explicitTzOffsetHours * 3600 : openSec
  const baseClose = hasManualTz ? closeSec - explicitTzOffsetHours * 3600 : closeSec

  const lookbackSec = hasPriceHint ? Math.max(step * 20, 14 * 3600) : step * 25
  const lookaheadSec = hasPriceHint ? Math.max(step * 20, 14 * 3600) : step * 20
  const startMs = Math.max(0, (baseOpen - lookbackSec) * 1000)
  const endMs = Math.min(nowSec, baseClose + lookaheadSec) * 1000
  if (endMs <= startMs) return null

  let candles: MarketCandle[] = []
  if (!options.futuresOnly) {
    candles = await fetchBinanceEndpoint(
      'https://api.binance.com/api/v3/klines',
      symbol,
      binanceInterval,
      startMs,
      endMs,
      step,
    )
  }
  if (!candles.length) {
    candles = await fetchBinanceEndpoint(
      'https://fapi.binance.com/fapi/v1/klines',
      symbol,
      binanceInterval,
      startMs,
      endMs,
      step,
    )
  }
  if (!candles.length) return null

  const resolved = resolveTimezoneWindow(
    candles,
    openSec,
    closeSec,
    step,
    explicitTzOffsetHours,
    entryPrice,
    exitPrice,
  )
  const sliced = sliceWindow(candles, resolved.openSec, resolved.closeSec, step)
  if (!sliced.exactWindow || !sliced.slice.length) return null

  const isProxy = Boolean(options.isProxy)
  return {
    ok: true,
    source: 'Binance',
    marketSymbol: symbol,
    requestedInterval: interval,
    resolvedInterval: binanceInterval,
    exactWindow: true,
    isProxy,
    priceMatch: assessPriceMatch(
      sliced.slice,
      resolved.openSec,
      resolved.closeSec,
      isProxy,
      entryPrice,
      exitPrice,
    ),
    tzMode: resolved.tzMode,
    resolvedOpenSec: resolved.openSec,
    resolvedCloseSec: resolved.closeSec,
    tzOffsetHours: resolved.tzOffsetHours,
    candles: sliced.slice,
  }
}

async function fetchCoinbaseCandles(
  base: string,
  interval: string,
  openSec: number,
  closeSec: number,
  explicitTzOffsetHours?: number,
  entryPrice?: number,
  exitPrice?: number,
): Promise<MarketFeedResult | null> {
  const granularityMap: Record<string, { iv: string; sec: number }> = {
    '1m': { iv: '1m', sec: 60 },
    '5m': { iv: '5m', sec: 300 },
    '15m': { iv: '15m', sec: 900 },
    '1h': { iv: '1h', sec: 3600 },
    '1d': { iv: '1d', sec: 86400 },
  }
  const chosen = granularityMap[interval] ?? granularityMap['5m']
  const step = chosen.sec
  const nowSec = Math.floor(Date.now() / 1000)
  if (openSec > nowSec + 14 * 3600) return null

  const hasManualTz = typeof explicitTzOffsetHours === 'number' && Number.isFinite(explicitTzOffsetHours)
  const baseOpen = hasManualTz ? openSec - explicitTzOffsetHours * 3600 : openSec
  const baseClose = hasManualTz ? closeSec - explicitTzOffsetHours * 3600 : closeSec
  const lookback = hasManualTz ? step * 25 : Math.max(step * 20, 4 * 3600)
  const lookahead = hasManualTz ? step * 20 : Math.max(step * 20, 4 * 3600)
  const maxSpan = step * 280
  const startSec = Math.max(0, baseOpen - lookback)
  const endSec = Math.min(nowSec, Math.max(startSec + step * 30, Math.min(baseClose + lookahead, startSec + maxSpan)))

  const product = `${base}-USD`
  const url = `https://api.exchange.coinbase.com/products/${encodeURIComponent(
    product,
  )}/candles?granularity=${step}&start=${new Date(startSec * 1000).toISOString()}&end=${new Date(endSec * 1000).toISOString()}`

  const raw = await safeFetchJson(url, { Accept: 'application/json' })
  if (!Array.isArray(raw) || !raw.length) return null

  const candles: MarketCandle[] = []
  const seen = new Set<number>()
  for (const row of raw) {
    // Coinbase format: [ time, low, high, open, close, volume ]
    if (!Array.isArray(row) || row.length < 6) continue
    const time = Number(row[0])
    const low = Number(row[1])
    const high = Number(row[2])
    const open = Number(row[3])
    const close = Number(row[4])
    const volume = Number(row[5]) || 0
    if (
      Number.isFinite(time) &&
      !seen.has(time) &&
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close)
    ) {
      seen.add(time)
      candles.push({ time, open, high, low, close, volume })
    }
  }
  candles.sort((a, b) => a.time - b.time)
  if (!candles.length) return null

  const resolved = resolveTimezoneWindow(
    candles,
    openSec,
    closeSec,
    step,
    explicitTzOffsetHours,
    entryPrice,
    exitPrice,
  )
  const sliced = sliceWindow(candles, resolved.openSec, resolved.closeSec, step)
  if (!sliced.exactWindow || !sliced.slice.length) return null

  return {
    ok: true,
    source: 'Coinbase',
    marketSymbol: product,
    requestedInterval: interval,
    resolvedInterval: chosen.iv,
    exactWindow: true,
    isProxy: false,
    priceMatch: assessPriceMatch(
      sliced.slice,
      resolved.openSec,
      resolved.closeSec,
      false,
      entryPrice,
      exitPrice,
    ),
    tzMode: resolved.tzMode,
    resolvedOpenSec: resolved.openSec,
    resolvedCloseSec: resolved.closeSec,
    tzOffsetHours: resolved.tzOffsetHours,
    candles: sliced.slice,
  }
}

function parseYahooResult(json: unknown): { candles: MarketCandle[]; gmtOffsetHours?: number } {
  const result = (json as { chart?: { result?: Array<Record<string, unknown>> } })?.chart
    ?.result?.[0]
  if (!result) return { candles: [] }

  const meta = result.meta as { gmtoffset?: number } | undefined
  const gmtOffsetHours =
    typeof meta?.gmtoffset === 'number' && Number.isFinite(meta.gmtoffset)
      ? Math.round(meta.gmtoffset / 3600)
      : undefined

  const timestamps = Array.isArray(result.timestamp) ? (result.timestamp as number[]) : []
  const quoteList = (result.indicators as { quote?: Array<Record<string, unknown>> } | undefined)
    ?.quote?.[0]
  if (!timestamps.length || !quoteList) return { candles: [], gmtOffsetHours }

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

  return {
    candles: out.sort((a, b) => a.time - b.time),
    gmtOffsetHours,
  }
}

async function fetchYahooCandles(
  yahooSymbol: string,
  requestedInterval: string,
  openSec: number,
  closeSec: number,
  isProxy: boolean,
  explicitTzOffsetHours?: number,
  entryPrice?: number,
  exitPrice?: number,
): Promise<MarketFeedResult | null> {
  const nowSec = Math.floor(Date.now() / 1000)
  if (openSec > nowSec + 14 * 3600) return null

  const ageSec = Math.max(0, nowSec - openSec)
  const order = ['1m', '5m', '15m', '1h']
  const startPos = Math.max(0, order.indexOf(requestedInterval))
  const candidates = order
    .slice(startPos)
    .filter((iv) => ageSec <= (YAHOO_MAX_AGE_SEC[iv] ?? Infinity))

  if (!candidates.length) return null
  const intervalsToTry = candidates
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'application/json',
  }

  const hasManualTz = typeof explicitTzOffsetHours === 'number' && Number.isFinite(explicitTzOffsetHours)
  const hasPriceHint = !hasManualTz && typeof entryPrice === 'number' && Number.isFinite(entryPrice) && entryPrice > 0
  const baseOpen = hasManualTz ? openSec - explicitTzOffsetHours * 3600 : openSec
  const baseClose = hasManualTz ? closeSec - explicitTzOffsetHours * 3600 : closeSec

  for (const iv of intervalsToTry) {
    const step = INTERVAL_SECONDS[iv] ?? 300
    const lookbackSec = hasPriceHint ? Math.max(step * 45, 13 * 3600) : Math.max(step * 45, 12 * 3600)
    const lookaheadSec = hasPriceHint ? Math.max(step * 30, 13 * 3600) : Math.max(step * 30, 12 * 3600)

    const p1 = Math.max(0, baseOpen - lookbackSec)
    const p2 = Math.min(nowSec, Math.max(p1 + step * 10, baseClose + lookaheadSec))
    if (p2 <= p1) continue

    const pathQuery = `/v8/finance/chart/${encodeURIComponent(
      yahooSymbol,
    )}?period1=${p1}&period2=${p2}&interval=${iv}&includePrePost=true`

    for (const host of YAHOO_HOSTS) {
      const json = await safeFetchJson(`${host}${pathQuery}`, headers)
      if (!json) continue

      const { candles: allCandles, gmtOffsetHours } = parseYahooResult(json)
      if (!allCandles.length) continue

      const resolved = resolveTimezoneWindow(
        allCandles,
        openSec,
        closeSec,
        step,
        explicitTzOffsetHours,
        entryPrice,
        exitPrice,
        gmtOffsetHours,
      )
      const sliced = sliceWindow(allCandles, resolved.openSec, resolved.closeSec, step)
      if (!sliced.exactWindow || !sliced.slice.length) continue

      return {
        ok: true,
        source: 'Yahoo Finance',
        marketSymbol: yahooSymbol,
        requestedInterval,
        resolvedInterval: iv,
        exactWindow: true,
        isProxy,
        priceMatch: assessPriceMatch(
          sliced.slice,
          resolved.openSec,
          resolved.closeSec,
          isProxy,
          entryPrice,
          exitPrice,
        ),
        tzMode: resolved.tzMode,
        resolvedOpenSec: resolved.openSec,
        resolvedCloseSec: resolved.closeSec,
        tzOffsetHours: resolved.tzOffsetHours,
        candles: sliced.slice,
      }
    }
  }

  return null
}

export async function getMarketCandlesDetailed(
  query: MarketFeedQuery,
): Promise<MarketFeedResult | MarketFeedError> {
  const symbol = query.symbol.trim()
  if (!symbol) {
    return { ok: false, reason: 'no_symbol', error: 'Symbol is required.' }
  }

  const interval = (query.interval ?? '5m').trim() || '5m'
  const date = (query.date ?? '').trim()
  const openDate = (query.openDate ?? '').trim()
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
  const tzOffsetHours =
    typeof query.tzOffsetHours === 'number' && Number.isFinite(query.tzOffsetHours)
      ? query.tzOffsetHours
      : undefined

  const cacheKey = `${symbol}|${interval}|${openDate}|${date}|${openTime}|${closeTime}|${entry ?? ''}|${exit ?? ''}|${tzOffsetHours ?? 'auto'}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload
  }

  const {
    cryptoBase,
    preferUsdQuote,
    binanceSymbol,
    binanceFuturesOnly,
    yahooSymbols,
    isProxy,
  } = resolveTargets(symbol)
  const { openSec, closeSec } = parseTradeWindow(date, openTime, closeTime, openDate)
  const nowSec = Math.floor(Date.now() / 1000)

  if (openSec - (tzOffsetHours ?? 0) * 3600 > nowSec + 14 * 3600) {
    return {
      ok: false,
      reason: 'future_date',
      error: `Trade date (${openDate || date}) is in the future — market candles do not exist yet.`,
    }
  }

  let result: MarketFeedResult | null = null

  if (cryptoBase && preferUsdQuote) {
    result = await fetchCoinbaseCandles(
      cryptoBase,
      interval,
      openSec,
      closeSec,
      tzOffsetHours,
      entry,
      exit,
    )
  }

  if (!result && binanceSymbol) {
    result = await fetchBinanceKlines(
      binanceSymbol,
      interval,
      openSec,
      closeSec,
      {
        futuresOnly: binanceFuturesOnly,
        isProxy: isProxy || preferUsdQuote,
      },
      tzOffsetHours,
      entry,
      exit,
    )
  }

  if (!result && cryptoBase && !preferUsdQuote) {
    result = await fetchCoinbaseCandles(
      cryptoBase,
      interval,
      openSec,
      closeSec,
      tzOffsetHours,
      entry,
      exit,
    )
  }

  if (!result) {
    for (const ySym of yahooSymbols) {
      result = await fetchYahooCandles(
        ySym,
        interval,
        openSec,
        closeSec,
        isProxy,
        tzOffsetHours,
        entry,
        exit,
      )
      if (result) break
    }
  }

  if (result) {
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload: result })
    return result
  }

  const ageDays = Math.floor(Math.max(0, nowSec - openSec) / 86400)
  if (!binanceSymbol && ageDays > 56) {
    return {
      ok: false,
      reason: 'outside_retention',
      error: `Intraday candles for ${symbol} on ${openDate || date} (${ageDays}d ago) exceed Yahoo Finance intraday retention (7d for 1m, 56d for 5m/15m, ~700d for 1h).`,
    }
  }

  return {
    ok: false,
    reason: 'no_data',
    error: `No verified market candles found for ${symbol} around ${openDate || date} ${openTime || ''}. The market may have been closed or the ticker may need a standard symbol.`,
  }
}

export async function getMarketCandles(query: MarketFeedQuery): Promise<MarketFeedResult | null> {
  const res = await getMarketCandlesDetailed(query)
  return res.ok ? res : null
}
