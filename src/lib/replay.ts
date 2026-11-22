import type { UTCTimestamp } from 'lightweight-charts'
import { timeToMinutes } from '@/lib/dates'
import { formatHold } from '@/lib/format'
import type { Trade } from '@/lib/types'

export type ReplayTimeframe = '1m' | '5m' | '15m' | '1h'

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
  source: 'Binance' | 'Yahoo Finance'
  marketSymbol: string
  resolvedInterval: string
  exactWindow: boolean
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
  resolvedInterval: string
  source: 'Binance' | 'Yahoo Finance'
  marketSymbol: string
  exactWindow: boolean
  basisAligned: boolean
  hasPrices: boolean
  entryPrice: number
  exitPrice: number
  stopLossPrice: number | null
  takeProfitPrice: number | null
  plannedRR: number | null
  entryIndex: number
  exitIndex: number
  candles: ReplayCandle[]
  holdMinutes: number
  holdLabel: string
  openTimeLabel: string
  closeTimeLabel: string
  priceDigits: number
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

function formatUtcClock(utcSeconds: number): string {
  const d = new Date(utcSeconds * 1000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function parseUtcTimestamp(isoDate: string, clockStr: string, fallbackMinute = 9 * 60 + 30): number {
  const parts = isoDate.split('-').map(Number)
  const mins = timeToMinutes(clockStr) ?? fallbackMinute
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0) / 1000) + mins * 60
  }
  return Math.floor(Date.now() / 1000)
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

