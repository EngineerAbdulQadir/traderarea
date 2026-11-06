const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: number | undefined | null, currency = 'USD'): string {
  const value = Number(amount) || 0
  if (currency === 'USD') return usd0.format(value)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('en-US')}`
  }
}

export function formatUsd2(amount: number | undefined | null): string {
  return usd2.format(Number(amount) || 0)
}

export function signedMoney(amount: number | undefined | null, currency = 'USD'): string {
  const value = Number(amount) || 0
  if (!value) return formatMoney(0, currency)
  return `${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value), currency)}`
}

export function compactSignedMoney(amount: number | undefined | null, currency = 'USD'): string {
  const value = Number(amount) || 0
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const symbol = !currency || currency === 'USD' ? '$' : `${currency} `
  let body: string
  if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`
  else body = String(Math.round(abs))
  return `${sign}${symbol}${body}`
}

export function signedPercent(value: number | undefined | null, digits = 1): string {
  const n = Number(value) || 0
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`
}

export function plainPercent(value: number | undefined | null, digits = 1): string {
  return (Number(value) || 0).toFixed(digits)
}

export function formatSize(size: number | string | undefined | null): string {
  const value = Number(size) || 0
  return value >= 1000 ? `${value / 1000}K` : String(value)
}

export function formatPrice(value: number | undefined | null): string {
  const n = Number(value) || 0
  const digits = Math.abs(n) >= 50 ? 2 : 3
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatHold(minutes: number | null | undefined): string {
  const total = Math.round(Number(minutes) || 0)
  if (!total) return '—'
  if (total < 60) return `${total}m`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `${hours}h${mins ? ` ${mins}m` : ''}`
}

export function formatNumber(value: number | undefined | null, digits = 0): string {
  return (Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatR(value: number | undefined | null): string {
  const n = Number(value) || 0
  if (!n) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}R`
}

export function formatTime(value: string | undefined | null): string {
  return String(value || '').slice(0, 5)
}

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}
