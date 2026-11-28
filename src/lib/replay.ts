import type { UTCTimestamp } from 'lightweight-charts'
import { timeToMinutes } from '@/lib/dates'
import { formatHold } from '@/lib/format'
import { tradeHoldMinutes } from '@/lib/trades'
import type { Trade } from '@/lib/types'

export type ReplayTimeframe = '1m' | '5m' | '15m' | '1h'
export type ReplaySource = 'Binance' | 'Coinbase' | 'Yahoo Finance'
export type PriceMatchStatus = 'exact' | 'proxy' | 'mismatch' | 'unknown'
export type PriceAlignment = 'exact' | 'proxy-aligned' | 'mismatch' | 'no-prices'
export type ReplayTzPreference = 'auto' | number

export interface RawMarketCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketFeedPayload {
  ok: true
  source: ReplaySource
  marketSymbol: string
  requestedInterval?: string
  resolvedInterval: string
  exactWindow: boolean
  isProxy?: boolean
  priceMatch?: PriceMatchStatus
  tzMode?: 'manual' | 'auto'
  resolvedOpenSec?: number
  resolvedCloseSec?: number
  tzOffsetHours?: number
  candles: RawMarketCandle[]
}

export interface ReplayCandle {
  index: number
  utcTime: UTCTimestamp
  timeLabel: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  phase: 'pre' | 'in' | 'post'
  isEntry: boolean
  isExit: boolean
  unrealizedPnl: number
  unrealizedR: number
}

export interface ReplaySequence {
  trade: Trade
  timeframe: ReplayTimeframe
  requestedInterval: string
  resolvedInterval: string
  source: ReplaySource
  marketSymbol: string
  exactWindow: boolean
  isProxy: boolean
  tzMode: 'manual' | 'auto'
  tzOffsetHours: number
  basisOffset: number
  basisAligned: boolean
  priceAlignment: PriceAlignment
  hasPrices: boolean
  entryPrice: number
  exitPrice: number
  stopLossPrice: number | null
  takeProfitPrice: number | null
  alignedEntryPrice: number
  alignedExitPrice: number
  alignedStopLossPrice: number | null
  alignedTakeProfitPrice: number | null
  dollarPerPoint: number
  plannedRR: number | null
  entryIndex: number
  exitIndex: number
  candles: ReplayCandle[]
  holdMinutes: number
  holdLabel: string
  openTimeLabel: string
  closeTimeLabel: string
  statementOpenTime: string
  statementCloseTime: string
  priceDigits: number
}

export interface ReplayExcursion {
  mfePrice: number
  maePrice: number
  mfePct: number
  maePct: number
  mfeUsd: number
  maeUsd: number
  capturePct: number | null
  barsInTrade: number
}

const TF_MINUTES: Record<ReplayTimeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
}

function decimalsOnNumber(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0
  const str = value.toString()
  if (!str.includes('.')) return 0
  return Math.min(5, str.split('.')[1]?.length ?? 0)
}

function inferPriceDigits(tradePrices: number[], marketSample: number): number {
  const positiveTrade = tradePrices.filter((v) => Number.isFinite(v) && v > 0)
  const mag = positiveTrade.length ? Math.min(...positiveTrade) : Math.abs(marketSample || 100)
  const tradeDecimals = positiveTrade.length
    ? Math.max(...positiveTrade.map(decimalsOnNumber))
    : 2

  if (mag < 5) return Math.max(4, Math.min(5, tradeDecimals || 5))
  if (mag < 50) return Math.max(3, Math.min(4, tradeDecimals || 3))
  return Math.max(2, Math.min(3, tradeDecimals))
}

function roundTo(value: number, digits: number): number {
  const factor = Math.pow(10, digits)
  return Math.round(value * factor) / factor
}

export function formatUtcClock(utcSeconds: number): string {
  const d = new Date(utcSeconds * 1000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function formatUtcOffset(offsetHours: number): string {
  if (!offsetHours) return 'UTC'
  const sign = offsetHours > 0 ? '+' : '-'
  const abs = Math.abs(offsetHours)
  const hrs = Math.trunc(abs)
  const mins = Math.round((abs - hrs) * 60)
  return mins > 0
    ? `UTC${sign}${hrs}:${String(mins).padStart(2, '0')}`
    : `UTC${sign}${hrs}`
}

function parseUtcTimestamp(isoDate: string, clockStr: string, fallbackMinute = 9 * 60 + 30): number {
  const parts = isoDate.split('-').map(Number)
  const mins = timeToMinutes(clockStr) ?? fallbackMinute
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0) / 1000) + Math.round(mins * 60)
  }
  return Math.floor(Date.now() / 1000)
}

