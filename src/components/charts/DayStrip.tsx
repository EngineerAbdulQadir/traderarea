import type { DayRow } from '@/lib/types'
import { formatShortDate } from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

interface DayStripProps {
  days: DayRow[]
  limit?: number
  className?: string
}

export function DayStrip({ days, limit = 14, className }: DayStripProps) {
  const rows = days.slice(-limit)
  if (!rows.length) {
    return <span className={cn('day-strip-empty', className)}>No sessions</span>
  }
  const maxAbs = Math.max(1, ...rows.map((day) => Math.abs(day.pnl)))

  return (
    <div className={cn('day-strip', className)} aria-hidden="true">
      {rows.map((day, index) => {
        const height = Math.max(12, (Math.abs(day.pnl) / maxAbs) * 100)
        const tone = day.pnl > 0 ? 'pos' : day.pnl < 0 ? 'neg' : 'flat'
        return (
          <i
            key={day.date}
            className={tone}
            style={{ height: `${height}%`, animationDelay: `${Math.min(index * 18, 200)}ms` }}
            title={`${formatShortDate(day.date)} · ${signedMoney(day.pnl)} · ${day.count} trades`}
          />
        )
      })}
    </div>
  )
}
