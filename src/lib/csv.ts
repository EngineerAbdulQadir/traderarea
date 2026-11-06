import type { Trade } from '@/lib/types'
import { tradeGrade } from '@/lib/trades'

export const TRADE_CSV_HEADER = [
  'Date',
  'Open',
  'Close',
  'Symbol',
  'Instrument',
  'Side',
  'Qty',
  'Entry',
  'Exit',
  'Gross P&L',
  'Fees',
  'Net P&L',
  'R',
  'Setup',
  'Execution',
  'Tags',
]

function csvCell(value: unknown): string {
  const string = String(value ?? '')
  return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string
}

export function tradeCsvRows(trades: Trade[]): string[][] {
  return trades.map((trade) => [
    trade.date,
    trade.openTime,
    trade.closeTime,
    trade.ticker,
    trade.instrument,
    trade.side,
    String(trade.volume),
    String(trade.entry),
    String(trade.exit),
    trade.gross.toFixed(2),
    trade.fees.toFixed(2),
    trade.pnl.toFixed(2),
    (Number(trade.rMultiple) || 0).toFixed(2),
    trade.playbook,
    tradeGrade(trade).label,
    (trade.tags || []).join('; '),
  ])
}

export function downloadCsv(name: string, header: string[], rows: string[][]): void {
  const text = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    console.warn('CSV export failed', error)
  }
}