function resolveTradeUtcBounds(trade: Trade): { openSec: number; closeSec: number; holdMinutes: number } {
  const closeDate = trade.date
  const openDate = trade.openDate || trade.date
  let openSec = parseUtcTimestamp(openDate, trade.openTime)
  let closeSec = parseUtcTimestamp(closeDate, trade.closeTime)

  if (!trade.openDate && trade.openTime && trade.closeTime && closeSec <= openSec) {
    // Legacy overnight trade where only close date was saved
    openSec -= 86400
  }

  if (closeSec <= openSec) {
    closeSec = openSec + 60
  }

  const calculatedHold = tradeHoldMinutes(trade)
  const holdMinutes =
    calculatedHold !== null && calculatedHold > 0
      ? calculatedHold
      : Math.max(0, Math.round((closeSec - openSec) / 60))

  return { openSec, closeSec, holdMinutes }
}

export function formatReplayPrice(price: number, digits: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const CLIENT_CRYPTO_BASES = new Set([
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

export function resolveDirectBinanceSymbol(rawTicker: string): string | null {
  const cleaned = rawTicker
    .trim()
    .toUpperCase()
    .replace(/^\//, '')
    .replace(/(\.PRO|\.RAW|\.ECN|\.STD|\.M|\.I|\.C|_SB|\.CASH)$/i, '')
    .replace(/[^A-Z0-9]/g, '')
  for (const quote of ['USDT', 'USD', 'BUSD', 'USDC']) {
    if (cleaned.endsWith(quote)) {
      const base = cleaned.slice(0, -quote.length)
      if (CLIENT_CRYPTO_BASES.has(base)) return `${base}USDT`
    }
  }
  return CLIENT_CRYPTO_BASES.has(cleaned) ? `${cleaned}USDT` : null
}

export function suggestReplayTimeframe(trade: Trade | null): ReplayTimeframe {
  if (!trade) return '1m'
  const { openSec, holdMinutes } = resolveTradeUtcBounds(trade)
  const ageDays = Math.max(0, (Date.now() / 1000 - openSec) / 86400)
  const isCrypto = Boolean(resolveDirectBinanceSymbol(trade.ticker))

  if (isCrypto) {
    if (holdMinutes <= 360) return '1m'
    if (holdMinutes <= 1800) return '5m'
    if (holdMinutes <= 5760) return '15m'
    return '1h'
  }

  if (ageDays > 55) return '1h'
  if (ageDays > 6.2) {
    if (holdMinutes > 1800) return '15m'
    return '5m'
  }
  if (holdMinutes > 240) return '5m'
  return '1m'
}

async function fetchDirectBinanceFallback(
  trade: Trade,
  timeframe: ReplayTimeframe,
  tzPreference: ReplayTzPreference,
  signal?: AbortSignal,
): Promise<MarketFeedPayload | null> {
  const binanceSymbol = resolveDirectBinanceSymbol(trade.ticker)
  if (!binanceSymbol) return null

  const step = (TF_MINUTES[timeframe] ?? 5) * 60
  const { openSec: rawOpenSec, closeSec: rawCloseSec } = resolveTradeUtcBounds(trade)
  const tzOffset = typeof tzPreference === 'number' && Number.isFinite(tzPreference) ? tzPreference : 0
  const openSec = rawOpenSec - tzOffset * 3600
  const closeSec = rawCloseSec - tzOffset * 3600
  const nowSec = Math.floor(Date.now() / 1000)
  if (openSec > nowSec + 14 * 3600) return null

  const startMs = Math.max(0, (openSec - step * 18) * 1000)
  const endMs = Math.min(nowSec, closeSec + step * 12) * 1000
  if (endMs <= startMs) return null

  const candles: RawMarketCandle[] = []
  const seen = new Set<number>()
  let cursorMs = startMs
  for (let page = 0; page < 4 && cursorMs < endMs; page++) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
      binanceSymbol,
    )}&interval=${timeframe}&startTime=${cursorMs}&endTime=${endMs}&limit=1000`
    const res = await fetch(url, { signal })
    if (!res.ok) break
    const raw = (await res.json()) as unknown[]
    if (!Array.isArray(raw) || !raw.length) break

    let lastMs = cursorMs
    for (const row of raw) {
      if (!Array.isArray(row) || row.length < 6) continue
      const openMs = Number(row[0])
      const time = Math.floor(openMs / 1000)
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
        lastMs = Math.max(lastMs, openMs)
      }
    }
    if (raw.length < 1000) break
    const nextCursor = lastMs + step * 1000
    if (nextCursor <= cursorMs) break
    cursorMs = nextCursor
  }

  if (!candles.length) return null
  candles.sort((a, b) => a.time - b.time)
  const firstTime = candles[0].time
  const lastTime = candles[candles.length - 1].time
  if (openSec < firstTime - step * 6 || openSec > lastTime + step * 6) {
    return null
  }

  return {
    ok: true,
    source: 'Binance',
    marketSymbol: binanceSymbol,
    requestedInterval: timeframe,
    resolvedInterval: timeframe,
    exactWindow: true,
    isProxy: false,
    tzMode: typeof tzPreference === 'number' ? 'manual' : 'auto',
    resolvedOpenSec: openSec,
    resolvedCloseSec: closeSec,
    tzOffsetHours: tzOffset,
    candles,
  }
}

export async function fetchRealMarketCandles(
  trade: Trade,
  timeframe: ReplayTimeframe,
  tzPreference: ReplayTzPreference = 'auto',
  signal?: AbortSignal,
): Promise<MarketFeedPayload> {
  const params = new URLSearchParams({
    symbol: trade.ticker,
    interval: timeframe,
    date: trade.date,
    openTime: trade.openTime || '',
    closeTime: trade.closeTime || '',
  })
  if (trade.openDate) params.set('openDate', trade.openDate)
  if (trade.entry > 0) params.set('entry', String(trade.entry))
  if (trade.exit > 0) params.set('exit', String(trade.exit))
  if (typeof tzPreference === 'number' && Number.isFinite(tzPreference)) {
    params.set('tzOffset', String(tzPreference))
  }

  const res = await fetch(`/api/market/candles?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  const rawText = await res.text()
  const trimmed = rawText.trimStart()

  let data: (MarketFeedPayload | { ok: false; error?: string }) | null = null
  if (trimmed && !trimmed.startsWith('<')) {
    try {
      data = JSON.parse(rawText) as MarketFeedPayload | { ok: false; error?: string }
    } catch {
      data = null
    }
  }

  if (!data) {
    const directCrypto = await fetchDirectBinanceFallback(
      trade,
      timeframe,
      tzPreference,
      signal,
    ).catch(() => null)
    if (directCrypto) return directCrypto
    throw new Error(
      `Market data endpoint returned an unexpected response for ${trade.ticker}. Please retry in a moment.`,
    )
  }

  if (!res.ok || !data.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : `No verified market candles available for ${trade.ticker}.`,
    )
  }
  return data
}

function priceDistanceFromBar(price: number, bar: RawMarketCandle): number {
  if (price < bar.low) return bar.low - price
  if (price > bar.high) return price - bar.high
  return 0
}

export function buildRealMarketSequence(
  trade: Trade,
  market: MarketFeedPayload,
  timeframe: ReplayTimeframe,
): ReplaySequence {
  const rawCandles = market.candles
  const entryPrice = Number(trade.entry) || 0
  const exitPrice = Number(trade.exit) || 0
  const hasPrices = entryPrice > 0 && exitPrice > 0

  const rawSl = Number(trade.stopLoss) || 0
  const rawTp = Number(trade.takeProfit) || 0
  const stopLossPrice = rawSl > 0 ? rawSl : null
  const takeProfitPrice = rawTp > 0 ? rawTp : null

  const plannedRR =
    hasPrices && stopLossPrice && takeProfitPrice
      ? (() => {
          const risk = Math.abs(entryPrice - stopLossPrice)
          const reward = Math.abs(takeProfitPrice - entryPrice)
          return risk > 0 ? Math.round((reward / risk) * 100) / 100 : null
        })()
      : null

  const { openSec, closeSec, holdMinutes } = resolveTradeUtcBounds(trade)
  const statementOpenTime = trade.openTime ? trade.openTime.slice(0, 5) : 'Open'
  const statementCloseTime = trade.closeTime ? trade.closeTime.slice(0, 5) : 'Close'
  const holdLabel = holdMinutes > 0 ? formatHold(holdMinutes) : '—'

  const tradePriceSamples = [entryPrice, exitPrice]
  if (stopLossPrice !== null) tradePriceSamples.push(stopLossPrice)
  if (takeProfitPrice !== null) tradePriceSamples.push(takeProfitPrice)
  const priceDigits = inferPriceDigits(tradePriceSamples, rawCandles[0]?.close ?? 100)
  const tzOffsetHours = market.tzOffsetHours ?? 0

  if (!rawCandles.length) {
    return {
      trade,
      timeframe,
      requestedInterval: market.requestedInterval ?? timeframe,
      resolvedInterval: market.resolvedInterval,
      source: market.source,
      marketSymbol: market.marketSymbol,
      exactWindow: market.exactWindow,
      isProxy: Boolean(market.isProxy),
      tzMode: market.tzMode ?? 'auto',
      tzOffsetHours,
      basisOffset: 0,
      basisAligned: false,
      priceAlignment: hasPrices ? 'mismatch' : 'no-prices',
      hasPrices,
      entryPrice,
      exitPrice,
      stopLossPrice,
      takeProfitPrice,
      alignedEntryPrice: entryPrice,
      alignedExitPrice: exitPrice,
      alignedStopLossPrice: stopLossPrice,
      alignedTakeProfitPrice: takeProfitPrice,
      dollarPerPoint: 1,
      plannedRR,
      entryIndex: 0,
      exitIndex: 0,
      candles: [],
      holdMinutes,
      holdLabel,
      openTimeLabel: statementOpenTime,
      closeTimeLabel: statementCloseTime,
      statementOpenTime,
      statementCloseTime,
      priceDigits,
    }
  }

  const PRE_BARS = 15
  const POST_BARS = 8
  const targetOpenSec = market.resolvedOpenSec ?? openSec
  const targetCloseSec = market.resolvedCloseSec ?? closeSec

  let entryIndex = 0
  let bestDist = Infinity
  for (let i = 0; i < rawCandles.length; i++) {
    const dist = Math.abs(rawCandles[i].time - targetOpenSec)
    if (dist < bestDist) {
      bestDist = dist
      entryIndex = i
    }
  }

  let exitIndex = entryIndex
  let bestExitDist = Infinity
  for (let i = entryIndex; i < rawCandles.length; i++) {
    const dist = Math.abs(rawCandles[i].time - targetCloseSec)
    if (dist < bestExitDist) {
      bestExitDist = dist
      exitIndex = i
    }
  }

  const sliceStart = Math.max(0, entryIndex - PRE_BARS)
  const sliceEnd = Math.min(rawCandles.length, exitIndex + POST_BARS + 1)
  const croppedCandles = rawCandles.slice(sliceStart, sliceEnd)
  entryIndex -= sliceStart
  exitIndex -= sliceStart

  const entryBar = croppedCandles[entryIndex] ?? croppedCandles[0]
  const exitBar = croppedCandles[exitIndex] ?? entryBar

  // Evaluate whether the trade's entry/exit prices match the market candles,
  // are a steady futures/index proxy basis offset, or do not match the window.
  let basisOffset = 0
  let basisAligned = false
  let priceAlignment: PriceAlignment = hasPrices ? 'mismatch' : 'no-prices'

  if (hasPrices && entryBar && exitBar && market.priceMatch !== 'mismatch') {
    const entryTol = Math.max((entryBar.high - entryBar.low) * 0.25, entryPrice * 0.0005)
    const exitTol = Math.max((exitBar.high - exitBar.low) * 0.25, exitPrice * 0.0005)
    const entryDist = priceDistanceFromBar(entryPrice, entryBar)
    const exitDist = priceDistanceFromBar(exitPrice, exitBar)

    if (entryDist <= entryTol && exitDist <= exitTol) {
      priceAlignment = 'exact'
    } else if (market.isProxy) {
      const spreadTol = Math.max(entryTol, exitTol)
      const entryMinB = entryPrice - entryBar.high - spreadTol
      const entryMaxB = entryPrice - entryBar.low + spreadTol
      const exitMinB = exitPrice - exitBar.high - spreadTol
      const exitMaxB = exitPrice - exitBar.low + spreadTol
      const overlapMin = Math.max(entryMinB, exitMinB)
      const overlapMax = Math.min(entryMaxB, exitMaxB)
      const midBasis = (overlapMin + overlapMax) / 2

      if (overlapMin <= overlapMax && Math.abs(midBasis) <= entryPrice * 0.015) {
        basisOffset = roundTo(midBasis, priceDigits)
        basisAligned = Math.abs(basisOffset) > 0
        priceAlignment = 'proxy-aligned'
      }
    }
  }

  const isLong = trade.side === 'LONG'
  const signedDir = isLong ? 1 : -1
  const feesAbs = Math.abs(trade.fees) || 0
  const grossVal = trade.gross !== 0 ? trade.gross : trade.pnl + feesAbs
  const netDelta = Math.abs(exitPrice - entryPrice)

  let dollarPerPoint = 1
  const priceMoveMatchesSide =
    hasPrices &&
    netDelta > 1e-8 &&
    ((isLong && (exitPrice - entryPrice) * grossVal >= -1e-6) ||
      (!isLong && (entryPrice - exitPrice) * grossVal >= -1e-6))

  if (priceMoveMatchesSide && Math.abs(grossVal) > 0) {
    dollarPerPoint = Math.abs(grossVal) / netDelta
  } else {
    const riskDenom =
      Math.abs(trade.risk || 0) ||
      (trade.rMultiple && Math.abs(trade.rMultiple) > 1e-6
        ? Math.abs(trade.pnl / trade.rMultiple)
        : 0)
    let maxSwing = 0
    for (let i = entryIndex; i <= exitIndex; i++) {
      const bar = croppedCandles[i]
      if (!bar) continue
      maxSwing = Math.max(maxSwing, Math.abs(bar.close - entryBar.close))
    }
    const excursionBudget = Math.max(riskDenom * 1.4, Math.abs(trade.pnl) * 1.25, 10)
    dollarPerPoint =
      trade.volume > 0 && maxSwing > 0 && trade.volume * maxSwing <= excursionBudget * 3
        ? trade.volume
        : excursionBudget / Math.max(maxSwing, entryBar.close * 0.002, 0.25)
  }

  const riskDenom =
    Math.abs(trade.risk || 0) ||
    (trade.rMultiple && Math.abs(trade.rMultiple) > 1e-6
      ? Math.abs(trade.pnl / trade.rMultiple)
      : 0)

  const alignedEntryPrice =
    priceAlignment === 'exact'
      ? entryPrice
      : priceAlignment === 'proxy-aligned'
        ? entryPrice
        : roundTo(entryBar.close, priceDigits)
  const alignedExitPrice =
    priceAlignment === 'exact'
      ? exitPrice
      : priceAlignment === 'proxy-aligned'
        ? exitPrice
        : roundTo(exitBar.close, priceDigits)
  const alignedStopLossPrice =
    stopLossPrice !== null && (priceAlignment === 'exact' || priceAlignment === 'proxy-aligned')
      ? stopLossPrice
      : null
  const alignedTakeProfitPrice =
    takeProfitPrice !== null && (priceAlignment === 'exact' || priceAlignment === 'proxy-aligned')
      ? takeProfitPrice
      : null

  const candles: ReplayCandle[] = croppedCandles.map((raw, i) => {
    const open = roundTo(raw.open + basisOffset, priceDigits)
    const high = roundTo(raw.high + basisOffset, priceDigits)
    const low = roundTo(raw.low + basisOffset, priceDigits)
    const close = roundTo(raw.close + basisOffset, priceDigits)

    const phase: ReplayCandle['phase'] =
      i < entryIndex ? 'pre' : i <= exitIndex ? 'in' : 'post'

    let unrealizedPnl = 0
    if (phase === 'in') {
      if (i === exitIndex) {
        unrealizedPnl = trade.pnl
      } else {
        unrealizedPnl = roundTo(
          (close - alignedEntryPrice) * signedDir * dollarPerPoint - feesAbs,
          2,
        )
      }
    } else if (phase === 'post') {
      unrealizedPnl = trade.pnl
    }

    const unrealizedR =
      phase === 'pre'
        ? 0
        : i >= exitIndex && trade.rMultiple
          ? roundTo(trade.rMultiple, 2)
          : riskDenom > 0
            ? roundTo(unrealizedPnl / riskDenom, 2)
            : 0

    return {
      index: i,
      utcTime: raw.time as UTCTimestamp,
      timeLabel: formatUtcClock(raw.time),
      open,
      high,
      low,
      close,
      volume: raw.volume,
      phase,
      isEntry: i === entryIndex,
      isExit: i === exitIndex,
      unrealizedPnl,
      unrealizedR,
    }
  })

  const openTimeLabel = candles[entryIndex] ? `${candles[entryIndex].timeLabel} UTC` : statementOpenTime
  const closeTimeLabel = candles[exitIndex] ? `${candles[exitIndex].timeLabel} UTC` : statementCloseTime

  return {
    trade,
    timeframe,
    requestedInterval: market.requestedInterval ?? timeframe,
    resolvedInterval: market.resolvedInterval,
    source: market.source,
    marketSymbol: market.marketSymbol,
    exactWindow: market.exactWindow,
    isProxy: Boolean(market.isProxy),
    tzMode: market.tzMode ?? 'auto',
    tzOffsetHours,
    basisOffset,
    basisAligned,
    priceAlignment,
    hasPrices,
    entryPrice,
    exitPrice,
    stopLossPrice,
    takeProfitPrice,
    alignedEntryPrice,
    alignedExitPrice,
    alignedStopLossPrice,
    alignedTakeProfitPrice,
    dollarPerPoint,
    plannedRR,
    entryIndex,
    exitIndex,
    candles,
    holdMinutes,
    holdLabel,
    openTimeLabel,
    closeTimeLabel,
    statementOpenTime,
    statementCloseTime,
    priceDigits,
  }
}

export function computeReplayExcursion(
  sequence: ReplaySequence | null,
  cursor: number,
): ReplayExcursion | null {
  if (!sequence || !sequence.candles.length || cursor < sequence.entryIndex) {
    return null
  }
  const endIdx = Math.min(cursor, sequence.exitIndex)
  const slice = sequence.candles.slice(sequence.entryIndex, endIdx + 1)
  if (!slice.length) return null

  const isLong = sequence.trade.side === 'LONG'
  const refPrice = sequence.alignedEntryPrice || slice[0].open
  if (!refPrice) return null

  let mfePts = 0
  let maePts = 0
  let mfePrice = refPrice
  let maePrice = refPrice

  for (const bar of slice) {
    const fav = isLong ? bar.high - refPrice : refPrice - bar.low
    const adv = isLong ? refPrice - bar.low : bar.high - refPrice
    if (fav > mfePts) {
      mfePts = fav
      mfePrice = isLong ? bar.high : bar.low
    }
    if (adv > maePts) {
      maePts = adv
      maePrice = isLong ? bar.low : bar.high
    }
  }

  if (
    cursor >= sequence.exitIndex &&
    sequence.hasPrices &&
    (sequence.priceAlignment === 'exact' || sequence.priceAlignment === 'proxy-aligned')
  ) {
    const exitFav = isLong
      ? sequence.alignedExitPrice - refPrice
      : refPrice - sequence.alignedExitPrice
    const exitAdv = isLong
      ? refPrice - sequence.alignedExitPrice
      : sequence.alignedExitPrice - refPrice
    if (exitFav > mfePts) {
      mfePts = exitFav
      mfePrice = sequence.alignedExitPrice
    }
    if (exitAdv > maePts) {
      maePts = exitAdv
      maePrice = sequence.alignedExitPrice
    }
  }

  const mfePct = (mfePts / refPrice) * 100
  const maePct = (maePts / refPrice) * 100
  const mfeUsd = roundTo(mfePts * sequence.dollarPerPoint, 2)
  const maeUsd = roundTo(maePts * sequence.dollarPerPoint, 2)

  const exitMovePts = sequence.hasPrices
    ? isLong
      ? sequence.alignedExitPrice - sequence.alignedEntryPrice
      : sequence.alignedEntryPrice - sequence.alignedExitPrice
    : 0
  const capturePct =
    cursor >= sequence.exitIndex && mfePts > 0 && exitMovePts > 0
      ? Math.min(100, Math.round((exitMovePts / mfePts) * 100))
      : null

  return {
    mfePrice,
    maePrice,
    mfePct,
    maePct,
    mfeUsd,
    maeUsd,
    capturePct,
    barsInTrade: slice.length,
  }
}
