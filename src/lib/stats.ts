import type {
  Account,
  DayRow,
  EdgeScore,
  Insight,
  RuleRow,
  ScoreComponent,
  Stats,
  Trade,
} from '@/lib/types'
import { tradeHoldMinutes, tradeHour } from '@/lib/trades'
import { addDays, clamp, dateToISO, formatShortDate, parseISODate, startOfDay, todayISO } from '@/lib/dates'
import { formatHold, formatMoney, plainPercent, signedMoney } from '@/lib/format'

export const DASHBOARD_RANGES: Record<string, { days: number | null; label: string }> = {
  '30': { days: 30, label: 'Last 30 days' },
  '90': { days: 90, label: 'Last 90 days' },
  '180': { days: 180, label: 'Last 6 months' },
  '365': { days: 365, label: 'Last 12 months' },
  all: { days: null, label: 'All time' },
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function rangeCutoff(key: string): string {
  if (key === 'all' || !DASHBOARD_RANGES[key]) return ''
  const days = DASHBOARD_RANGES[key].days ?? 0
  return dateToISO(addDays(startOfDay(new Date()), -(days - 1)))
}

export function filterByRange(trades: Trade[], key: string): Trade[] {
  const cutoff = rangeCutoff(key)
  const today = todayISO()
  return trades.filter((trade) => trade.date <= today && (!cutoff || trade.date >= cutoff))
}

export function filterByDateRange(trades: Trade[], from: string, to: string): Trade[] {
  const today = todayISO()
  const lower = from && to && from > to ? to : from
  const upper = from && to && from > to ? from : to
  const end = upper && upper <= today ? upper : today
  return trades.filter((trade) => {
    if (!trade.date || trade.date > end) return false
    return !lower || trade.date >= lower
  })
}

export function getStartingBalance(account: Account | null | undefined): number {
  if (!account) return 0
  return (
    Number(account.startingBalance) ||
    Number(account.size) ||
    Number(account.challengeSize) ||
    0
  )
}

export function computeStats(trades: Trade[], startingBalance: number): Stats {
  const list = Array.isArray(trades) ? trades : []
  const starting = Number(startingBalance) || 0
  const wins = list.filter((trade) => trade.pnl > 0)
  const losses = list.filter((trade) => trade.pnl < 0)
  const be = list.filter((trade) => trade.pnl === 0)
  const closed = wins.length + losses.length + be.length
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const net = list.reduce((sum, trade) => sum + trade.pnl, 0)
  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const avgWl = avgLoss ? avgWin / avgLoss : avgWin ? 2.6 : 0
  const pf = grossLoss ? grossProfit / grossLoss : grossProfit ? 9.99 : 0

  const dayMap = new Map<string, DayRow>()
  list.forEach((trade) => {
    if (!trade.date) return
    if (!dayMap.has(trade.date)) {
      dayMap.set(trade.date, { date: trade.date, pnl: 0, count: 0, wins: 0, losses: 0 })
    }
    const row = dayMap.get(trade.date) as DayRow
    row.pnl += trade.pnl
    row.count += 1
    if (trade.pnl > 0) row.wins += 1
    if (trade.pnl < 0) row.losses += 1
  })

  const dayRows = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const greenDays = dayRows.filter((day) => day.pnl > 0).length
  const redDays = dayRows.filter((day) => day.pnl < 0).length
  const flatDays = dayRows.filter((day) => day.pnl === 0).length
  const decisiveDays = greenDays + redDays
  const dayWinRate = decisiveDays ? (greenDays / decisiveDays) * 100 : 0
  const bestDay = dayRows.length
    ? dayRows.reduce((best, day) => (day.pnl > best.pnl ? day : best))
    : null
  const worstDay = dayRows.length
    ? dayRows.reduce((worst, day) => (day.pnl < worst.pnl ? day : worst))
    : null

  let equity = 0
  let peak = 0
  let maxDrawdown = 0
  let maxDrawdownPct = 0
  list.forEach((trade) => {
    equity += trade.pnl
    peak = Math.max(peak, equity)
    const drop = peak - equity
    if (drop > maxDrawdown) maxDrawdown = drop
    const peakBalance = starting + peak
    const base = peakBalance > 0 ? peakBalance : starting
    if (base > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (drop / base) * 100)
  })
  maxDrawdownPct = clamp(maxDrawdownPct, 0, 100)

  const recovery = maxDrawdown > 0 ? net / maxDrawdown : net > 0 ? 3.5 : 0
  let consistency = 0
  if (net > 0 && dayRows.length > 1) {
    const values = dayRows.map((day) => day.pnl)
    const mean = net / values.length
    if (mean >= 0) {
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
      const deviation = Math.sqrt(variance)
      consistency = clamp(100 - (deviation / net) * 100, 0, 100)
    }
  } else if (net > 0) {
    consistency = 100
  }

  return {
    trades: list,
    count: closed,
    wins: wins.length,
    losses: losses.length,
    be: be.length,
    winRate: closed ? (wins.length / closed) * 100 : 0,
    grossProfit,
    grossLoss,
    net,
    pf,
    avgWin,
    avgLoss,
    avgWl,
    avgTrade: closed ? net / closed : 0,
    dayRows,
    dayMap,
    greenDays,
    redDays,
    flatDays,
    dayWinRate,
    bestDay,
    worstDay,
    maxDrawdown,
    maxDrawdownPct,
    recovery,
    consistency,
    starting,
  }
}

export interface GroupStats {
  key: string | number
  count: number
  net: number
  wins: number
  losses: number
  gp: number
  gl: number
  r: number
  winRate: number
  pf: number
  avg: number
  avgR: number
}

export function groupStats(
  trades: Trade[],
  keyFn: (trade: Trade) => string | number | null | undefined,
): Map<string | number, GroupStats> {
  const map = new Map<string | number, GroupStats>()
  trades.forEach((trade) => {
    const key = keyFn(trade)
    if (key === null || key === undefined) return
    if (!map.has(key)) {
      map.set(key, { key, count: 0, net: 0, wins: 0, losses: 0, gp: 0, gl: 0, r: 0, winRate: 0, pf: 0, avg: 0, avgR: 0 })
    }
    const group = map.get(key) as GroupStats
    group.count++
    group.net += trade.pnl
    group.r += Number(trade.rMultiple) || 0
    if (trade.pnl > 0) {
      group.wins++
      group.gp += trade.pnl
    } else if (trade.pnl < 0) {
      group.losses++
      group.gl += -trade.pnl
    }
  })
  map.forEach((group) => {
    group.winRate = group.count ? (group.wins / group.count) * 100 : 0
    group.pf = group.gl ? group.gp / group.gl : group.gp ? 9.99 : 0
    group.avg = group.count ? group.net / group.count : 0
    group.avgR = group.count ? group.r / group.count : 0
  })
  return map
}

export function pfStr(group: GroupStats): string {
  return group.gl ? group.pf.toFixed(2) : group.gp ? '∞' : '—'
}

export function avgOf(list: number[]): number {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function tradeDow(trade: Trade): number {
  return parseISODate(trade.date).getDay()
}

export function buildInsights(trades: Trade[], stats: Stats): Insight[] {
  const out: Insight[] = []
  if (!trades.length) return out
  const best = (arr: GroupStats[]) => arr.reduce((a, b) => (b.net > a.net ? b : a))
  const worst = (arr: GroupStats[]) => arr.reduce((a, b) => (b.net < a.net ? b : a))
  const enough = (map: Map<string | number, GroupStats>) =>
    Array.from(map.values()).filter((group) => group.count >= 3)

  const dows = enough(groupStats(trades, tradeDow))
  if (dows.length > 1) {
    const b = best(dows)
    const w = worst(dows)
    out.push({
      tone: b.net > 0 ? 'pos' : 'warn',
      tag: 'Best weekday',
      title: `${WEEKDAYS[Number(b.key)]}s carry your results`,
      text: `${signedMoney(b.net)} over ${b.count} trades at a ${plainPercent(b.winRate, 0)}% win rate.`,
    })
    if (w.net < 0 && w.key !== b.key) {
      out.push({
        tone: 'neg',
        tag: 'Weakest weekday',
        title: `${WEEKDAYS[Number(w.key)]}s leak money`,
        text: `${signedMoney(w.net)} over ${w.count} trades. Worth reviewing what is different on that day.`,
      })
    }
  }

  const hours = enough(groupStats(trades, tradeHour))
  if (hours.length > 1) {
    const b = best(hours)
    const w = worst(hours)
    out.push({
      tone: b.net > 0 ? 'pos' : 'warn',
      tag: 'Best entry hour',
      title: `${hourLabel(Number(b.key))}–${hourLabel(Number(b.key) + 1)} is your window`,
      text: `${signedMoney(b.net)} across ${b.count} trades (${plainPercent(b.winRate, 0)}% win rate).`,
    })
    if (w.net < 0 && w.key !== b.key) {
      out.push({
        tone: 'neg',
        tag: 'Weakest hour',
        title: `${hourLabel(Number(w.key))}–${hourLabel(Number(w.key) + 1)} costs you`,
        text: `${signedMoney(w.net)} across ${w.count} trades.`,
      })
    }
  }

  const symbols = enough(groupStats(trades, (trade) => trade.ticker))
  if (symbols.length > 1) {
    const b = best(symbols)
    const w = worst(symbols)
    out.push({
      tone: b.net > 0 ? 'pos' : 'warn',
      tag: 'Top instrument',
      title: `${b.key} is your best market`,
      text: `${signedMoney(b.net)} · profit factor ${pfStr(b)} over ${b.count} trades.`,
    })
    if (w.net < 0 && w.key !== b.key) {
      out.push({
        tone: 'neg',
        tag: 'Bottom instrument',
        title: `${w.key} has been a drag`,
        text: `${signedMoney(w.net)} over ${w.count} trades.`,
      })
    }
  }

  const setups = enough(groupStats(trades, (trade) => (trade.playbook === '—' ? null : trade.playbook)))
  if (setups.length > 1) {
    const b = best(setups)
    const w = worst(setups)
    out.push({
      tone: b.net > 0 ? 'pos' : 'warn',
      tag: 'Top setup',
      title: String(b.key),
      text: `${signedMoney(b.net)} · ${plainPercent(b.winRate, 0)}% win rate · ${b.avgR >= 0 ? '+' : ''}${b.avgR.toFixed(2)}R average.`,
    })
    if (w.net < 0 && w.key !== b.key) {
      out.push({
        tone: 'neg',
        tag: 'Weakest setup',
        title: String(w.key),
        text: `${signedMoney(w.net)} over ${w.count} trades. Tighten the criteria or drop it.`,
      })
    }
  }

  const winHold = avgOf(trades.filter((trade) => trade.pnl > 0).map(tradeHoldMinutes).filter((v): v is number => v !== null))
  const lossHold = avgOf(trades.filter((trade) => trade.pnl < 0).map(tradeHoldMinutes).filter((v): v is number => v !== null))
  if (winHold && lossHold) {
    if (lossHold > winHold * 1.2) {
      out.push({
        tone: 'warn',
        tag: 'Holding time',
        title: 'You sit in losers longer',
        text: `Losers average ${formatHold(lossHold)} vs ${formatHold(winHold)} for winners.`,
      })
    } else if (winHold > lossHold * 1.2) {
      out.push({
        tone: 'pos',
        tag: 'Holding time',
        title: 'You let winners run',
        text: `Winners average ${formatHold(winHold)} vs ${formatHold(lossHold)} for losers.`,
      })
    }
  }

  const busy = stats.dayRows.filter((day) => day.count >= 4)
  const calm = stats.dayRows.filter((day) => day.count < 4)
  if (busy.length >= 3 && calm.length >= 3) {
    const busyAvg = avgOf(busy.map((day) => day.pnl))
    const calmAvg = avgOf(calm.map((day) => day.pnl))
    if (busyAvg < calmAvg) {
      out.push({
        tone: 'warn',
        tag: 'Overtrading check',
        title: 'More trades, worse days',
        text: `Days with 4+ trades average ${signedMoney(busyAvg)} vs ${signedMoney(calmAvg)} on lighter days.`,
      })
    }
  }

  return out.slice(0, 8)
}

export function computeEdgeScore(account: Account, stats: Stats): EdgeScore {
  const maxLossPct = Number((account.rules || {}).max) || 8
  const hasData = stats.count > 0
  const pfVal = stats.grossLoss ? stats.pf : stats.grossProfit ? 3 : 0
  const components: ScoreComponent[] = [
    { label: 'Win rate', score: stats.winRate, text: `${plainPercent(stats.winRate, 0)}%` },
    {
      label: 'Profit factor',
      score: (pfVal / 3) * 100,
      text: stats.grossLoss ? `${stats.pf.toFixed(2)}×` : stats.grossProfit ? '∞' : '—',
    },
    {
      label: 'Payoff',
      score: (stats.avgWl / 3) * 100,
      text: stats.avgLoss ? `${stats.avgWl.toFixed(2)}×` : stats.avgWin ? '∞' : '—',
    },
    { label: 'Consistency', score: stats.consistency, text: `${Math.round(stats.consistency)}%` },
    {
      label: 'Drawdown',
      score: 100 - (stats.maxDrawdownPct / maxLossPct) * 100,
      text: `−${stats.maxDrawdownPct.toFixed(1)}%`,
    },
    {
      label: 'Recovery',
      score: (stats.recovery / 5) * 100,
      text: stats.recovery > 0 ? `${stats.recovery.toFixed(1)}×` : '—',
    },
  ].map((component) => ({
    ...component,
    score: clamp(Number(component.score) || 0, 0, 100),
  }))

  const total = hasData
    ? Math.round(components.reduce((sum, component) => sum + component.score, 0) / components.length)
    : 0
  const grade = !hasData
    ? '—'
    : total >= 80
      ? 'Elite'
      : total >= 65
        ? 'Strong'
        : total >= 50
          ? 'Developing'
          : 'Needs work'

  return { total, grade, components, hasData }
}

function ruleTone(used: number): RuleRow['tone'] {
  return used >= 0.85 ? 'is-danger' : used >= 0.6 ? 'is-warn' : 'is-ok'
}

export function buildRules(
  account: Account,
  stats: Stats,
): { rows: RuleRow[]; status: string; tone: 'ok' | 'warn' | 'danger' | 'done' } {
  const starting = getStartingBalance(account)
  const rules = account.rules || { target: 0, daily: 0, max: 0, days: 0 }
  const balance = starting + stats.net
  const rows: RuleRow[] = []
  let worstUsed = 0
  let targetHit = false

  const targetAmount = (starting * (Number(rules.target) || 0)) / 100
  if (targetAmount > 0) {
    const progress = stats.net / targetAmount
    targetHit = progress >= 1
    rows.push({
      name: 'Profit target',
      tone: targetHit ? 'is-done' : 'is-info',
      value: signedMoney(stats.net),
      limit: `/ ${formatMoney(targetAmount)}`,
      pct: progress * 100,
      left: targetHit ? 'Target reached' : `${formatMoney(Math.max(0, targetAmount - stats.net))} to go`,
      right: `${Math.max(0, Math.round(progress * 100))}%`,
    })
  }

  const dailyLimit = (starting * (Number(rules.daily) || 0)) / 100
  if (dailyLimit > 0) {
    const todayRow = stats.dayMap.get(todayISO())
    const todayPnl = todayRow ? todayRow.pnl : 0
    const used = Math.max(0, -todayPnl) / dailyLimit
    const worst = stats.worstDay && stats.worstDay.pnl < 0 ? -stats.worstDay.pnl : 0
    worstUsed = Math.max(worstUsed, used)
    rows.push({
      name: 'Daily loss limit',
      tone: ruleTone(used),
      value: formatMoney(Math.max(0, -todayPnl)),
      limit: `/ ${formatMoney(dailyLimit)}`,
      pct: used * 100,
      left: `Today ${signedMoney(todayPnl)}`,
      right: `Worst day ${worst ? `−${formatMoney(worst)}` : '$0'}`,
    })
  }

  const maxLimit = (starting * (Number(rules.max) || 0)) / 100
  if (maxLimit > 0) {
    const floor = starting - maxLimit
    const used = Math.max(0, starting - balance) / maxLimit
    worstUsed = Math.max(worstUsed, used)
    rows.push({
      name: 'Max total loss',
      tone: ruleTone(used),
      value: formatMoney(Math.max(0, balance - floor)),
      limit: 'buffer',
      pct: used * 100,
      left: `Floor ${formatMoney(floor)}`,
      right: `${Math.round(used * 100)}% used`,
    })
  }

  const requiredDays = Number(rules.days) || 0
  if (requiredDays > 0) {
    const green = stats.greenDays
    rows.push({
      name: 'Profitable days',
      tone: green >= requiredDays ? 'is-done' : 'is-info',
      value: `${green} / ${requiredDays}`,
      limit: 'days',
      pct: (green / requiredDays) * 100,
      left: green >= requiredDays ? 'Requirement met' : `${requiredDays - green} more needed`,
      right: `${stats.dayRows.length} sessions`,
    })
  }

  let status = 'On track'
  let tone: 'ok' | 'warn' | 'danger' | 'done' = 'ok'
  if (worstUsed >= 1) {
    status = 'Rule breached'
    tone = 'danger'
  } else if (worstUsed >= 0.7) {
    status = 'Close to limit'
    tone = 'warn'
  } else if (targetHit) {
    status = 'Target reached'
    tone = 'done'
  }
  return { rows, status, tone }
}

export interface CumulativePoint {
  date: string
  value: number
  peak: number
  drawdown: number
}

export function buildCumulativeSeries(stats: Stats): CumulativePoint[] {
  let cumulative = 0
  let peak = 0
  return stats.dayRows.map((day) => {
    cumulative += day.pnl
    peak = Math.max(peak, cumulative)
    return {
      date: day.date,
      value: cumulative,
      peak,
      drawdown: cumulative - peak,
    }
  })
}

export function buildIntradaySeries(trades: Trade[]): { time: string; value: number }[] {
  let running = 0
  const points = [{ time: trades[0]?.openTime || '—', value: 0 }]
  trades.forEach((trade) => {
    running += trade.pnl
    points.push({ time: trade.closeTime || trade.openTime || '—', value: running })
  })
  return points
}

export function reportDateLabel(iso: string): string {
  return formatShortDate(iso)
}
