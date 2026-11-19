import { readStorage, writeStorage } from '@/lib/storage'
import type { Account } from '@/lib/types'

export const EZE_PARTNER_URL = 'https://ezefunded.com/?ref=TRADERSAREA'
export const EZE_PARTNER_CODE = 'TRADERSAREA'
export const FREE_ACCOUNT_SLOTS = 1

export type PartnerVerificationStatus = 'pending' | 'approved' | 'rejected'

export interface PartnerVerificationRequest {
  id: string
  uid: string
  userEmail: string
  ezeEmail: string
  orderId: string
  challengeSize?: number
  status: PartnerVerificationStatus
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
}

const FREE_SLOT_KEY_PREFIX = 'ta-free-slot-used'
const LOCAL_VERIFICATIONS_KEY = 'ta-partner-verifications'

function freeSlotKey(uid: string | null): string {
  return uid ? `${FREE_SLOT_KEY_PREFIX}-${uid}` : FREE_SLOT_KEY_PREFIX
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

export function computePartnerSlotSummary(
  accounts: Account[],
  freeSlotConsumed: boolean,
  verifications: PartnerVerificationRequest[],
): PartnerSlotSummary {
  const realAccountsCount = accounts.filter((account) => account.source !== 'demo').length
  const verifiedSlots = verifications.filter((item) => item.status === 'approved').length
  const pendingCount = verifications.filter((item) => item.status === 'pending').length
  const totalSlots = FREE_ACCOUNT_SLOTS + verifiedSlots
  const usedSlots = Math.max(realAccountsCount, freeSlotConsumed ? 1 : 0)
  const remainingSlots = Math.max(0, totalSlots - usedSlots)

  return {
    freeSlots: FREE_ACCOUNT_SLOTS,
    verifiedSlots,
    totalSlots,
    realAccountsCount,
    usedSlots,
    remainingSlots,
    canAddAccount: remainingSlots > 0,
    pendingCount,
  }
}
