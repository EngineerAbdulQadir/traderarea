import type { Account, Trade } from '@/lib/types'
import { addDays, clamp, dateToISO, startOfDay, todayISO } from '@/lib/dates'

export const DEMO_LOOKBACK_DAYS = 125

interface DemoMarket {
  ticker: string
  kind: 'ETF' | 'Equity' | 'Future'
  price: number
  multiplier: number
  volume: [number, number]
}

export const DEMO_MARKETS: DemoMarket[] = [
  { ticker: 'SPY', kind: 'ETF', price: 612.4, multiplier: 1, volume: [100, 700] },
  { ticker: 'QQQ', kind: 'ETF', price: 548.2, multiplier: 1, volume: [100, 600] },
  { ticker: 'NVDA', kind: 'Equity', price: 181.6, multiplier: 1, volume: [100, 800] },
  { ticker: 'AAPL', kind: 'Equity', price: 236.4, multiplier: 1, volume: [100, 700] },
  { ticker: 'TSLA', kind: 'Equity', price: 421.8, multiplier: 1, volume: [80, 500] },
  { ticker: 'META', kind: 'Equity', price: 608.3, multiplier: 1, volume: [50, 300] },
  { ticker: '/ES', kind: 'Future', price: 6142.5, multiplier: 50, volume: [1, 8] },
  { ticker: '/NQ', kind: 'Future', price: 21738.0, multiplier: 20, volume: [1, 6] },
  { ticker: '/CL', kind: 'Future', price: 68.42, multiplier: 1000, volume: [1, 4] },
]

export const DEMO_PLAYBOOKS = [
  'Opening Range Break',
  'VWAP Reclaim',
  'Liquidity Sweep',
  'Trend Pullback',
  'Gap Fill',
  'Failed Breakout',
  'Momentum Continuation',
]

export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0
  return function random() {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickFrom<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]
}

export function generateDemoTrades(account: Account): Trade[] {
  const seed = hashString(`${account.id}|${account.startingBalance || account.size || 0}`)
  const rng = mulberry32(seed)
  const starting = Number(account.startingBalance) || Number(account.size) || 100_000
  const baseRisk = Math.max(35, Math.round(starting * 0.0024))
  const today = startOfDay(new Date())
  const trades: Trade[] = []

  for (let offset = DEMO_LOOKBACK_DAYS; offset >= 0; offset--) {
    const day = addDays(today, -offset)
    const dow = day.getDay()
    if (dow === 0 || dow === 6) continue
    if (rng() < 0.075) continue

    const moodRoll = rng()
    const mood = moodRoll < 0.16 ? 'red' : moodRoll < 0.205 ? 'flat' : 'green'
    const count = 1 + Math.floor(rng() * 4)

    for (let i = 0; i < count; i++) {
      const winChance = mood === 'red' ? 0.33 : mood === 'flat' ? 0.47 : 0.64
      const isWin = rng() < winChance
      let r: number
      if (isWin) {
        r = 0.55 + rng() * 1.65
        if (rng() < 0.045) r += 0.9
      } else {
        r = -(0.35 + rng() * 0.9)
        if (rng() < 0.035) r -= 1.1
      }
      if (mood === 'flat') r *= 0.32

      let market = pickFrom(rng, DEMO_MARKETS)
      if (market.kind === 'Future' && rng() < 0.55) {
        market = DEMO_MARKETS[6 + Math.floor(rng() * 3)]
      }
      const risk = Math.round(baseRisk * (0.82 + rng() * 0.36))
      const fees = Math.round(2 + rng() * 7)
      const pnl = Math.round(r * risk * (0.86 + rng() * 0.28)) - fees
      const gross = pnl + fees

      const openMinute = 9 * 60 + 32 + Math.floor(rng() * 336)
      const duration = 4 + Math.floor(rng() * 116)
      const closeMinute = Math.min(15 * 60 + 58, openMinute + duration)
      const openSecond = Math.floor(rng() * 60)
      const closeSecond = Math.floor(rng() * 60)
      const timeString = (minutes: number) =>
        `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
      const side = rng() < 0.56 ? 'LONG' : 'SHORT'
      const [volumeMin, volumeMax] = market.volume
      const volume = volumeMin + Math.floor(rng() * (volumeMax - volumeMin + 1))
      const priceDigits = market.price > 50 ? 2 : 3
      const entry = Number((market.price * (0.992 + rng() * 0.016)).toFixed(priceDigits))
      const move = (gross / (volume * market.multiplier || 1)) * (side === 'LONG' ? 1 : -1)
      const exit = Number((entry + move).toFixed(priceDigits))
      const notional = Math.max(1, volume * entry * market.multiplier)
      const roi = (pnl / notional) * 100
      const monthCode =
        day.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() +
        String(day.getFullYear()).slice(-2)
      const instrument =
        market.kind === 'Future' ? `${market.ticker} · ${monthCode}` : `${market.ticker} · ${market.kind}`

      trades.push({
        id: `${account.id}-demo-${offset}-${i}`,
        accountId: account.id,
        date: dateToISO(day),
        openTime: `${timeString(openMinute)}:${String(openSecond).padStart(2, '0')}`,
        closeTime: `${timeString(closeMinute)}:${String(closeSecond).padStart(2, '0')}`,
        ticker: market.ticker,
        instrument,
        side,
        volume,
        entry: Number.isFinite(entry) ? entry : 0,
        exit: Number.isFinite(exit) ? exit : 0,
        pnl,
        gross,
        fees,
        roi,
        rMultiple: pnl / risk,
        risk,
        playbook: pickFrom(rng, DEMO_PLAYBOOKS),
        quality: Math.round(clamp(42 + (pnl / risk) * 25 + (isWin ? 10 : 0), 4, 98)),
        tags: rng() < 0.18 ? [pickFrom(rng, ['news', 'patience', 'momentum', 'fomo'])] : [],
        note: '',
        manual: false,
      })
    }
  }

  return trades.sort((a, b) => (a.date + a.openTime).localeCompare(b.date + b.openTime))
}

const demoCache = new Map<string, Trade[]>()

export function getDemoTrades(account: Account): Trade[] {
  const key = `${account.id}|${todayISO()}`
  if (!demoCache.has(key)) demoCache.set(key, generateDemoTrades(account))
  return demoCache.get(key) ?? []
}
