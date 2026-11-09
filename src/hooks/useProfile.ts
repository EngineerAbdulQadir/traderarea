import { useSyncExternalStore } from 'react'
import {
  DEFAULT_PROFILE,
  getProfile,
  subscribeProfile,
  type Profile,
} from '@/lib/profile'

export function useProfile(): Profile {
  return useSyncExternalStore(subscribeProfile, getProfile, () => DEFAULT_PROFILE)
}
