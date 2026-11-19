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
    openTime: raw.openTime ?? raw.time ?? '',
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
    ...(raw.ticket ? { ticket: String(raw.ticket).trim() } : {}),
  }
}

function tradeSymbol(trade: Trade): string {
  return (trade.instrument || trade.ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function timeParts(value: string): { hm: string; hms: string | null } {
  const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return { hm: value, hms: null }
  const hm = `${match[1].padStart(2, '0')}:${match[2]}`
  const hms = match[3] !== undefined ? `${hm}:${match[3].padStart(2, '0')}` : null
  return { hm, hms }
}

function isSameTime(a: string, b: string): boolean {
  if (!a || !b) return true
  const left = timeParts(a)
  const right = timeParts(b)
  if (left.hms && right.hms) return left.hms === right.hms
  return left.hm === right.hm
}

export function tradeTicket(trade: Pick<Trade, 'id' | 'ticket'>): string {
  if (trade.ticket && trade.ticket.trim()) return trade.ticket.trim()
  if (trade.id.startsWith('mt:')) {
    const parts = trade.id.split(':')
    // Standard ticket-based IDs follow `mt:<accountId>:<ticket>`.
    if (parts.length === 3 && parts[2]) return parts[2]
  }
  return ''
}

export interface ImportTradeIdentityInput {
  ticket: string
  date: string
  openTime: string
  closeTime: string
  symbol: string
  side: Trade['side']
  volume: number
  entry: number
  exit: number
  pnl: number
}

/**
 * Deterministic ID for an imported trade without relying on its array position
 * in the file, so partial exports and whole-history exports yield matching IDs.
 */
export function buildImportedTradeBaseKey(accountId: string, item: ImportTradeIdentityInput): string {
  const safeAccount = accountId.replace(/[/\\:\s]+/g, '-')
  if (item.ticket) {
    const safeTicket = item.ticket.replace(/[/\\:\s]+/g, '-')
    return `mt:${safeAccount}:${safeTicket}`
  }
  const safeSymbol = item.symbol.replace(/[/\\:\s]+/g, '-')
  return `mt:${safeAccount}:${item.date}:${item.openTime || '-'}:${item.closeTime || '-'}:${safeSymbol}:${item.side}:${item.volume}:${item.entry}:${item.exit}:${item.pnl}`
}

/**
 * Whether two journal entries describe the same executed trade. Used when
 * importing a statement again so trades logged by hand or exported across
 * different statement ranges are not duplicated.
 */
export function isSameTradeData(a: Trade, b: Trade): boolean {
  if (!a.date || a.date !== b.date) return false
  if (a.side !== b.side) return false
  if (tradeSymbol(a) !== tradeSymbol(b)) return false
  if (Math.abs((a.volume || 0) - (b.volume || 0)) > 0.001) return false

  if (!isSameTime(a.openTime, b.openTime)) return false
  if (!isSameTime(a.closeTime, b.closeTime)) return false

  const aEntry = Number(a.entry) || 0
  const bEntry = Number(b.entry) || 0
  const aExit = Number(a.exit) || 0
  const bExit = Number(b.exit) || 0
  if (aEntry && bEntry && Math.abs(aEntry - bEntry) > 0.0001) return false
  if (aExit && bExit && Math.abs(aExit - bExit) > 0.0001) return false

  // Broker prices are the strongest identity when both entries have them.
  if (aEntry && bEntry && aExit && bExit) return true

  return Math.abs((a.pnl || 0) - (b.pnl || 0)) <= 0.02
}

export function isDuplicateTrade(existing: Trade, candidate: Trade): boolean {
  if (existing.accountId !== candidate.accountId) return false
  if (existing.id === candidate.id) return true

  const existingTicket = tradeTicket(existing)
  const candidateTicket = tradeTicket(candidate)
  if (existingTicket && candidateTicket) {
    return existingTicket === candidateTicket
  }

  return isSameTradeData(existing, candidate)
}

export function mergeImportedTrades(
  existing: Trade[],
  incoming: Trade[],
): { next: Trade[]; added: Trade[]; skipped: number } {
  const added: Trade[] = []
  let skipped = 0

  incoming.forEach((candidate) => {
    const alreadyExists = existing.some((row) => isDuplicateTrade(row, candidate))
    if (alreadyExists) {
      skipped += 1
      return
    }
    const alreadyAdded = added.some((row) => isDuplicateTrade(row, candidate))
    if (alreadyAdded) {
      skipped += 1
      return
    }
    added.push(candidate)
  })

  if (!added.length) {
    return { next: existing, added: [], skipped }
  }

  const next = [...existing, ...added].sort((a, b) =>
    (a.date + a.openTime).localeCompare(b.date + b.openTime),
  )
  return { next, added, skipped }
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
