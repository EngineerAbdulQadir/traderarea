import type {
  Account,
  AccountType,
  BrokerAccountType,
  BrokerMode,
  PhaseRecord,
  Platform,
  Rules,
  Stage,
  Trade,
} from '@/lib/types'
import { ACCOUNT_PHASES, STAGES_BY_TYPE, fundedAccountSize, getFirm, rulesFor, TYPE_LABELS } from '@/data/firms'
import { BROKER_TYPE_LABELS, getBroker } from '@/data/brokers'
import { formatMoney, formatSize } from '@/lib/format'
import { todayISO } from '@/lib/dates'

export function isBrokerAccount(account: Account | null | undefined): boolean {
  return Boolean(account && (account.kind === 'broker' || account.brokerType))
}

export function accountStageLabel(account: Account): string {
  if (isBrokerAccount(account)) {
    return account.brokerMode ?? 'Live'
  }
  return account.stage
}

export function accountRouteFor(account: Account | null | undefined): '/firms' | '/brokers' {
  return isBrokerAccount(account) ? '/brokers' : '/firms'
}

export function titleFor(account: Account): string {
  const custom = account.name?.trim()
  if (custom) return custom
  return account.firm + ' ' + formatSize(account.challengeSize || account.size)
}

export function accountBadge(account: Account): string {
  return account.firmBadge || (account.firm || 'TA').slice(0, 2).toUpperCase()
}

export function accountGradient(account: Account): string {
  return account.firmGradient || 'linear-gradient(135deg, var(--primary), var(--accent-dim))'
}

export function accountMeta(account: Account): string {
  if (isBrokerAccount(account)) {
    const parts: string[] = []
    if (account.brokerType && BROKER_TYPE_LABELS[account.brokerType]) {
      parts.push(BROKER_TYPE_LABELS[account.brokerType])
    }
    if (account.brokerMode) parts.push(account.brokerMode)
    parts.push(formatMoney(account.startingBalance || account.size, account.currency))
    return parts.join(' · ')
  }
  const parts: string[] = []
  if (account.type && TYPE_LABELS[account.type]) parts.push(TYPE_LABELS[account.type])
  parts.push(formatSize(account.challengeSize || account.size))
  return parts.join(' · ')
}

export function accountMetaCompact(account: Account): string {
  if (isBrokerAccount(account)) {
    const parts: string[] = [account.firm || 'Exness']
    if (account.brokerType && BROKER_TYPE_LABELS[account.brokerType]) {
      parts.push(BROKER_TYPE_LABELS[account.brokerType])
    }
    return parts.join(' · ')
  }
  const parts: string[] = []
  if (account.type && TYPE_LABELS[account.type]) parts.push(TYPE_LABELS[account.type])
  return parts.join(' · ')
}

export function accountStageIndex(account: Account): number {
  return Math.max(0, ACCOUNT_PHASES.indexOf(account.stage || 'Phase 1'))
}

export function phaseState(account: Account, index: number): 'done' | 'current' | 'upcoming' | 'skipped' {
  const stage = ACCOUNT_PHASES[index]
  const stages = STAGES_BY_TYPE[account.type] ?? ACCOUNT_PHASES
  if (stage && !stages.includes(stage)) return 'skipped'
  const stageIndex = accountStageIndex(account)
  if (index < stageIndex) return 'done'
  if (index === stageIndex) return 'current'
  return 'upcoming'
}

export function nextStageFor(type: AccountType, stage: Stage): Stage | null {
  const stages = STAGES_BY_TYPE[type]
  const index = stages.indexOf(stage)
  return index >= 0 && index < stages.length - 1 ? stages[index + 1] : null
}

export function tradePhaseKey(trade: Trade): string {
  return `${trade.date} ${trade.closeTime || trade.openTime || '23:59:59'}`
}

export function latestTradeKey(trades: Trade[]): string {
  return trades.reduce((latest, trade) => {
    const key = tradePhaseKey(trade)
    return key > latest ? key : latest
  }, '')
}

/**
 * Only trades inside the current phase count towards its rules. When a phase
 * is advanced, the last trade of the finished phase becomes the cutoff.
 */
export function tradesForPhase(account: Account, trades: Trade[]): Trade[] {
  if (isBrokerAccount(account)) return trades
  const cutoff = account.phaseStartedAt
  if (!cutoff) return trades
  return trades.filter((trade) => tradePhaseKey(trade) > cutoff)
}

/**
 * Completed phases for display. Older accounts advanced before phase history
 * was stored get one reconstructed record from their phase cutoff.
 */
