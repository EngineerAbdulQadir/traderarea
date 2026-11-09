export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ta-theme'
const THEME_META: Record<Theme, string> = {
  dark: '#0f1113',
  light: '#fbfbfb',
}

const listeners = new Set<() => void>()

function systemTheme(): Theme {
  return 'light'
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function initialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const fromDom = document.documentElement.dataset.theme
    if (fromDom === 'light' || fromDom === 'dark') return fromDom
  }
  return storedTheme() ?? systemTheme()
}

let currentTheme: Theme = initialTheme()
let transitionTimer: number | undefined

export function getTheme(): Theme {
  return currentTheme
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function syncDocument(theme: Theme, animate: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-transition')
    if (transitionTimer) window.clearTimeout(transitionTimer)
    transitionTimer = window.setTimeout(() => {
      root.classList.remove('theme-transition')
      transitionTimer = undefined
    }, 340)
  }
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_META[theme])
}

export function setTheme(theme: Theme, options: { persist?: boolean; animate?: boolean } = {}): void {
  const { persist = true, animate = true } = options
  currentTheme = theme
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Private mode: the DOM still updates for this session.
    }
  }
  syncDocument(theme, animate)
  listeners.forEach((listener) => listener())
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

export function clearThemePreference(): void {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY)
  } catch {
    // Ignore unavailable storage.
  }
  setTheme(systemTheme())
}

/**
 * Applies the pre-paint theme chosen by the inline bootstrap in index.html and
 * follows the operating system only while the trader has not made a choice.
 */
export function initTheme(): void {
  currentTheme = initialTheme()
  syncDocument(currentTheme, false)

  const media = window.matchMedia('(prefers-color-scheme: light)')
  const onChange = () => {
    if (!storedTheme()) setTheme(systemTheme(), { persist: false, animate: true })
  }
  media.addEventListener('change', onChange)
}
