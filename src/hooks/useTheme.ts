import { useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribeTheme, toggleTheme, type Theme } from '@/lib/theme'

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'dark' as Theme)
  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  }
}
