import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthRow {
  pnl: number
  count: number
}

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
    const map = new Map<string, MonthRow>()
    trades.forEach((trade) => {
      if (!trade.date || trade.date.slice(0, 7) !== monthKey) return
      const row = map.get(trade.date) ?? { pnl: 0, count: 0 }
      row.pnl += trade.pnl
      row.count += 1
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
    const greenDays = Array.from(map.values()).filter((row) => row.pnl > 0).length
    const maxAbs = Math.max(1, ...Array.from(map.values()).map((row) => Math.abs(row.pnl)))
    const monthNotes = Object.keys(notes).filter((date) => date.slice(0, 7) === monthKey).length
    return {
      map,
      weeks,
      monthNet,
      monthTrades,
      greenDays,
      sessionDays: map.size,
      maxAbs,
      monthNotes,
      monthKey,
    }
  }, [cursor, trades, notes])

  const today = todayISO()
  const nextDisabled = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth()

  return (
    <div className="calendar">
      <div className="calendar-head">
        <div>
          <span className="calendar-kicker">P&L calendar</span>
          <h3 className="calendar-title">{monthName(cursor)}</h3>
          <p className="calendar-sub">
            {model.monthTrades
              ? `${model.monthTrades} trades · ${model.sessionDays} sessions · ${model.monthNotes} notes`
              : 'No trades this month'}
          </p>
        </div>
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
            <ChevronLeft size={14} />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Next month"
            disabled={nextDisabled}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="calendar-summary">
        <div>
          <span>Month net</span>
          <b className={cn('num', model.monthNet > 0 && 'is-pos', model.monthNet < 0 && 'is-neg')}>
            {model.monthTrades ? signedMoney(model.monthNet) : '—'}
          </b>
        </div>
        <div>
          <span>Trades</span>
          <b className="num">{model.monthTrades || '—'}</b>
        </div>
        <div>
          <span>Green days</span>
          <b className="num">{model.sessionDays ? `${model.greenDays} / ${model.sessionDays}` : '—'}</b>
        </div>
        <div>
          <span>Avg / day</span>
          <b
            className={cn(
              'num',
              model.monthNet > 0 && 'is-pos',
              model.monthNet < 0 && 'is-neg',
            )}
          >
            {model.sessionDays ? signedMoney(model.monthNet / model.sessionDays) : '—'}
          </b>
        </div>
      </div>

      <div className="calendar-grid">
        <div className="calendar-weekday-row">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
          <span className="calendar-week-label">Week</span>
        </div>
        {model.weeks.map((week, weekIndex) => {
          const weekRows = week
            .map((date) => model.map.get(dateToISO(date)))
            .filter((row): row is MonthRow => !!row)
          const weekNet = weekRows.reduce((sum, row) => sum + row.pnl, 0)
          const weekTrades = weekRows.reduce((sum, row) => sum + row.count, 0)
          return (
            <div className="calendar-week" key={weekIndex}>
              {week.map((date) => {
                const iso = dateToISO(date)
                const inMonth = date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear()
                const row = model.map.get(iso)
                const note = notes[iso]
                const future = iso > today
                const ratio = row ? Math.abs(row.pnl) / model.maxAbs : 0
                const level = ratio > 0.72 ? 4 : ratio > 0.42 ? 3 : ratio > 0.16 ? 2 : 1
                const tone = row ? (row.pnl > 0 ? 'win' : row.pnl < 0 ? 'loss' : 'flat') : ''
                if (!inMonth) {
                  return <span className="calendar-day is-outside" key={iso} aria-hidden="true" />
                }
                return (
                  <button
                    className={cn(
                      'calendar-day',
                      tone && `is-${tone}`,
                      tone && `lvl-${level}`,
                      iso === today && 'is-today',
                      future && 'is-future',
                      note && 'has-note',
                    )}
                    key={iso}
                    type="button"
                    disabled={future}
                    onClick={() => onOpenDay(iso)}
                    title={`${formatLongDate(iso)}${row ? ` · ${signedMoney(row.pnl)} · ${row.count} trades` : ' · no trades'}${note ? ' · journal note' : ''}`}
                  >
                    <span className="calendar-daynum">{date.getDate()}</span>
                    {row && (
                      <>
                        <span className="calendar-pnl num">{compactSignedMoney(row.pnl)}</span>
                        <span className="calendar-count">{row.count}t</span>
                      </>
                    )}
                    {note && <span className="calendar-note-dot" aria-hidden="true" />}
                  </button>
                )
              })}
              <div className={cn('calendar-week-sum', weekTrades > 0 && (weekNet > 0 ? 'is-win' : weekNet < 0 ? 'is-loss' : ''))}>
                {weekTrades ? (
                  <>
                    <b className="num">{compactSignedMoney(weekNet)}</b>
                    <span>{weekTrades} trades</span>
                  </>
                ) : (
                  <span className="is-dim">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="calendar-foot">
        <span>{formatShortDate(dateToISO(model.weeks[0][0]))} — {formatShortDate(dateToISO(model.weeks[model.weeks.length - 1][6]))}</span>
        <span className="calendar-legend">
          <i className="neg" /> Loss
          <i className="pos" /> Profit
          <i className="note" /> Note
        </span>
      </div>
    </div>
  )
}
