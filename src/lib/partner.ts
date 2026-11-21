import { readStorage, writeStorage } from '@/lib/storage'
import type { Account } from '@/lib/types'

export const EZE_PARTNER_URL = 'https://ezefunded.com/?ref=TRADERSAREA'
export const EZE_PARTNER_CODE = 'TRADERSAREA'
export const FREE_ACCOUNT_SLOTS = 1
export const FREE_TRIAL_DAYS = 30
const DAY_MS = 86_400_000

export type PartnerVerificationStatus = 'pending' | 'approved' | 'rejected'

export type AccountAccessState =
  | 'admin'
  | 'lifetime_affiliate'
  | 'lifetime_granted'
  | 'pending_review'
  | 'trial_expiring'
  | 'trial_active'
  | 'trial_expired'

export interface AccessPolicyConfig {
  trialEnabled: boolean
  freeTrialDays: number
  freeAccountSlots: number
  requirePartnerAfterTrial: boolean
  partnerUrl: string
  partnerCode: string
  updatedAt?: string
  updatedBy?: string
}

export const DEFAULT_ACCESS_POLICY: AccessPolicyConfig = {
  trialEnabled: true,
  freeTrialDays: FREE_TRIAL_DAYS,
  freeAccountSlots: FREE_ACCOUNT_SLOTS,
  requirePartnerAfterTrial: true,
  partnerUrl: EZE_PARTNER_URL,
  partnerCode: EZE_PARTNER_CODE,
}

export interface UserEntitlementRecord {
  uid: string
  email?: string
  name?: string
  accountsCount?: number
  freeSlotConsumed?: boolean
  trialStartedAt?: string
  trialBonusDays?: number
  lifetimeGranted?: boolean
  lifetimeGrantedAt?: string
  lifetimeGrantedBy?: string
  lastActiveAt?: string
  updatedAt?: string
}

export interface PartnerVerificationRequest {
  id: string
  uid: string
  userEmail: string
  ezeEmail: string
  orderId: string
  challengeSize?: number
  status: PartnerVerificationStatus
  note?: string
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface PartnerSlotSummary {
  freeSlots: number
  verifiedSlots: number
  totalSlots: number
  realAccountsCount: number
  usedSlots: number
  remainingSlots: number
  canAddAccount: boolean
  pendingCount: number
  rejectedCount: number
  latestVerification: PartnerVerificationRequest | null
  trialEnabled: boolean
  requirePartnerAfterTrial: boolean
  freeTrialDays: number
  trialBonusDays: number
  trialStartedAt: string | null
  trialEndsAt: string | null
  daysRemaining: number
  trialExpired: boolean
  hasLifetimeAccess: boolean
  canUseJournal: boolean
  isAdmin: boolean
  accessState: AccountAccessState
  accessLabel: string
}

const FREE_SLOT_KEY_PREFIX = 'ta-free-slot-used'
const TRIAL_START_KEY_PREFIX = 'ta-trial-started'
const LOCAL_VERIFICATIONS_KEY = 'ta-partner-verifications'
const LOCAL_POLICY_KEY = 'ta-access-policy'

function freeSlotKey(uid: string | null): string {
  return uid ? `${FREE_SLOT_KEY_PREFIX}-${uid}` : FREE_SLOT_KEY_PREFIX
}

function trialStartKey(uid: string | null): string {
  return uid ? `${TRIAL_START_KEY_PREFIX}-${uid}` : TRIAL_START_KEY_PREFIX
}

export function normalizeAccessPolicy(raw?: Partial<AccessPolicyConfig> | null): AccessPolicyConfig {
  const daysRaw = Number(raw?.freeTrialDays)
  const slotsRaw = Number(raw?.freeAccountSlots)
  const url =
    typeof raw?.partnerUrl === 'string' && raw.partnerUrl.trim() ? raw.partnerUrl.trim() : EZE_PARTNER_URL
  const code =
    typeof raw?.partnerCode === 'string' && raw.partnerCode.trim() ? raw.partnerCode.trim() : EZE_PARTNER_CODE
  return {
    trialEnabled: raw?.trialEnabled ?? DEFAULT_ACCESS_POLICY.trialEnabled,
    freeTrialDays: Number.isFinite(daysRaw)
      ? Math.max(1, Math.min(3650, Math.round(daysRaw)))
      : FREE_TRIAL_DAYS,
    freeAccountSlots: Number.isFinite(slotsRaw)
      ? Math.max(0, Math.min(100, Math.round(slotsRaw)))
      : FREE_ACCOUNT_SLOTS,
    requirePartnerAfterTrial:
      raw?.requirePartnerAfterTrial ?? DEFAULT_ACCESS_POLICY.requirePartnerAfterTrial,
    partnerUrl: url,
    partnerCode: code,
    ...(raw?.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    ...(raw?.updatedBy ? { updatedBy: raw.updatedBy } : {}),
  }
}

export function readLocalAccessPolicy(): AccessPolicyConfig {
  if (typeof window === 'undefined') return DEFAULT_ACCESS_POLICY
  try {
    const raw = window.localStorage.getItem(LOCAL_POLICY_KEY)
    if (!raw) return DEFAULT_ACCESS_POLICY
    return normalizeAccessPolicy(JSON.parse(raw) as Partial<AccessPolicyConfig>)
  } catch {
    return DEFAULT_ACCESS_POLICY
  }
}

export function writeLocalAccessPolicy(policy: AccessPolicyConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(normalizeAccessPolicy(policy)))
  } catch {
    // Ignore storage quota errors.
  }
}