export function effectivePhaseHistory(account: Account): PhaseRecord[] {
  if (isBrokerAccount(account)) return []
  if (account.phaseHistory?.length) return account.phaseHistory
  if (!account.phaseStartedAt) return []
  const stages = STAGES_BY_TYPE[account.type]
  const currentIndex = stages.indexOf(account.stage)
  const previousStage = currentIndex > 0 ? stages[currentIndex - 1] : null
  if (!previousStage) return []
  return [
    {
      stage: previousStage,
      startingBalance: account.challengeSize || account.size,
      rules: rulesFor(account.type, previousStage) ?? account.rules,
      endedAt: account.phaseStartedAt,
      status: 'passed',
    },
  ]
}

export function newAccountId(): string {
  return `acct_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export interface AccountDraft {
  name?: string
  firmId: string
  type: AccountType
  stage: Stage
  platform: Platform
  size: number
  rules: Rules
}

export function createAccountFromDraft(draft: AccountDraft): Account {
  const firm = getFirm(draft.firmId)
  const funded = draft.stage === 'Funded'
  const balance = funded ? fundedAccountSize(draft.size, draft.type) : draft.size
  const customName = draft.name?.trim()
  return {
    id: newAccountId(),
    kind: 'firm',
    ...(customName ? { name: customName } : {}),
    firm: firm.name,
    firmBadge: firm.badge,
    firmGradient: firm.gradient,
    type: draft.type,
    size: balance,
    challengeSize: draft.size,
    stage: draft.stage,
    platform: draft.platform,
    startDate: todayISO(),
    currency: 'USD',
    startingBalance: balance,
    rules: draft.rules,
    source: 'manual',
    createdAt: new Date().toISOString(),
  }
}

export interface BrokerAccountDraft {
  name?: string
  brokerId: string
  brokerType: BrokerAccountType
  brokerMode: BrokerMode
  platform: Platform
  leverage: string
  currency: string
  balance: number
  rules: Rules
}

export function createBrokerAccountFromDraft(draft: BrokerAccountDraft): Account {
  const broker = getBroker(draft.brokerId)
  const customName = draft.name?.trim()
  const balance = Math.max(1, Number(draft.balance) || 0)
  return {
    id: newAccountId(),
    kind: 'broker',
    ...(customName ? { name: customName } : {}),
    firm: broker.name,
    firmBadge: broker.badge,
    firmGradient: broker.gradient,
    type: 'instant',
    brokerType: draft.brokerType,
    brokerMode: draft.brokerMode,
    leverage: draft.leverage,
    size: balance,
    challengeSize: balance,
    stage: 'Funded',
    platform: draft.platform,
    startDate: todayISO(),
    currency: draft.currency || 'USD',
    startingBalance: balance,
    rules: draft.rules,
    source: 'manual',
    createdAt: new Date().toISOString(),
  }
}

export function createDemoAccount(tone?: 'profitable' | 'loss'): Account {
  const firm = getFirm('eze')
  if (tone === 'profitable') {
    return {
      id: newAccountId(),
      name: 'London Core 10K',
      firm: firm.name,
      firmBadge: firm.badge,
      firmGradient: firm.gradient,
      type: 'step2',
      size: 10_000,
      challengeSize: 10_000,
      stage: 'Phase 1',
      platform: 'MT5',
      startDate: todayISO(),
      currency: 'USD',
      startingBalance: 10_000,
      rules: { target: 10, daily: 5, max: 10, days: 5 },
      source: 'demo',
      demoTone: 'profitable',
      createdAt: new Date().toISOString(),
    }
  }
  if (tone === 'loss') {
    return {
      id: newAccountId(),
      name: 'NY Reversal 5K',
      firm: firm.name,
      firmBadge: firm.badge,
      firmGradient: firm.gradient,
      type: 'step1',
      size: 5_000,
      challengeSize: 5_000,
      stage: 'Phase 1',
      platform: 'MT5',
      startDate: todayISO(),
      currency: 'USD',
      startingBalance: 5_000,
      rules: { target: 12, daily: 4, max: 8, days: 5 },
      source: 'demo',
      demoTone: 'loss',
      createdAt: new Date().toISOString(),
    }
  }
  return {
    id: newAccountId(),
    firm: firm.name,
    firmBadge: firm.badge,
    firmGradient: firm.gradient,
    type: 'step1',
    size: 2_500,
    challengeSize: 2_500,
    stage: 'Phase 1',
    platform: 'MT5',
    startDate: todayISO(),
    currency: 'USD',
    startingBalance: 2_500,
    rules: { target: 12, daily: 4, max: 8, days: 5 },
    source: 'demo',
    createdAt: new Date().toISOString(),
  }
}
