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

  let longestStreak = 0
  let running: MonthlyPerformance[] = []
  let prevMonth = ''

  const qualifyingWindows: Record<ConsistencyTier, MonthlyPerformance[] | null> = {
    3: null,
    6: null,
    9: null,
    12: null,
  }

  for (const month of months) {
    if (month.profitable) {
      if (prevMonth && month.month === nextCalendarMonth(prevMonth)) {
        running.push(month)
      } else {
        running = [month]
      }
      prevMonth = month.month
      longestStreak = Math.max(longestStreak, running.length)

      for (const tier of CONSISTENCY_TIERS) {
        if (running.length >= tier) {
          qualifyingWindows[tier] = running.slice(-tier)
        }
      }
    } else {
      running = []
      prevMonth = ''
    }
  }

  const currentStreak = running.length

  const tiers = {} as Record<ConsistencyTier, ConsistencyTierStatus>
  const unlockedTiers: ConsistencyTier[] = []

  for (const tier of CONSISTENCY_TIERS) {
    const windowMonths = qualifyingWindows[tier]
    const unlocked = Boolean(windowMonths && windowMonths.length === tier)
    if (unlocked) unlockedTiers.push(tier)

    const progressMonths = unlocked ? tier : Math.min(tier, longestStreak)
    const windowTrades = windowMonths ? windowMonths.flatMap((m) => m.trades) : []

    tiers[tier] = {
      tier,
      title: `${tier} Months`,
      unlocked,
      progressMonths,
      remainingMonths: Math.max(0, tier - progressMonths),
      windowMonths: windowMonths ?? months.slice(-Math.min(months.length, tier)),
      stats: unlocked ? computeStats(windowTrades, startingBalance) : null,
      rangeLabel: windowMonths ? formatMonthWindowLabel(windowMonths) : '',
    }
  }

  const highestUnlocked = unlockedTiers.length ? unlockedTiers[unlockedTiers.length - 1] : null

  return {
    tiers,
    unlockedTiers,
    highestUnlocked,
    currentStreak,
    longestStreak,
    months,
  }
}
