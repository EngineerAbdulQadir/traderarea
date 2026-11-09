import type { Trade } from '@/lib/types'
import { timeToMinutes, todayISO } from '@/lib/dates'

interface LegacyTradeFields {
  symbol?: string
  qty?: number
  quantity?: number
  r?: number
  setup?: string
  netPnl?: number
  closedAt?: string
  openAt?: string
  commissions?: number
  time?: string
  netROI?: number
}

export function normalizeTrade(
  raw: Partial<Trade> & LegacyTradeFields,
  index: number,
  accountId: string,
): Trade {
  const pnl = Number(raw.pnl ?? raw.netPnl ?? 0)
  const date = String(raw.date ?? raw.closedAt ?? raw.openAt ?? todayISO()).slice(0, 10)
  const fees = Math.abs(Number(raw.fees ?? raw.commissions ?? 0) || 0)
  const gross = Number.isFinite(pnl) ? pnl + fees : 0
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : []

  return {
    id: raw.id || `${accountId}-trade-${index}`,
    accountId: raw.accountId || accountId,
    date,
    openTime: raw.openTime || raw.time || (raw.manual ? '' : '09:30:00'),
    closeTime: raw.closeTime || '',
    ticker: raw.ticker || raw.symbol || '—',
    instrument: raw.instrument || raw.symbol || '—',
    side: String(raw.side || 'LONG').toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG',
    volume: Number(raw.volume || raw.qty || raw.quantity) || 0,
    entry: Number(raw.entry) || 0,
    exit: Number(raw.exit) || 0,
    stopLoss: Number(raw.stopLoss) || 0,
    takeProfit: Number(raw.takeProfit) || 0,
    pnl: Number.isFinite(pnl) ? pnl : 0,
    gross,
    fees,
    roi: Number(raw.roi ?? raw.netROI ?? 0) || 0,
    rMultiple: Number(raw.rMultiple ?? raw.r ?? 0) || 0,
    risk: Number(raw.risk) || 0,
    playbook: raw.playbook || raw.setup || '—',
    quality: Number(raw.quality) || 50,
    tags,
    note: raw.note || '',
    manual: !!raw.manual,
  }
}

export function tradeHoldMinutes(trade: Trade): number | null {
  const a = timeToMinutes(trade.openTime)
  const b = timeToMinutes(trade.closeTime)
  return a !== null && b !== null && b >= a ? b - a : null
}

export function tradeHour(trade: Trade): number | null {
  const minutes = timeToMinutes(trade.openTime)
  return minutes === null ? null : Math.floor(minutes / 60)
}

export function tradeGrade(trade: Trade): { key: 'good' | 'ok' | 'bad'; label: string } {
  const quality = Number(trade.quality) || 0
  if (quality >= 70) return { key: 'good', label: 'Clean' }
  if (quality >= 45) return { key: 'ok', label: 'Average' }
  return { key: 'bad', label: 'Sloppy' }
}
