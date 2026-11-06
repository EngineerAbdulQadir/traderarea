import type { Account, AccountNotes, Trade } from '@/lib/types'
import { formatShortDate } from '@/lib/dates'

export function seedDemoNotes(trades: Trade[]): AccountNotes {
  const days = Array.from(new Set(trades.map((trade) => trade.date))).sort()
  if (!days.length) return {}
  const picks = [
    days[Math.max(0, days.length - 3)],
    days[Math.max(0, days.length - 10)],
    days[Math.max(0, days.length - 18)],
  ].filter((date, index, list) => date && list.indexOf(date) === index)

  const sample = [
    'Waited for the opening drive to stall, then took the retest with size below my cap. The plan was clear and I let the first target come to me instead of chasing the close.',
    'Two clean setups, then I forced a third into lunch. The loss was controlled, but that third trade was not on the plan. Tomorrow: maximum two A+ entries before noon.',
    'No A+ setup today. Sat on my hands, marked the levels and closed the platform early. A quiet day is still a good day when the process stays intact.',
  ]

  return picks.reduce<AccountNotes>((notes, date, index) => {
    notes[date] = {
      text: sample[index % sample.length],
      updatedAt: new Date().toISOString(),
      seeded: true,
    }
    return notes
  }, {})
}

export function noteSavedLabel(updatedAt: string | undefined): string {
  if (!updatedAt) return ''
  try {
    return `Saved ${formatShortDate(updatedAt.slice(0, 10))}`
  } catch {
    return ''
  }
}

export function wordCount(text: string | undefined): number {
  const trimmed = String(text || '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function dateSortKey(account: Account | undefined): string {
  return account?.id ?? 'none'
}
