import type { Trade } from '@/lib/types'
import {
  addDays,
  dateToISO,
  formatShortDate,
  mondayOf,
  monthName,
  parseISODate,
  startOfDay,
  todayISO,
} from '@/lib/dates'
import {
  avgOf,
  computeStats,
  groupStats,
  hourLabel,
  tradeDow,
  WD_SHORT,
  WEEKDAYS,
  type GroupStats,
} from '@/lib/stats'
import { tradeHoldMinutes, tradeHour } from '@/lib/trades'
import { formatHold, formatMoney, plainPercent, signedMoney } from '@/lib/format'

export type ReportPeriod =
  | 'all'
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | '30'
  | '90'
  | '365'

export type ReportTab =
  | 'overview'
  | 'dow'
  | 'tod'
  | 'month'
  | 'symbol'
  | 'side'
  | 'duration'
  | 'lot'
  | 'tags'

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'this-week', label: 'This week' },
  { value: 'last-week', label: 'Last week' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
]

export const REPORT_TABS: { id: ReportTab; label: string; group?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'dow', label: 'Day of week', group: 'timing' },
  { id: 'tod', label: 'Time of day', group: 'timing' },
  { id: 'month', label: 'Month', group: 'timing' },
  { id: 'symbol', label: 'Symbol', group: 'markets' },
  { id: 'side', label: 'Side', group: 'markets' },
  { id: 'duration', label: 'Duration', group: 'execution' },
  { id: 'lot', label: 'Lot size', group: 'execution' },
  { id: 'tags', label: 'Tags', group: 'execution' },
]

export function reportBounds(period: ReportPeriod): { start: string; end: string; label: string } {
  const today = startOfDay(new Date())
  if (period === 'this-week') {
    return { start: dateToISO(mondayOf(today)), end: dateToISO(today), label: 'This week' }
  }
  if (period === 'last-week') {
    const start = addDays(mondayOf(today), -7)
    return { start: dateToISO(start), end: dateToISO(addDays(start, 6)), label: 'Last week' }
  }
  if (period === 'this-month') {
    return {
      start: dateToISO(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: dateToISO(today),
      label: monthName(today),
    }
  }
  if (period === 'last-month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return {
      start: dateToISO(start),
      end: dateToISO(new Date(today.getFullYear(), today.getMonth(), 0)),
      label: monthName(start),
    }
  }
  if (period === '30') return { start: dateToISO(addDays(today, -29)), end: dateToISO(today), label: 'Last 30 days' }
  if (period === '90') return { start: dateToISO(addDays(today, -89)), end: dateToISO(today), label: 'Last 90 days' }
  if (period === '365') return { start: dateToISO(addDays(today, -364)), end: dateToISO(today), label: 'Last 12 months' }
  return { start: '', end: dateToISO(today), label: 'All time' }
}

export function inBounds(trades: Trade[], bounds: { start: string; end: string }): Trade[] {
  return trades.filter(
    (trade) => (!bounds.start || trade.date >= bounds.start) && trade.date <= bounds.end,
  )
}

export function rpUsd(value: number, signed = false): string {
  const v = Number(value) || 0
  const body = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v))
  if (!signed) return `${v < 0 ? '-' : ''}${body}`
  return v > 0 ? `+${body}` : v < 0 ? `-${body}` : body
}

export function rpTone(value: number): string {
  return value > 0 ? 'is-pos' : value < 0 ? 'is-neg' : ''
}

export function tagsOf(trade: Trade): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const source = [
    ...(Array.isArray(trade.tags) ? trade.tags : []),
    ...(trade.playbook && trade.playbook !== '—' ? [trade.playbook] : []),
  ]
  source.forEach((raw) => {
    const tag = String(raw).trim()
    if (!tag || seen.has(tag.toLowerCase())) return
    seen.add(tag.toLowerCase())
    out.push(tag)
  })
  return out.length ? out : ['Untagged']
}

export interface ReportOverviewData {
  bestMonth: GroupStats | null
  worstMonth: GroupStats | null
  avgMonth: number | null
  monthRows: { key: string; label: string; net: number; count: number }[]
  tradeRows: { label: string; value: string; tone: string; small?: string }[]
  dayRows: { label: string; value: string; tone: string; small?: string }[]
  stats: ReturnType<typeof computeStats>
}

function row(label: string, value: string, tone = '', small = '') {
  return { label, value, tone, small }
}