export function readTrialStartedAt(uid: string | null): string | null {
  const value = readStorage(trialStartKey(uid), '')
  return value || null
}

export function writeTrialStartedAt(uid: string | null, iso: string): void {
  if (!iso) return
  writeStorage(trialStartKey(uid), iso)
}

export function readFreeSlotConsumed(uid: string | null): boolean {
  return readStorage(freeSlotKey(uid), '') === '1'
}

export function writeFreeSlotConsumed(uid: string | null, consumed: boolean): void {
  if (!consumed) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(freeSlotKey(uid))
      } catch {
        // Ignore unavailable storage.
      }
    }
    return
  }
  writeStorage(freeSlotKey(uid), '1')
}

export function clearLocalFreeSlotMarkers(): void {
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(FREE_SLOT_KEY_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Ignore storage failures.
  }
}

export function readLocalVerifications(): PartnerVerificationRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_VERIFICATIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as PartnerVerificationRequest[]) : []
  } catch {
    return []
  }
}

export function writeLocalVerifications(items: PartnerVerificationRequest[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_VERIFICATIONS_KEY, JSON.stringify(items))
  } catch {
    // Ignore storage quota errors.
  }
}

export interface PartnerSummaryOptions {
  policy?: AccessPolicyConfig
  trialStartedAt?: string | null
  trialBonusDays?: number
  lifetimeGranted?: boolean
  isAdmin?: boolean
  now?: number
}

export function computePartnerSlotSummary(
  accounts: Account[],
  freeSlotConsumed: boolean,
  verifications: PartnerVerificationRequest[],
  options?: PartnerSummaryOptions,
): PartnerSlotSummary {
  const policy = normalizeAccessPolicy(options?.policy)
  const isAdmin = Boolean(options?.isAdmin)
  const realAccountsCount = accounts.filter((account) => account.source !== 'demo').length
  const sortedVerifications = [...verifications].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  )
  const latestVerification = sortedVerifications[0] ?? null
  const verifiedSlots = sortedVerifications.filter((item) => item.status === 'approved').length
  const pendingCount = sortedVerifications.filter((item) => item.status === 'pending').length
  const rejectedCount = sortedVerifications.filter((item) => item.status === 'rejected').length

  const freeSlots = policy.freeAccountSlots
  const totalSlots = freeSlots + verifiedSlots
  const usedSlots = Math.max(realAccountsCount, freeSlotConsumed ? 1 : 0)

  const hasLifetimeAccess = Boolean(
    isAdmin ||
      options?.lifetimeGranted ||
      verifiedSlots > 0 ||
      !policy.trialEnabled ||
      !policy.requirePartnerAfterTrial,
  )

  const bonusDays = Math.max(0, Math.round(options?.trialBonusDays ?? 0))
  const effectiveTrialDays = policy.freeTrialDays + bonusDays
  const trialStartedAt = options?.trialStartedAt ?? null
  const startMs = trialStartedAt ? Date.parse(trialStartedAt) : NaN
  const nowMs = options?.now ?? Date.now()

  let trialEndsAt: string | null = null
  let daysRemaining = effectiveTrialDays
  let trialExpired = false

  if (Number.isFinite(startMs)) {
    const endMs = startMs + effectiveTrialDays * DAY_MS
    trialEndsAt = new Date(endMs).toISOString()
    const remainingMs = endMs - nowMs
    daysRemaining = Math.max(0, Math.ceil(remainingMs / DAY_MS))
    trialExpired =
      policy.trialEnabled &&
      policy.requirePartnerAfterTrial &&
      !hasLifetimeAccess &&
      remainingMs <= 0
  }

  const canUseJournal = hasLifetimeAccess || !trialExpired
  const remainingSlots = canUseJournal ? Math.max(0, totalSlots - usedSlots) : 0

  let accessState: AccountAccessState
  let accessLabel: string

  if (isAdmin) {
    accessState = 'admin'
    accessLabel = 'Admin'
  } else if (verifiedSlots > 0) {
    accessState = 'lifetime_affiliate'
    accessLabel = 'Lifetime · Verified'
  } else if (options?.lifetimeGranted || !policy.trialEnabled || !policy.requirePartnerAfterTrial) {
    accessState = 'lifetime_granted'
    accessLabel = 'Lifetime · Active'
  } else if (trialExpired) {
    accessState = pendingCount > 0 ? 'pending_review' : 'trial_expired'
    accessLabel = pendingCount > 0 ? 'Pending review' : 'Trial ended'
  } else if (pendingCount > 0) {
    accessState = 'pending_review'
    accessLabel = `Review pending · ${daysRemaining}d`
  } else if (daysRemaining <= 5) {
    accessState = 'trial_expiring'
    accessLabel = `Trial · ${daysRemaining}d left`
  } else {
    accessState = 'trial_active'
    accessLabel = `Trial · ${daysRemaining}d left`
  }

  return {
    freeSlots,
    verifiedSlots,
    totalSlots,
    realAccountsCount,
    usedSlots,
    remainingSlots,
    canAddAccount: canUseJournal && remainingSlots > 0,
    pendingCount,
    rejectedCount,
    latestVerification,
    trialEnabled: policy.trialEnabled,
    requirePartnerAfterTrial: policy.requirePartnerAfterTrial,
    freeTrialDays: effectiveTrialDays,
    trialBonusDays: bonusDays,
    trialStartedAt,
    trialEndsAt,
    daysRemaining,
    trialExpired,
    hasLifetimeAccess,
    canUseJournal,
    isAdmin,
    accessState,
    accessLabel,
  }
}
