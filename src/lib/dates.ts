export function dateToISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function todayISO(): string {
  return dateToISO(new Date())
}

export function parseISODate(iso: string | undefined | null): Date {
  const parts = String(iso || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date()
  return new Date(parts[0], parts[1] - 1, parts[2])
}

export function isValidISODate(value: string | undefined | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return dateToISO(parseISODate(value)) === value
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, amount: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatLongDate(iso: string, withYear = true): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function formatNumericDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateRange(from: string, to: string): string {
  const start = parseISODate(from)
  const end = parseISODate(to)
  const currentYear = new Date().getFullYear()
  const sameYear = start.getFullYear() === end.getFullYear()
  const withYear = !sameYear || end.getFullYear() !== currentYear
  const yearSuffix = withYear ? `, ${end.getFullYear()}` : ''

  if (from === to) {
    return start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    })
  }

  if (!sameYear) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} – ${end.getDate()}${yearSuffix}`
  }

  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${yearSuffix}`
}

export function dayName(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long' })
}

export function shortDayName(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { weekday: 'short' })
}

export function monthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function monthShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' })
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}

export function monthKeyName(key: string): string {
  return parseISODate(`${key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function timeToMinutes(value: string | undefined | null): number | null {
  const parts = String(value || '').split(':').map(Number)
  if (parts.length < 2 || parts.some(Number.isNaN)) return null
  return parts[0] * 60 + parts[1] + (Number(parts[2]) || 0) / 60
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function mondayOf(date: Date): Date {
  const d = startOfDay(date)
  return addDays(d, -((d.getDay() + 6) % 7))
}

export function isSameMonth(date: Date, other: Date): boolean {
  return date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth()
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
