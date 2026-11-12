import type { Account, Note, NotesByAccount, Trade } from '@/lib/types'
import { readJSON, readStorage, writeJSON, writeStorage } from '@/lib/storage'
import { getDemoTrades } from '@/lib/demo'
import { normalizeTrade } from '@/lib/trades'

export const STORAGE_KEYS = {
  accounts: 'ta-accounts',
  trades: 'ta-trades',
  notes: 'ta-notes',
  activeAccount: 'ta-active-account',
  sidebar: 'ta-ui-sidebar-collapsed',
  dashboardFrom: 'ta-dashboard-from',
  dashboardTo: 'ta-dashboard-to',
  dashboardRangeReset: 'ta-dashboard-range-reset',
  statsRange: 'ta-stats-range',
  reportPeriod: 'ta-report-period',
  reportTab: 'ta-report-tab',
  reportAccount: 'ta-report-account',
} as const

export function readAccounts(): Account[] {
  const accounts = readJSON<Account[]>(STORAGE_KEYS.accounts, [])
  return Array.isArray(accounts) ? accounts.filter((account) => account && account.id) : []
}

export function writeAccounts(accounts: Account[]): void {
  writeJSON(STORAGE_KEYS.accounts, accounts)
}

export function readActiveAccountId(): string {
  return readStorage(STORAGE_KEYS.activeAccount, '')
}

export function writeActiveAccountId(id: string): void {
  writeStorage(STORAGE_KEYS.activeAccount, id)
}

export function readNotes(): NotesByAccount {
  const parsed = readJSON<NotesByAccount>(STORAGE_KEYS.notes, {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

export function writeNotes(notes: NotesByAccount): void {
  writeJSON(STORAGE_KEYS.notes, notes)
}

export function readTrades(): Trade[] {
  const raw = readStorage(STORAGE_KEYS.trades, '')
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  const list: Trade[] = []
  if (Array.isArray(parsed)) {
    parsed.forEach((item, index) => {
      if (!item || typeof item !== 'object') return
      const record = item as Partial<Trade>
      const accountId = record.accountId || ''
      list.push(normalizeTrade(record, index, accountId))
    })
  } else if (parsed && typeof parsed === 'object') {
    Object.entries(parsed as Record<string, unknown>).forEach(([accountId, value]) => {
      if (!Array.isArray(value)) return
      value.forEach((item, index) => {
        if (!item || typeof item !== 'object') return
        list.push(normalizeTrade(item as Partial<Trade>, index, accountId))
      })
    })
  }

  return list
    .filter((trade) => !!trade.accountId)
    .sort((a, b) => (a.date + a.openTime).localeCompare(b.date + b.openTime))
}

export function writeTrades(trades: Trade[]): void {
  writeJSON(STORAGE_KEYS.trades, trades)
}

export function requestDashboardRangeReset(): void {
  writeStorage(STORAGE_KEYS.dashboardRangeReset, '1')
}

export function consumeDashboardRangeReset(): boolean {
  if (readStorage(STORAGE_KEYS.dashboardRangeReset, '') !== '1') return false
  writeStorage(STORAGE_KEYS.dashboardRangeReset, '')
  return true
}

export function realTradesForAccount(trades: Trade[], accountId: string): Trade[] {
  return trades
    .filter((trade) => trade.accountId === accountId)
    .sort((a, b) => (a.date + a.openTime).localeCompare(b.date + b.openTime))
}

export function resolveTrades(trades: Trade[], account: Account): Trade[] {
  const real = realTradesForAccount(trades, account.id)
  if (real.length) return real
  // Only accounts explicitly created as demo workspaces get generated sample data.
  return account.source === 'demo' ? getDemoTrades(account) : []
}

export function isDemoAccount(trades: Trade[], account: Account | null | undefined): boolean {
  if (!account || account.source !== 'demo') return false
  return realTradesForAccount(trades, account.id).length === 0
}

export function mergeNotes(
  notes: NotesByAccount,
  accountId: string,
  accountNotes: Record<string, Note>,
): NotesByAccount {
  return { ...notes, [accountId]: accountNotes }
}