function resolveDirectBinanceSymbol(rawTicker: string): string | null {
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

async function fetchDirectBinanceFallback(
  trade: Trade,
  timeframe: ReplayTimeframe,
  signal?: AbortSignal,
): Promise<MarketFeedPayload | null> {
  const binanceSymbol = resolveDirectBinanceSymbol(trade.ticker)
  if (!binanceSymbol) return null

  const step = (TF_MINUTES[timeframe] ?? 5) * 60
  const openSec = parseUtcTimestamp(trade.date, trade.openTime)
  const closeSec = Math.max(openSec + step * 3, parseUtcTimestamp(trade.date, trade.closeTime))
  const nowSec = Math.floor(Date.now() / 1000)
  const effectiveOpen = Math.min(openSec, nowSec - step * 12)
  const startMs = (effectiveOpen - step * 10) * 1000
  const endMs = Math.min(nowSec, closeSec + step * 10) * 1000

  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
    binanceSymbol,
  )}&interval=${timeframe}&startTime=${startMs}&endTime=${endMs}&limit=240`

  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const raw = (await res.json()) as unknown[]
  if (!Array.isArray(raw) || !raw.length) return null

  const candles: RawMarketCandle[] = []
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

  return {
    ok: true,
    source: 'Binance',
    marketSymbol: binanceSymbol,
    resolvedInterval: timeframe,
    exactWindow: openSec <= nowSec,
    candles,
  }
}

export async function fetchRealMarketCandles(
  trade: Trade,
  timeframe: ReplayTimeframe,
  signal?: AbortSignal,
): Promise<MarketFeedPayload> {
  const params = new URLSearchParams({
    symbol: trade.ticker,
    interval: timeframe,
    date: trade.date,
    openTime: trade.openTime || '',
    closeTime: trade.closeTime || '',
  })
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
    const directCrypto = await fetchDirectBinanceFallback(trade, timeframe, signal).catch(
      () => null,
    )
    if (directCrypto) return directCrypto
    throw new Error(
      `Market data endpoint returned an unexpected response for ${trade.ticker}. Please retry in a moment.`,
    )
  }

  if (!res.ok || !data.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : `No market data available for ${trade.ticker}.`,
    )
  }
  return data
}

export function buildRealMarketSequence(
  trade: Trade,
  market: MarketFeedPayload,
  timeframe: ReplayTimeframe,
): ReplaySequence {
  const rawCandles = market.candles
  const tfMinutes = TF_MINUTES[timeframe]
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

  const openMinutesRaw = timeToMinutes(trade.openTime)
  const closeMinutesRaw = timeToMinutes(trade.closeTime)
  const holdMinutes =
    openMinutesRaw !== null && closeMinutesRaw !== null && closeMinutesRaw > openMinutesRaw
      ? closeMinutesRaw - openMinutesRaw
      : 0
  const openTimeLabel = trade.openTime ? trade.openTime.slice(0, 5) : 'Open'
  const closeTimeLabel = trade.closeTime ? trade.closeTime.slice(0, 5) : 'Close'
  const holdLabel = holdMinutes > 0 ? formatHold(holdMinutes) : '—'

  const tradePriceSamples = [entryPrice, exitPrice]
  if (stopLossPrice !== null) tradePriceSamples.push(stopLossPrice)
  if (takeProfitPrice !== null) tradePriceSamples.push(takeProfitPrice)
  const priceDigits = inferPriceDigits(tradePriceSamples, rawCandles[0]?.close ?? 100)

  if (!rawCandles.length) {
    return {
      trade,
      timeframe,
      resolvedInterval: market.resolvedInterval,
      source: market.source,
      marketSymbol: market.marketSymbol,
      exactWindow: market.exactWindow,
      basisAligned: false,
      hasPrices,
      entryPrice,
      exitPrice,
      stopLossPrice,
      takeProfitPrice,
      plannedRR,
      entryIndex: 0,
      exitIndex: 0,
      candles: [],
      holdMinutes,
      holdLabel,
      openTimeLabel,
      closeTimeLabel,
      priceDigits,
    }
  }

  // Locate entryIndex & exitIndex cleanly, keeping only ~5 bars before entry and ~5 bars after exit
  const PRE_BARS = 5
  const POST_BARS = 5
  let entryIndex = Math.min(rawCandles.length - 2, Math.floor(rawCandles.length * 0.3))
  let exitIndex = Math.min(rawCandles.length - 1, entryIndex + Math.max(2, Math.min(12, Math.round((holdMinutes || tfMinutes * 6) / tfMinutes))))

  if (market.exactWindow) {
    const targetOpenSec = parseUtcTimestamp(trade.date, trade.openTime)
    const targetCloseSec = parseUtcTimestamp(trade.date, trade.closeTime)

    let bestDist = Infinity
    for (let i = 0; i < rawCandles.length; i++) {
      const dist = Math.abs(rawCandles[i].time - targetOpenSec)
      if (dist < bestDist) {
        bestDist = dist
        entryIndex = i
      }
    }
    if (entryIndex >= rawCandles.length - 1) {
      entryIndex = Math.max(0, rawCandles.length - 4)
    }

    let bestExitDist = Infinity
    exitIndex = Math.min(rawCandles.length - 1, entryIndex + 1)
    for (let i = entryIndex; i < rawCandles.length; i++) {
      const dist = Math.abs(rawCandles[i].time - targetCloseSec)
      if (dist < bestExitDist) {
        bestExitDist = dist
        exitIndex = i
      }
    }
    if (exitIndex <= entryIndex && entryIndex < rawCandles.length - 1) {
      exitIndex = entryIndex + 1
    }
  } else {
    // Match closest time-of-day bar in the latest real trading session when date was out of range
    const targetMod = openMinutesRaw ?? 9 * 60 + 30
    let bestModDist = Infinity
    const maxStart = Math.max(0, rawCandles.length - 8)
    for (let i = Math.min(PRE_BARS, maxStart); i <= maxStart; i++) {
      const d = new Date(rawCandles[i].time * 1000)
      const mod = d.getUTCHours() * 60 + d.getUTCMinutes()
      const dist = Math.abs(mod - targetMod)
      if (dist < bestModDist) {
        bestModDist = dist
        entryIndex = i
      }
    }
    const barSpan = Math.max(3, Math.min(14, Math.round((holdMinutes || tfMinutes * 6) / tfMinutes)))
    exitIndex = Math.min(rawCandles.length - 1, entryIndex + barSpan)
  }

  const sliceStart = Math.max(0, entryIndex - PRE_BARS)
  const sliceEnd = Math.min(rawCandles.length, exitIndex + POST_BARS + 1)
  const croppedCandles = rawCandles.slice(sliceStart, sliceEnd)
  entryIndex -= sliceStart
  exitIndex -= sliceStart

  // Keep raw real market prices untouched unless broker/demo quote differs by >3.5%
  const refPrice = croppedCandles[entryIndex]?.close || croppedCandles[0].close
  let basisOffset = 0
  let basisAligned = false
  if (hasPrices && refPrice > 0 && Math.abs(entryPrice - refPrice) / refPrice > 0.035) {
    basisOffset = entryPrice - refPrice
    basisAligned = true
  }

  const isLong = trade.side === 'LONG'
  const signedDir = isLong ? 1 : -1
  const feesAbs = Math.abs(trade.fees) || 0
  const grossVal = trade.gross !== 0 ? trade.gross : trade.pnl + feesAbs
  const netDelta = Math.abs(exitPrice - entryPrice)
  const entryRefClose = croppedCandles[entryIndex]?.close ?? refPrice
  const exitRefClose = croppedCandles[exitIndex]?.close ?? entryRefClose

  const candleMatchesTradePath =
    market.exactWindow &&
    hasPrices &&
    netDelta > 1e-6 &&
    Math.abs(exitRefClose - exitPrice) <= Math.max(netDelta * 0.5, refPrice * 0.004)

  const riskDenom =
    Math.abs(trade.risk || 0) ||
    (trade.rMultiple && Math.abs(trade.rMultiple) > 1e-6
      ? Math.abs(trade.pnl / trade.rMultiple)
      : 0)

  let dollarPerPoint = 1
  if (candleMatchesTradePath) {
    dollarPerPoint = Math.abs(grossVal) / netDelta
  } else {
    let maxSwing = 0
    for (let i = entryIndex; i <= exitIndex; i++) {
      const bar = croppedCandles[i]
      if (!bar) continue
      maxSwing = Math.max(maxSwing, Math.abs(bar.close - entryRefClose))
    }
    const excursionBudget = Math.max(riskDenom * 1.4, Math.abs(trade.pnl) * 1.25, 10)
    const rawPerPoint =
      netDelta > 1e-6 && Math.abs(grossVal) > 0
        ? Math.abs(grossVal) / netDelta
        : trade.volume > 0 && maxSwing > 0 && trade.volume * maxSwing <= excursionBudget * 2
          ? trade.volume
          : excursionBudget / Math.max(maxSwing, refPrice * 0.002, 0.25)
    dollarPerPoint =
      maxSwing > 1e-6
        ? Math.min(rawPerPoint, excursionBudget / maxSwing)
        : rawPerPoint
  }

  const pnlBasePrice = candleMatchesTradePath ? entryPrice : entryRefClose

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
      } else if (i === entryIndex) {
        unrealizedPnl = roundTo(-feesAbs, 2)
      } else {
        const refClose = candleMatchesTradePath ? close : raw.close
        unrealizedPnl = roundTo(
          (refClose - pnlBasePrice) * signedDir * dollarPerPoint - feesAbs,
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

  return {
    trade,
    timeframe,
    resolvedInterval: market.resolvedInterval,
    source: market.source,
    marketSymbol: market.marketSymbol,
    exactWindow: market.exactWindow,
    basisAligned,
    hasPrices,
    entryPrice,
    exitPrice,
    stopLossPrice,
    takeProfitPrice,
    plannedRR,
    entryIndex,
    exitIndex,
    candles,
    holdMinutes,
    holdLabel,
    openTimeLabel,
    closeTimeLabel,
    priceDigits,
  }
}
