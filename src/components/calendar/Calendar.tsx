import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, PenLine } from 'lucide-react'
import type { Note, Trade } from '@/lib/types'
import {
  addDays,
  dateToISO,
  formatLongDate,
  mondayOf,
  monthName,
  todayISO,
} from '@/lib/dates'
import { cn } from '@/lib/cn'
import { compactSignedMoney } from '@/lib/format'

interface CalendarProps {
  trades: Trade[]
  notes: Record<string, Note>
  onOpenDay: (date: string) => void
}

interface DayTradeRow {
  pnl: number
  count: number
  wins: number
  losses: number
  be: number
  rMultiple: number
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Calendar({ trades, notes, onOpenDay }: CalendarProps) {
  const now = new Date()
  const [cursor, setCursor] = useState(() => {
    const current = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonth = todayISO().slice(0, 7)
    if (trades.some((trade) => trade.date?.slice(0, 7) === currentMonth)) return current
    const latest = trades.reduce((max, trade) => (trade.date > max ? trade.date : max), '')
    if (!latest) return current
    const [year, month] = latest.split('-').map(Number)
    return year && month ? new Date(year, month - 1, 1) : current
  })

  const model = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

    const map = new Map<string, DayTradeRow>()

    trades.forEach((trade) => {
      if (!trade.date || trade.date.slice(0, 7) !== monthKey) return
      const row = map.get(trade.date) ?? {
        pnl: 0,
        count: 0,
        wins: 0,
        losses: 0,
        be: 0,
        rMultiple: 0,
      }
      row.pnl += trade.pnl
      row.count += 1
      if (trade.pnl > 0) row.wins += 1
      else if (trade.pnl < 0) row.losses += 1
      else row.be += 1

      row.rMultiple += trade.rMultiple || 0
      map.set(trade.date, row)
    })

    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    const gridStart = mondayOf(monthStart)
    const gridEnd = addDays(mondayOf(monthEnd), 6)

    const weeks: Date[][] = []
    let current = gridStart
    while (current <= gridEnd) {
      const week: Date[] = []
      for (let index = 0; index < 7; index++) {
        week.push(addDays(current, index))
      }
      weeks.push(week)
      current = addDays(current, 7)
    }

    const monthTrades = Array.from(map.values()).reduce((sum, row) => sum + row.count, 0)
    const monthWins = Array.from(map.values()).reduce((sum, row) => sum + row.wins, 0)
    const monthLosses = Array.from(map.values()).reduce((sum, row) => sum + row.losses, 0)
    const greenDays = Array.from(map.values()).filter((row) => row.pnl > 0).length
    const lossDays = Array.from(map.values()).filter((row) => row.pnl < 0).length
    const monthWinRate = monthTrades > 0 ? (monthWins / monthTrades) * 100 : 0
    const monthNet = Array.from(map.values()).reduce((sum, row) => sum + row.pnl, 0)

    return {
      map,
      weeks,
      monthTrades,
      monthWins,
      monthLosses,
      greenDays,
      lossDays,
      sessionDays: map.size,
      monthWinRate,
      monthNet,
    }
  }, [cursor, trades])

  const today = todayISO()
  const nextDisabled = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth()

  return (
    <div className="calendar">
      {/* Clean, structured header bar */}
      <div className="calendar-head">
        <div className="calendar-head-title-wrap">
          <h3 className="calendar-title">{monthName(cursor)}</h3>
          <span className={cn('calendar-month-net num', model.monthNet >= 0 ? 'is-pos' : 'is-neg')}>
            {model.monthNet >= 0 ? <ArrowUpRight size={14} strokeWidth={2.4} /> : <ArrowDownRight size={14} strokeWidth={2.4} />}
            {compactSignedMoney(model.monthNet)}
          </span>
        </div>

        <div className="calendar-controls">
          {/* Month Navigation */}
          <div className="calendar-nav">
            <button
              className="icon-btn"
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="icon-btn"
              type="button"
              aria-label="Next month"
              disabled={nextDisabled}
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Structured Calendar Grid */}
      <div className="calendar-grid">
        <div className="calendar-weekday-row">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
          <span className="calendar-week-label">TOTAL</span>
        </div>

        {model.weeks.map((week, weekIndex) => {
          const weekRows = week
            .map((date) => model.map.get(dateToISO(date)))
            .filter((row): row is DayTradeRow => !!row)

          const weekTrades = weekRows.reduce((sum, row) => sum + row.count, 0)
          const weekWins = weekRows.reduce((sum, row) => sum + row.wins, 0)
          const weekLosses = weekRows.reduce((sum, row) => sum + row.losses, 0)
          const weekNet = weekRows.reduce((sum, row) => sum + row.pnl, 0)

          return (
            <div className="calendar-week" key={weekIndex}>
              {week.map((date) => {
                const iso = dateToISO(date)
                const inMonth =
                  date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear()
                const row = model.map.get(iso)
                const note = notes[iso]
                const future = iso > today

                if (!inMonth) {
                  return (
                    <div className="calendar-day is-outside" key={iso} aria-hidden="true">
                      <span className="calendar-daynum">{date.getDate()}</span>
                    </div>
                  )
                }

                const tone = row ? (row.pnl > 0 ? 'win' : row.pnl < 0 ? 'loss' : 'flat') : ''

                return (
                  <button
                    className={cn(
                      'calendar-day',
                      tone && `is-${tone}`,
                      future && 'is-future',
                      note && 'has-note',
                      !row && 'is-empty'
                    )}
                    key={iso}
                    type="button"
                    disabled={future}
                    onClick={() => onOpenDay(iso)}
                    title={`${formatLongDate(iso)}${
                      row
                        ? ` · ${row.count} trade${row.count > 1 ? 's' : ''} (${row.wins}W / ${row.losses}L)`
                        : ' · No trades logged'
                    }${note ? ' · Journal note recorded' : ''}`}
                  >
                    {/* Top bar: Date Number & Indicators */}
                    <div className="calendar-day-head">
                      <span className="calendar-daynum">
                        {date.getDate()}
                        {date.getDate() === 1 && (
                          <span className="calendar-day-month">
                            {' '}
                            {date.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        )}
                      </span>
                      <div className="calendar-day-indicators">
                        {note && (
                          <span className="calendar-note-badge" title="Journal note recorded">
                            <PenLine size={10} />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="calendar-day-body">
                      {row ? (
                        <>
                          <span className="calendar-pnl num">{compactSignedMoney(row.pnl)}</span>
                          <span className="calendar-day-stats">
                            <span className="num">{row.count} trade{row.count > 1 ? 's' : ''}</span>
                            <span className="sep">·</span>
                            <span className="is-pos">{row.wins}W</span>
                            <span className="sep">·</span>
                            <span className="is-neg">{row.losses}L</span>
                          </span>
                        </>
                      ) : (
                        <span className="calendar-day-empty">
                          {note && <span className="calendar-note-preview-hint">Reflection</span>}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
              <div
                className={cn(
                  'calendar-week-sum',
                  weekNet > 0 ? 'is-win' : weekNet < 0 ? 'is-loss' : 'is-flat'
                )}
              >
                {weekTrades > 0 ? (
                  <>
                    <span className="calendar-week-pnl">{compactSignedMoney(weekNet)}</span>
                    <span className="calendar-week-stats">
                      <span className="is-pos">{weekWins}W</span>
                      <span className="sep">·</span>
                      <span className="is-neg">{weekLosses}L</span>
                    </span>
                  </>
                ) : (
                  <span className="is-dim">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Clean, standard footer */}
      <div className="calendar-foot" />
    </div>
  )
}
