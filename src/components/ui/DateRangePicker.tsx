import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  dateToISO,
  formatDateRange,
  formatLongDate,
  formatShortDate,
  isValidISODate,
  mondayOf,
  monthName,
  parseISODate,
  todayISO,
} from '@/lib/dates'
import { cn } from '@/lib/cn'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  minDate?: string
  maxDate?: string
  className?: string
}

function monthStartOf(iso: string): Date {
  const date = parseISODate(iso)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

export function DateRangePicker({
  from,
  to,
  onChange,
  minDate,
  maxDate,
  className,
}: DateRangePickerProps) {
  const today = maxDate && isValidISODate(maxDate) ? maxDate : todayISO()
  const safeFrom = isValidISODate(from) ? from : today
  const safeTo = isValidISODate(to) ? to : today
  const earliest = minDate && isValidISODate(minDate) && minDate <= today ? minDate : ''

  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(safeFrom)
  const [draftTo, setDraftTo] = useState(safeTo)
  const [cursor, setCursor] = useState(() => monthStartOf(safeFrom))
  const [hover, setHover] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const days = useMemo(() => {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const gridStart = mondayOf(monthStart)
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [cursor])

  const previewEnd = draftFrom && !draftTo && hover ? hover : draftTo
  const rangeLower = draftFrom && previewEnd ? (draftFrom <= previewEnd ? draftFrom : previewEnd) : draftFrom
  const rangeUpper = draftFrom && previewEnd ? (draftFrom <= previewEnd ? previewEnd : draftFrom) : draftFrom
  const nextDisabled = monthIndex(cursor) >= monthIndex(monthStartOf(today))

  const toggleOpen = () => {
    if (open) {
      setOpen(false)
      return
    }
    setDraftFrom(safeFrom)
    setDraftTo(safeTo)
    setHover('')
    setCursor(monthStartOf(safeFrom))
    setOpen(true)
  }

  const chooseDay = (iso: string) => {
    if (iso > today) return
    const date = parseISODate(iso)
    if (date.getFullYear() !== cursor.getFullYear() || date.getMonth() !== cursor.getMonth()) {
      setCursor(new Date(date.getFullYear(), date.getMonth(), 1))
    }
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso)
      setDraftTo('')
      setHover('')
      return
    }
    if (iso < draftFrom) {
      setDraftTo(draftFrom)
      setDraftFrom(iso)
    } else {
      setDraftTo(iso)
    }
    setHover('')
  }

  const apply = () => {
    if (!draftFrom || !draftTo) return
    const start = draftFrom <= draftTo ? draftFrom : draftTo
    const end = draftFrom <= draftTo ? draftTo : draftFrom
    onChange(start, end)
    setOpen(false)
  }

  const applyAllTime = () => {
    if (!earliest) return
    setDraftFrom(earliest)
    setDraftTo(today)
    setHover('')
    setCursor(monthStartOf(earliest))
  }

  return (
    <div className={cn('date-range-picker', className)} ref={rootRef}>
      <button
        className={cn('date-range-trigger', open && 'is-open')}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Date range: ${formatDateRange(safeFrom, safeTo)}`}
      >
        <CalendarDays size={14} />
        <span className="date-range-trigger-text">{formatDateRange(safeFrom, safeTo)}</span>
        <ChevronDown size={14} className="date-range-chevron" />
      </button>

      {open && (
        <div className="date-range-pop" role="dialog" aria-label="Select date range">
          <div className="date-range-head">
            <span className="date-range-month">{monthName(cursor)}</span>
            <div className="date-range-nav">
              {earliest && (
                <button className="date-range-quick" type="button" onClick={applyAllTime}>
                  All time
                </button>
              )}
              <button
                className="date-range-quick"
                type="button"
                onClick={() => setCursor(monthStartOf(today))}
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

          <div className="date-range-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="date-range-grid" onMouseLeave={() => setHover('')}>
            {days.map((date) => {
              const iso = dateToISO(date)
              const inMonth =
                date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear()
              const disabled = iso > today
              const selected = iso === draftFrom || iso === draftTo
              const inRange = !!rangeLower && !!rangeUpper && iso >= rangeLower && iso <= rangeUpper
              const rangeStart = inRange && iso === rangeLower
              const rangeEnd = inRange && iso === rangeUpper
              return (
                <div
                  className={cn(
                    'date-range-cell',
                    inRange && 'is-in-range',
                    rangeStart && 'is-range-start',
                    rangeEnd && 'is-range-end',
                  )}
                  key={iso}
                >
                  <button
                    className={cn(
                      'date-range-day',
                      !inMonth && 'is-outside',
                      iso === today && 'is-today',
                      selected && 'is-selected',
                      disabled && 'is-future',
                    )}
                    type="button"
                    disabled={disabled}
                    aria-label={formatLongDate(iso)}
                    aria-pressed={selected}
                    onClick={() => chooseDay(iso)}
                    onMouseEnter={() => {
                      if (draftFrom && !draftTo) setHover(iso)
                    }}
                  >
                    {date.getDate()}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="date-range-foot">
            <div className="date-range-summary">
              <span>{draftFrom && draftTo ? 'Selected range' : 'Select range'}</span>
              <b>
                {draftFrom && draftTo
                  ? formatDateRange(draftFrom, draftTo)
                  : draftFrom
                    ? `${formatShortDate(draftFrom)} – pick an end date`
                    : 'Pick a start date'}
              </b>
            </div>
            <div className="date-range-actions">
              <button className="date-range-btn" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="date-range-btn is-primary"
                type="button"
                disabled={!draftFrom || !draftTo}
                onClick={apply}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
