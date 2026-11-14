import { monthKeyOf, parseISODate, todayISO } from '@/lib/dates'
import { computeStats } from '@/lib/stats'
import type { Stats, Trade } from '@/lib/types'

export type ConsistencyTier = 3 | 6 | 9 | 12

export const CONSISTENCY_TIERS: readonly ConsistencyTier[] = [3, 6, 9, 12]

export interface MonthlyPerformance {
  month: string
  label: string
  net: number
  count: number
  wins: number
  losses: number
  profitable: boolean
  trades: Trade[]
}

export interface ConsistencyTierStatus {
  tier: ConsistencyTier
  title: string
  unlocked: boolean
  progressMonths: number
  remainingMonths: number
  windowMonths: MonthlyPerformance[]
  stats: Stats | null
  rangeLabel: string
}

export interface ConsistencyEvaluation {
  tiers: Record<ConsistencyTier, ConsistencyTierStatus>
  unlockedTiers: ConsistencyTier[]
  highestUnlocked: ConsistencyTier | null
  profitableMonthsCount: number
  currentStreak: number
  longestStreak: number
  months: MonthlyPerformance[]
}

function nextCalendarMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ''
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function formatMonthLabel(ym: string): string {
  return parseISODate(`${ym}-01`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function formatMonthWindowLabel(months: MonthlyPerformance[]): string {
  if (!months.length) return ''
  const first = months[0].month
  const last = months[months.length - 1].month
  const firstDate = parseISODate(`${first}-01`)
  const lastDate = parseISODate(`${last}-01`)
  const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'short' })
  const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'short' })

  if (first === last) {
    return `${firstMonth} ${firstDate.getFullYear()}`
  }
  if (firstDate.getFullYear() === lastDate.getFullYear()) {
    return `${firstMonth} – ${lastMonth} ${lastDate.getFullYear()}`
  }
  return `${firstMonth} ${firstDate.getFullYear()} – ${lastMonth} ${lastDate.getFullYear()}`
}

export function evaluateConsistencyCertificates(
  trades: Trade[],
  startingBalance: number,
): ConsistencyEvaluation {
  const today = todayISO()
  const monthBuckets = new Map<string, MonthlyPerformance>()

  ;(Array.isArray(trades) ? trades : []).forEach((trade) => {
    if (!trade.date || trade.date > today) return
    const ym = monthKeyOf(trade.date)
    if (!/^\d{4}-\d{2}$/.test(ym)) return

    if (!monthBuckets.has(ym)) {
      monthBuckets.set(ym, {
        month: ym,
        label: formatMonthLabel(ym),
        net: 0,
        count: 0,
        wins: 0,
        losses: 0,
        profitable: false,
        trades: [],
      })
    }

    const bucket = monthBuckets.get(ym) as MonthlyPerformance
    bucket.net += Number(trade.pnl) || 0
    bucket.count += 1
    if (trade.pnl > 0) bucket.wins += 1
    else if (trade.pnl < 0) bucket.losses += 1
    bucket.trades.push(trade)
  })

  const months = Array.from(monthBuckets.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      ...bucket,
      profitable: bucket.count > 0 && bucket.net > 0,
    }))

  const profitableMonths = months.filter((m) => m.profitable)
  const profitableMonthsCount = profitableMonths.length

  let longestStreak = 0
  let running: MonthlyPerformance[] = []
  let prevMonth = ''

  for (const month of months) {
    if (month.profitable) {
      if (prevMonth && month.month === nextCalendarMonth(prevMonth)) {
        running.push(month)
      } else {
        running = [month]
      }
      prevMonth = month.month
      longestStreak = Math.max(longestStreak, running.length)
    } else {
      running = []
      prevMonth = ''
    }
  }

  const currentStreak = running.length

  const tiers = {} as Record<ConsistencyTier, ConsistencyTierStatus>
  const unlockedTiers: ConsistencyTier[] = []

  const allTrades = Array.isArray(trades) ? trades : []
  const fallbackRangeLabel = months.length ? formatMonthWindowLabel(months) : ''

  for (const tier of CONSISTENCY_TIERS) {
    const earnedNaturally = profitableMonthsCount >= tier
    const unlocked = true
    if (unlocked) unlockedTiers.push(tier)

    const windowMonths = earnedNaturally
      ? profitableMonths.slice(-tier)
      : profitableMonths.length > 0
        ? profitableMonths.slice(-Math.min(profitableMonthsCount, tier))
        : months.slice(-Math.min(months.length, tier))

    const progressMonths = earnedNaturally ? tier : Math.min(tier, profitableMonthsCount)
    const windowTrades = earnedNaturally ? windowMonths.flatMap((m) => m.trades) : allTrades

    tiers[tier] = {
      tier,
      title: `${tier} Months`,
      unlocked,
      progressMonths,
      remainingMonths: Math.max(0, tier - progressMonths),
      windowMonths,
      stats: computeStats(windowTrades, startingBalance),
      rangeLabel: earnedNaturally ? formatMonthWindowLabel(windowMonths) : fallbackRangeLabel,
    }
  }

  const highestUnlocked = unlockedTiers.length ? unlockedTiers[unlockedTiers.length - 1] : null

  return {
    tiers,
    unlockedTiers,
    highestUnlocked,
    profitableMonthsCount,
    currentStreak,
    longestStreak,
    months,
  }
}
