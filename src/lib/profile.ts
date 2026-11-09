import { readJSON, writeJSON } from '@/lib/storage'

export interface Profile {
  name: string
  email: string
}

export const PROFILE_STORAGE_KEY = 'ta-profile'

export const DEFAULT_PROFILE: Profile = {
  name: 'Alex M.',
  email: 'alex@traderarea.local',
}

const listeners = new Set<() => void>()

function normalize(value: Partial<Profile> | null | undefined): Profile {
  const name = typeof value?.name === 'string' ? value.name.trim() : ''
  const email = typeof value?.email === 'string' ? value.email.trim() : ''
  return {
    name: name || DEFAULT_PROFILE.name,
    email: email || DEFAULT_PROFILE.email,
  }
}

let currentProfile: Profile = normalize(readJSON<Partial<Profile>>(PROFILE_STORAGE_KEY, {}))

export function getProfile(): Profile {
  return currentProfile
}

export function subscribeProfile(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function saveProfile(profile: Profile): Profile {
  currentProfile = normalize(profile)
  writeJSON(PROFILE_STORAGE_KEY, currentProfile)
  listeners.forEach((listener) => listener())
  return currentProfile
}

export function initialsFor(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (!parts.length) return DEFAULT_PROFILE.name.slice(0, 2).toUpperCase()
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}
