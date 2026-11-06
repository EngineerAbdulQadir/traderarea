import type { AccountType, PropFirm, Rules, Stage } from '@/lib/types'

// Add a new prop firm here — the picker, badges and account cards all read from this list.
export const PROP_FIRMS: PropFirm[] = [
  {
    id: 'eze',
    name: 'Eze Funded',
    short: 'Eze Funded',
    badge: 'EZ',
    gradient: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-dim) 100%)',
    meta: 'Forex · Evaluation & funded',
  },
]

export const TYPE_LABELS: Record<AccountType, string> = {
  step1: 'Step 1',
  step2: 'Step 2',
  step2prime: 'Step 2 Prime',
}

export const STAGES_BY_TYPE: Record<AccountType, Stage[]> = {
  step1: ['Phase 1', 'Funded'],
  step2: ['Phase 1', 'Phase 2', 'Funded'],
  step2prime: ['Phase 1', 'Phase 2', 'Funded'],
}

export const STEP2_RULES: Record<string, Rules> = {
  'Phase 1': { target: 10, daily: 5, max: 10, days: 5 },
  'Phase 2': { target: 5, daily: 5, max: 10, days: 5 },
}

export const RULES_BY_TYPE: Record<AccountType, Record<string, Rules>> = {
  step1: {
    'Phase 1': { target: 12, daily: 4, max: 8, days: 5 },
  },
  step2: STEP2_RULES,
  step2prime: STEP2_RULES,
}

export const ACCOUNT_PHASES: Stage[] = ['Phase 1', 'Phase 2', 'Funded']

export const CHALLENGE_SIZES = [2_500, 5_000, 10_000, 20_000, 50_000, 100_000]
export const PLATFORMS = ['MT5', 'cTrader', 'TradeLocker'] as const

export function getFirm(id: string): PropFirm {
  return PROP_FIRMS.find((firm) => firm.id === id) ?? PROP_FIRMS[0]
}

export function fundedAccountSize(size: number): number {
  return size / 10
}

export function fundedMaxLossPct(type: AccountType): number {
  if (type === 'step2') return 35
  if (type === 'step2prime') return 50
  return 45
}

export function rulesFor(type: AccountType, stage: Stage): Rules | null {
  if (stage === 'Funded') {
    return { target: 0, daily: 0, max: fundedMaxLossPct(type), days: 0 }
  }
  return RULES_BY_TYPE[type]?.[stage] ?? null
}