export function buildReportOverview(trades: Trade[], starting: number): ReportOverviewData {
  const stats = computeStats(trades, starting)
  const months = Array.from(groupStats(trades, (trade) => trade.date.slice(0, 7)).values()).sort((a, b) =>
    String(a.key).localeCompare(String(b.key)),
  )
  const bestMonth = months.length ? months.reduce((a, b) => (b.net > a.net ? b : a)) : null
  const worstMonth = months.length ? months.reduce((a, b) => (b.net < a.net ? b : a)) : null
  const monthLabel = (key: string) =>
    parseISODate(`${key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const avgMonth = months.length ? stats.net / months.length : null

  const wins = trades.filter((trade) => trade.pnl > 0)
  const losses = trades.filter((trade) => trade.pnl < 0)
  const holds = (arr: Trade[]) =>
    avgOf(arr.map(tradeHoldMinutes).filter((value): value is number => value !== null))
  const holdStr = (arr: Trade[]) => {
    const hold = holds(arr)
    return hold ? formatHold(hold) : '—'
  }
  const fees = trades.reduce((sum, trade) => sum + (Number(trade.fees) || 0), 0)
  const largestWin = wins.length ? Math.max(...wins.map((trade) => trade.pnl)) : null
  const largestLoss = losses.length ? Math.min(...losses.map((trade) => trade.pnl)) : null
  const dash = '—'

  const tradeRows = [
    row('Total P&L', rpUsd(stats.net, true), rpTone(stats.net)),
    row('Total trades', String(stats.count)),
    row(
      'Win rate',
      stats.count ? `${plainPercent(stats.winRate)}%` : dash,
      '',
      `${stats.wins}W/${stats.losses}L/${stats.be}BE`,
    ),
    row('Average winning trade', wins.length ? rpUsd(stats.avgWin, true) : dash, wins.length ? 'is-pos' : 'is-dim'),
    row('Average losing trade', losses.length ? rpUsd(-stats.avgLoss, true) : dash, losses.length ? 'is-neg' : 'is-dim'),
    row('Average trade P&L', stats.count ? rpUsd(stats.avgTrade, true) : dash, stats.count ? rpTone(stats.avgTrade) : 'is-dim'),
    row('Largest profit', largestWin === null ? dash : rpUsd(largestWin, true), largestWin === null ? 'is-dim' : 'is-pos'),
    row('Largest loss', largestLoss === null ? dash : rpUsd(largestLoss, true), largestLoss === null ? 'is-dim' : 'is-neg'),
    row('Profit factor', stats.grossLoss ? stats.pf.toFixed(2) : stats.grossProfit ? '∞' : dash, stats.grossLoss || stats.grossProfit ? '' : 'is-dim'),
    row('Total commissions', rpUsd(fees)),
    row('Avg hold time', holdStr(trades)),
    row('Avg hold (winning)', holdStr(wins)),
    row('Avg hold (losing)', holdStr(losses)),
  ]

  const bestDay = stats.bestDay && stats.bestDay.pnl > 0 ? stats.bestDay : null
  const worstDay = stats.worstDay && stats.worstDay.pnl < 0 ? stats.worstDay : null
  const dayRows = [
    row('Trading days', String(stats.dayRows.length)),
    row('Winning days', String(stats.greenDays)),
    row('Losing days', String(stats.redDays)),
    row('Breakeven days', String(stats.flatDays)),
    row('Average daily P&L', stats.dayRows.length ? rpUsd(stats.net / stats.dayRows.length, true) : dash, stats.dayRows.length ? rpTone(stats.net) : 'is-dim'),
    row('Largest profitable day', bestDay ? rpUsd(bestDay.pnl, true) : dash, bestDay ? 'is-pos' : 'is-dim', bestDay ? formatShortDate(bestDay.date) : ''),
    row('Largest losing day', worstDay ? rpUsd(worstDay.pnl, true) : dash, worstDay ? 'is-neg' : 'is-dim', worstDay ? formatShortDate(worstDay.date) : ''),
  ]

  return {
    bestMonth,
    worstMonth,
    avgMonth,
    monthRows: months.map((month) => ({
      key: String(month.key),
      label: monthLabel(String(month.key)),
      net: month.net,
      count: month.count,
    })),
    tradeRows,
    dayRows,
    stats,
  }
}

const RP_DURATION: [string, number, number][] = [
  ['< 1m', 0, 1],
  ['1–5m', 1, 5],
  ['5–15m', 5, 15],
  ['15–30m', 15, 30],
  ['30–60m', 30, 60],
  ['1–2h', 60, 120],
  ['2h+', 120, Infinity],
]

const RP_LOTS: [string, number, number][] = [
  ['< 1', 0, 1],
  ['1 – 5', 1, 5],
  ['5 – 25', 5, 25],
  ['25 – 100', 25, 100],
  ['100 – 250', 100, 250],
  ['250 – 500', 250, 500],
  ['500+', 500, Infinity],
]

export interface BreakdownRow {
  label: string
  short: string
  group: GroupStats | null
}

export interface BreakdownData {
  title: string
  head: string
  style: 'rows' | 'cols'
  note?: string
  rows: BreakdownRow[]
  excluded: number
}

function ladder(trades: Trade[], valueFn: (trade: Trade) => number | null, ranges: [string, number, number][]): { rows: BreakdownRow[]; excluded: number } {
  const known = trades.filter((trade) => {
    const value = valueFn(trade)
    return value !== null && Number.isFinite(value)
  })
  const groups = groupStats(known, (trade) => {
    const value = valueFn(trade)
    if (value === null) return null
    const hit = ranges.find((range) => value >= range[1] && value < range[2])
    return hit ? hit[0] : null
  })
  return {
    rows: ranges.map((range) => ({ label: range[0], short: range[0], group: groups.get(range[0]) ?? null })),
    excluded: trades.length - known.length,
  }
}

export function buildBreakdown(tab: Exclude<ReportTab, 'overview'>, trades: Trade[]): BreakdownData {
  if (tab === 'dow') {
    const map = groupStats(trades, tradeDow)
    const order = [1, 2, 3, 4, 5, ...(map.has(6) ? [6] : []), ...(map.has(0) ? [0] : [])]
    return {
      title: 'Day of week',
      head: 'Day',
      style: 'cols',
      rows: order.map((day) => ({
        label: WEEKDAYS[day],
        short: WD_SHORT[day],
        group: map.get(day) ?? null,
      })),
      excluded: 0,
    }
  }

  if (tab === 'tod') {
    const known = trades.filter((trade) => tradeHour(trade) !== null)
    const map = groupStats(known, tradeHour)
    if (!map.size) {
      return { title: 'Time of day', head: 'Entry hour', style: 'cols', rows: [], excluded: trades.length }
    }
    const hours = Array.from(map.keys()).map(Number)
    const lo = Math.min(...hours)
    const hi = Math.max(...hours)
    const rows: BreakdownRow[] = []
    for (let hour = lo; hour <= hi; hour++) {
      rows.push({
        label: `${hourLabel(hour)}–${hourLabel(hour + 1)}`,
        short: String(hour).padStart(2, '0'),
        group: map.get(hour) ?? null,
      })
    }
    return {
      title: 'Time of day',
      head: 'Entry hour',
      style: 'cols',
      note: 'Grouped by the hour the trade was opened.',
      rows,
      excluded: trades.length - known.length,
    }
  }

  if (tab === 'month') {
    const map = groupStats(trades, (trade) => trade.date.slice(0, 7))
    const keys = Array.from(map.keys()).map(String).sort().slice(-12)
    return {
      title: 'Month',
      head: 'Month',
      style: 'cols',
      rows: keys.map((key) => {
        const date = parseISODate(`${key}-01`)
        return {
          label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          short: `${date.toLocaleDateString('en-US', { month: 'short' })} ’${String(date.getFullYear()).slice(2)}`,
          group: map.get(key) ?? null,
        }
      }),
      excluded: 0,
    }
  }

  if (tab === 'symbol') {
    const rows = Array.from(groupStats(trades, (trade) => (trade.ticker && trade.ticker !== '—' ? trade.ticker : null)).values())
      .sort((a, b) => b.net - a.net)
    return {
      title: 'Symbol',
      head: 'Symbol',
      style: 'rows',
      rows: rows.map((group) => ({ label: String(group.key), short: String(group.key), group })),
      excluded: 0,
    }
  }

  if (tab === 'side') {
    const map = groupStats(trades, (trade) => trade.side)
    return {
      title: 'Side',
      head: 'Side',
      style: 'rows',
      rows: ['LONG', 'SHORT']
        .filter((side) => map.has(side))
        .map((side) => ({
          label: side === 'LONG' ? 'Long' : 'Short',
          short: side === 'LONG' ? 'Long' : 'Short',
          group: map.get(side) ?? null,
        })),
      excluded: 0,
    }
  }

  if (tab === 'duration') {
    const data = ladder(trades, tradeHoldMinutes, RP_DURATION)
    return {
      title: 'Duration',
      head: 'Hold time',
      style: 'cols',
      note: 'Trades without a close time are not included.',
      ...data,
    }
  }

  if (tab === 'lot') {
    const data = ladder(trades, (trade) => Number(trade.volume), RP_LOTS)
    return {
      title: 'Lot size',
      head: 'Lots / quantity',
      style: 'cols',
      note: 'Ranges include their lower bound. Shares, contracts and lots share one scale.',
      ...data,
    }
  }

  const exploded: Trade[] = []
  trades.forEach((trade) => {
    tagsOf(trade).forEach((tag) => {
      exploded.push({ ...trade, ticker: tag })
    })
  })
  const rows = Array.from(groupStats(exploded, (trade) => trade.ticker).values()).sort((a, b) => b.net - a.net)
  return {
    title: 'Tags',
    head: 'Tag',
    style: 'rows',
    note: 'A trade with several tags counts under each of them. Setups count as tags.',
    rows: rows.map((group) => ({ label: String(group.key), short: String(group.key), group })),
    excluded: 0,
  }
}

export function reportDemoLabel(count: number): string {
  return `${count} sample trades`
}

export function formatReportMoney(value: number): string {
  return formatMoney(value)
}

export function reportToday(): string {
  return todayISO()
}

export function signedReportMoney(value: number): string {
  return signedMoney(value)
}
