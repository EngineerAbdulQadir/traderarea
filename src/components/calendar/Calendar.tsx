import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, PenLine } from 'lucide-react'
import type { Note, Trade } from '@/lib/types'
import {
  addDays,
  dateToISO,
  formatLongDate,
  formatShortDate,
  mondayOf,
  monthName,
  todayISO,
} from '@/lib/dates'
import { compactSignedMoney, signedMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

interface CalendarProps {
  trades: Trade[]
  notes: Record<string, Note>
  onOpenDay: (date: string) => void
}

export type CalendarViewMode = 'pnl' | 'r'

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

  const [viewMode, setViewMode] = useState<CalendarViewMode>('pnl')

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

    const monthNet = Array.from(map.values()).reduce((sum, row) => sum + row.pnl, 0)
    const monthTrades = Array.from(map.values()).reduce((sum, row) => sum + row.count, 0)
    const monthWins = Array.from(map.values()).reduce((sum, row) => sum + row.wins, 0)
    const monthLosses = Array.from(map.values()).reduce((sum, row) => sum + row.losses, 0)
    const greenDays = Array.from(map.values()).filter((row) => row.pnl > 0).length
    const lossDays = Array.from(map.values()).filter((row) => row.pnl < 0).length
    const monthTotalR = Array.from(map.values()).reduce((sum, row) => sum + row.rMultiple, 0)
    const maxAbs = Math.max(1, ...Array.from(map.values()).map((row) => Math.abs(row.pnl)))
    const monthWinRate = monthTrades > 0 ? (monthWins / monthTrades) * 100 : 0

    return {
      map,
      weeks,
      monthNet,
      monthTrades,
      monthWins,
      monthLosses,
      greenDays,
      lossDays,
      monthTotalR,
      sessionDays: map.size,
      maxAbs,
      monthWinRate,
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
          <span
            className={cn(
              'calendar-month-net num',
              model.monthNet > 0 && 'is-pos',
              model.monthNet < 0 && 'is-neg'
            )}
          >
            {model.monthTrades ? signedMoney(model.monthNet) : '$0.00'}
          </span>
          {model.monthTrades > 0 && (
            <span className="calendar-head-meta">
              <span className="num">{model.monthTrades}</span> trades
              <span className="sep">·</span>
              <span className="num is-pos">{model.greenDays}W</span> -{' '}
              <span className="num is-neg">{model.lossDays}L</span>
              <span className="sep">·</span>
              <span className="num">{Math.round(model.monthWinRate)}%</span> win
            </span>
          )}
        </div>

        <div className="calendar-controls">
          {/* Mode Switcher */}
          <div className="calendar-toggle-group" role="group" aria-label="Metric display mode">
            <button
              type="button"
              className={cn('calendar-toggle-btn', viewMode === 'pnl' && 'is-active')}
              onClick={() => setViewMode('pnl')}
            >
              Net P&L
            </button>
            <button
              type="button"
              className={cn('calendar-toggle-btn', viewMode === 'r' && 'is-active')}
              onClick={() => setViewMode('r')}
            >
              R-Multiple
            </button>
          </div>

          {/* Month Navigation */}
          <div className="calendar-nav">
            <button
              className="calendar-today"
              type="button"
              onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}
            >
              Today
            </button>
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
          const weekNet = weekRows.reduce((sum, row) => sum + row.pnl, 0)
          const weekTrades = weekRows.reduce((sum, row) => sum + row.count, 0)
          const weekWins = weekRows.reduce((sum, row) => sum + row.wins, 0)
          const weekLosses = weekRows.reduce((sum, row) => sum + row.losses, 0)
          const weekR = weekRows.reduce((sum, row) => sum + row.rMultiple, 0)

          return (
            <div className="calendar-week" key={weekIndex}>
              {week.map((date) => {
                const iso = dateToISO(date)
                const inMonth =
                  date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear()
                const row = model.map.get(iso)
                const note = notes[iso]
                const future = iso > today
                const isToday = iso === today

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
                      isToday && 'is-today',
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
                        ? ` · ${signedMoney(row.pnl)} · ${row.count} trade${row.count > 1 ? 's' : ''} (${row.wins}W / ${row.losses}L)`
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
                        {isToday && <span className="calendar-today-pill">TODAY</span>}
                        {note && (
                          <span className="calendar-note-badge" title="Journal note recorded">
                            <PenLine size={10} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Center & Bottom: Metrics */}
                    {row ? (
                      <div className="calendar-day-body">
                        {viewMode === 'pnl' ? (
                          <>
                            <span className="calendar-pnl num">{compactSignedMoney(row.pnl)}</span>
                            <span className="calendar-sub-stat">
                              <span className="is-pos">{row.wins}W</span>
                              <span className="sep">·</span>
                              <span className="is-neg">{row.losses}L</span>
                              {row.rMultiple !== 0 && (
                                <>
                                  <span className="sep">·</span>
                                  <span className="num">
                                    {row.rMultiple > 0 ? '+' : ''}
                                    {row.rMultiple.toFixed(1)}R
                                  </span>
                                </>
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className={cn(
                                'calendar-pnl num',
                                row.rMultiple > 0 ? 'is-pos' : row.rMultiple < 0 ? 'is-neg' : ''
                              )}
                            >
                              {row.rMultiple >= 0 ? '+' : ''}
                              {row.rMultiple.toFixed(1)}R
                            </span>
                            <span className="calendar-sub-stat num">
                              {compactSignedMoney(row.pnl)} · {row.count}t
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="calendar-day-empty">
                        {note && <span className="calendar-note-preview-hint">Reflection</span>}
                      </div>
                    )}
                  </button>
                )
              })}

              {/* Weekly Total Column */}
              <div
                className={cn(
                  'calendar-week-sum',
                  weekTrades > 0 && (weekNet > 0 ? 'is-win' : weekNet < 0 ? 'is-loss' : 'is-flat')
                )}
              >
                {weekTrades > 0 ? (
                  <>
                    <b className={cn('num calendar-week-pnl', weekNet > 0 ? 'is-pos' : weekNet < 0 ? 'is-neg' : '')}>
                      {compactSignedMoney(weekNet)}
                    </b>
                    <span className="calendar-week-sub">
                      {weekWins}W · {weekLosses}L
                    </span>
                    {weekR !== 0 && (
                      <span className={cn('calendar-week-r num', weekR > 0 ? 'is-pos' : weekR < 0 ? 'is-neg' : '')}>
                        {weekR >= 0 ? '+' : ''}{weekR.toFixed(1)}R
                      </span>
                    )}
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
      <div className="calendar-foot">
        <span className="calendar-range-span">
          {formatShortDate(dateToISO(model.weeks[0][0]))} —{' '}
          {formatShortDate(dateToISO(model.weeks[model.weeks.length - 1][6]))}
        </span>
        <div className="calendar-legend">
          <span className="legend-tag">
            <i className="pos" /> Profit day
          </span>
          <span className="legend-tag">
            <i className="neg" /> Loss day
          </span>
          <span className="legend-tag">
            <i className="note" /> Journal note
          </span>
        </div>
      </div>
    </div>
  )
}
