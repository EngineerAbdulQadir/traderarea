export function readStorage(key: string, fallback: string): string {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can fail in private mode; the in-memory state still works.
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readStorage(key, '')
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  writeStorage(key, JSON.stringify(value))
}
