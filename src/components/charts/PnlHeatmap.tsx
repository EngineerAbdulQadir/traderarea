import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useElementSize } from '@/hooks/useElementSize'
import {
  addDays,
  dateToISO,
  formatLongDate,
  monthShort,
  mondayOf,
  parseISODate,
  todayISO,
} from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import type { DayRow } from '@/lib/types'
import { cn } from '@/lib/cn'

interface PnlHeatmapProps {
  /** Full day history. The map shows one calendar year at a time. */
  days: DayRow[]
  /** Anchor date — the year initially shown. */
  to: string
  onOpenDay?: (date: string) => void
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_LABELS: Record<number, string> = {
  1: 'M',
  2: 'T',
  3: 'W',
  4: 'T',
  5: 'F',
  6: 'S',
  0: 'S',
}

interface MonthGroup {
  label: string
  month: number
  weeks: Date[][]
}

export function PnlHeatmap({ days, to, onOpenDay }: PnlHeatmapProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const today = todayISO()
  const currentYear = parseISODate(today).getFullYear()
  const anchorYear = parseISODate(to).getFullYear()

  const dataYears = useMemo(
    () => days.map((day) => parseISODate(day.date).getFullYear()),
    [days],
  )
  const minYear = Math.min(currentYear, ...dataYears)
  const maxYear = Math.max(currentYear, ...dataYears)
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const year = Math.min(maxYear, Math.max(minYear, pickedYear ?? anchorYear))

  const model = useMemo(() => {
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31)
    const startISO = dateToISO(yearStart)
    const endISO = dateToISO(yearEnd)

    const inYear = days
      .filter((day) => day.date >= startISO && day.date <= endISO)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
    const map = new Map(inYear.map((day) => [day.date, day]))

    const hasWeekend = inYear.some((day) => {
      const weekday = parseISODate(day.date).getDay()
      return weekday === 0 || weekday === 6
    })
    const weekdays = hasWeekend ? MONDAY_FIRST : MONDAY_FIRST.slice(0, 5)
    const dayIndexes = weekdays.map((weekday) => (weekday === 0 ? 6 : weekday - 1))

    // Each month gets its own block of weeks so boundary weeks never push one
    // month's dates under a neighbouring month's label.
    const monthGroups: MonthGroup[] = []
    let totalWeeks = 0
    for (let month = 0; month < 12; month += 1) {
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)
      const lastMonday = mondayOf(monthEnd)
      const weeks: Date[][] = []

      for (let cursor = mondayOf(monthStart); cursor <= lastMonday; cursor = addDays(cursor, 7)) {
        const week = Array.from({ length: 7 }, (_, index) => addDays(cursor, index))
        const showsMonth = dayIndexes.some((index) => {
          const date = week[index]
          return date.getFullYear() === year && date.getMonth() === month
        })
        if (showsMonth) weeks.push(week)
      }

      monthGroups.push({ label: monthShort(monthStart), month, weeks })
      totalWeeks += weeks.length
    }

    let net = 0
    inYear.forEach((day) => {
      net += day.pnl
    })

    const maxAbs = Math.max(1, ...inYear.map((day) => Math.abs(day.pnl)))

    return {
      startISO,
      endISO,
      map,
      weekdays,
      monthGroups,
      totalWeeks,
      net,
      maxAbs,
    }
  }, [days, year])

  const currentMonth = parseISODate(today).getMonth()
  const canGoBack = year > minYear
  const canGoForward = year < maxYear

  const gutter = 28
  const gap = 3
  const monthGap = 10
  const totalGaps =
    gap * Math.max(0, model.totalWeeks - model.monthGroups.length) +
    gap * model.monthGroups.length +
    (monthGap - gap) * Math.max(0, model.monthGroups.length - 1)
  const cellSize =
    width > 0
      ? Math.min(20, Math.max(9, Math.floor((width - gutter - totalGaps) / model.totalWeeks)))
      : 14
  const gridRows = `18px repeat(${model.weekdays.length}, ${cellSize}px)`

  return (
    <div className="pnl-heat">
      <div className="card-head">
        <div className="card-head-copy">
          <span className="card-kicker">P&amp;L heatmap</span>
        </div>
        <div className="card-head-value">
          <b className={cn('num', model.net > 0 && 'is-pos', model.net < 0 && 'is-neg')}>
            {signedMoney(model.net)}
          </b>
          <span>Calendar year</span>
        </div>
      </div>

      <div className="pnl-heat-scroll" ref={wrapRef}>
        <div className="pnl-heat-body">
          <div
            className="pnl-heat-gutter"
            style={{ gridTemplateRows: gridRows, rowGap: gap }}
            aria-hidden="true"
          >
            <span className="pnl-heat-month" />
            {model.weekdays.map((weekday) => (
              <span className="pnl-heat-weekday" key={`weekday-${weekday}`}>
                {WEEKDAY_LABELS[weekday]}
              </span>
            ))}
          </div>

          {model.monthGroups.map((group) => {
            const isCurrent = year === currentYear && group.month === currentMonth
            return (
              <div
                className="pnl-heat-block"
                key={`${group.label}-${group.month}`}
                style={{
                  gridTemplateColumns: `repeat(${group.weeks.length}, ${cellSize}px)`,
                  gridTemplateRows: gridRows,
                  columnGap: gap,
                  rowGap: gap,
                }}
              >
                <span
                  className={cn('pnl-heat-month', isCurrent && 'is-current')}
                  style={{ gridColumn: `1 / span ${group.weeks.length}`, gridRow: 1 }}
                >
                  {group.label}
                  {isCurrent && <em>Current</em>}
                </span>

                {model.weekdays.map((weekday, rowIndex) => {
                  const dayIndex = weekday === 0 ? 6 : weekday - 1
                  return (
                    <Fragment key={`row-${weekday}`}>
                      {group.weeks.map((week, weekIndex) => {
                        const date = week[dayIndex]
                        const iso = dateToISO(date)
                        const style = { gridColumn: weekIndex + 1, gridRow: rowIndex + 2 }
                        const inMonth = date.getFullYear() === year && date.getMonth() === group.month

                        if (!inMonth) {
                          return <span className="pnl-heat-cell is-out" key={iso} style={style} aria-hidden="true" />
                        }

                        const row = model.map.get(iso)
                        const isToday = iso === today
                        const tone = row ? (row.pnl > 0 ? 'win' : row.pnl < 0 ? 'loss' : 'flat') : 'empty'

                        let tint: CSSProperties = {}
                        if (row) {
                          const ratio = Math.min(1, Math.abs(row.pnl) / model.maxAbs)
                          const alpha = row.pnl === 0 ? 0.1 : 0.16 + Math.pow(ratio, 0.55) * 0.74
                          tint = { background: `rgb(var(--heat-blue-rgb) / ${alpha.toFixed(3)})` }
                        }

                        const label = row
                          ? `${formatLongDate(iso)} · ${signedMoney(row.pnl)} · ${row.count} trade${row.count === 1 ? '' : 's'} (${row.wins}W / ${row.losses}L)`
                          : `${formatLongDate(iso)} · No sessions logged`

                        return (
                          <button
                            type="button"
                            className={cn('pnl-heat-cell', `is-${tone}`, isToday && 'is-today')}
                            style={{ ...style, ...tint }}
                            key={iso}
                            onClick={() => onOpenDay?.(iso)}
                            title={label}
                            aria-label={label}
                          />
                        )
                      })}
                    </Fragment>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="pnl-heat-nav">
        <button
          type="button"
          className="pnl-heat-nav-btn"
          onClick={() => setPickedYear(year - 1)}
          disabled={!canGoBack}
          aria-label="Previous year"
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
        <span className="pnl-heat-nav-year num">{year}</span>
        <button
          type="button"
          className="pnl-heat-nav-btn"
          onClick={() => setPickedYear(year + 1)}
          disabled={!canGoForward}
          aria-label="Next year"
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="pnl-heat-foot">
        <div className="pnl-heat-legend">
          <span>Low</span>
          <i className="is-low" />
          <i className="is-low-mid" />
          <i className="is-mid" />
          <i className="is-high-mid" />
          <i className="is-high" />
          <span>High</span>
        </div>
        <span className="pnl-heat-hint">
          Each square is one trading day · darker means a larger result
        </span>
      </div>
    </div>
  )
}
