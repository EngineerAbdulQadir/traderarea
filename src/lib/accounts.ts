import type { Account, AccountType, Platform, Rules, Stage } from '@/lib/types'
import { ACCOUNT_PHASES, getFirm, TYPE_LABELS } from '@/data/firms'
import { formatSize } from '@/lib/format'
import { todayISO } from '@/lib/dates'

export function titleFor(account: Account): string {
  return account.firm + ' ' + formatSize(account.challengeSize || account.size)
}

export function accountBadge(account: Account): string {
  return account.firmBadge || (account.firm || 'TA').slice(0, 2).toUpperCase()
}

export function accountGradient(account: Account): string {
  return account.firmGradient || 'linear-gradient(135deg, var(--primary), var(--accent-dim))'
}

export function accountMeta(account: Account): string {
  const parts: string[] = []
  if (account.type && TYPE_LABELS[account.type]) parts.push(TYPE_LABELS[account.type])
  parts.push(formatSize(account.challengeSize || account.size))
  if (account.platform) parts.push(account.platform)
  return parts.join(' · ')
}

export function accountMetaCompact(account: Account): string {
  const parts: string[] = []
  if (account.type && TYPE_LABELS[account.type]) parts.push(TYPE_LABELS[account.type])
  if (account.platform) parts.push(account.platform)
  return parts.join(' · ')
}

export function accountStageIndex(account: Account): number {
  return Math.max(0, ACCOUNT_PHASES.indexOf(account.stage || 'Phase 1'))
}

export function phaseState(account: Account, index: number): 'done' | 'current' | 'upcoming' | 'skipped' {
  const stageIndex = accountStageIndex(account)
  if (index < stageIndex) return 'done'
  if (index === stageIndex) return 'current'
  if (account.type === 'step1' && index === 1) return 'skipped'
  return 'upcoming'
}

export function newAccountId(): string {
  return `acct_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export interface AccountDraft {
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
  const balance = funded ? draft.size / 10 : draft.size
  return {
    id: newAccountId(),
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

export function createDemoAccount(): Account {
  const firm = getFirm('eze')
  return {
    id: newAccountId(),
    firm: firm.name,
    firmBadge: firm.badge,
    firmGradient: firm.gradient,
    type: 'step2',
    size: 100_000,
    challengeSize: 100_000,
    stage: 'Phase 1',
    platform: 'MT5',
    startDate: todayISO(),
    currency: 'USD',
    startingBalance: 100_000,
    rules: { target: 10, daily: 5, max: 10, days: 5 },
    source: 'demo',
    createdAt: new Date().toISOString(),
  }
}
