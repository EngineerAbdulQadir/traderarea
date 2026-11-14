import type { User } from 'firebase/auth'

const DEV_OWNER_STORAGE = 'ta-dev-owner-unlocked'

/**
 * When true, public visitors can only access `/waitlist` and all standard routes
 * redirect there. Owner sign-in lives exclusively at `ownerLoginSlug`.
 *
 * Defaults to `true` unless explicitly disabled with `VITE_WAITLIST_ONLY=false`.
 */
export const isWaitlistOnly: boolean = import.meta.env.VITE_WAITLIST_ONLY !== 'false'

/**
 * Private route slug for owner authentication (without leading slash).
 * Set `VITE_OWNER_LOGIN_PATH` in Vercel Environment Variables to customize it
 * (e.g., `/my-secret-entry`). Falls back to a non-obvious path if unset.
 */
export const ownerLoginSlug: string = (() => {
  const raw = (import.meta.env.VITE_OWNER_LOGIN_PATH ?? 'portal-9f4k2x').trim()
  const cleaned = raw.replace(/^\/+|\/+$/g, '')
  return cleaned || 'portal-9f4k2x'
})()

export const ownerLoginPath = `/${ownerLoginSlug}`

const configuredOwnerEmails: string[] = (import.meta.env.VITE_OWNER_EMAILS ?? '')
  .split(',')
  .map((item: string) => item.trim().toLowerCase())
  .filter(Boolean)

export function isAuthorizedOwner(user: User | null): boolean {
  if (!user) return false
  if (!configuredOwnerEmails.length) return true
  const email = (user.email ?? '').trim().toLowerCase()
  return configuredOwnerEmails.includes(email)
}

export function hasDevOwnerSession(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(DEV_OWNER_STORAGE) === '1'
  } catch {
    return false
  }
}

export function setDevOwnerSession(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(DEV_OWNER_STORAGE, '1')
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function clearOwnerSessions(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(DEV_OWNER_STORAGE)
  } catch {
    // Ignore unavailable storage.
  }
}
