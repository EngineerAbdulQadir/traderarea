import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  ListOrdered,
  PenLine,
  Plus,
  SearchX,
  Sparkles,
  X,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountPill } from '@/components/ui/AccountPill'
import { avgOf, computeStats, getStartingBalance } from '@/lib/stats'
import {
  addDays,
  dateToISO,
  formatLongDate,
  formatShortDate,
  monthKeyName,
  monthName,
  parseISODate,
  startOfDay,
  todayISO,
} from '@/lib/dates'
import { plainPercent, signedMoney } from '@/lib/format'
import { noteSavedLabel, wordCount } from '@/lib/notes'
import { cn } from '@/lib/cn'

type NoteFilter = 'all' | 'win' | 'loss'

const FILTER_OPTIONS: { value: NoteFilter; label: string }[] = [
  { value: 'all', label: 'All notes' },
  { value: 'win', label: 'Winning days' },
  { value: 'loss', label: 'Losing days' },
]

function formatNoteDate(date: string) {
  const parsed = parseISODate(date)
  return {
    day: String(parsed.getDate()).padStart(2, '0'),
    month: parsed.toLocaleDateString('en-US', { month: 'short' }),
    weekday: parsed.toLocaleDateString('en-US', { weekday: 'long' }),
  }
}

export function NotesPage() {
  const { activeAccount, activeTrades, activeNotes, activeIsDemo, openDayReview } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<NoteFilter>('all')

  const starting = getStartingBalance(activeAccount)
  const stats = useMemo(() => computeStats(activeTrades, starting), [activeTrades, starting])
  const noteDates = useMemo(
    () =>
      Object.keys(activeNotes)
        .filter((date) => activeNotes[date]?.text?.trim())
        .sort()
        .reverse(),
    [activeNotes],
  )

  const summary = useMemo(() => {
    const monthKey = todayISO().slice(0, 7)
    const cutoff = dateToISO(addDays(startOfDay(new Date()), -29))
    const recentDays = stats.dayRows.filter((day) => day.date >= cutoff)
    const covered = recentDays.filter((day) => activeNotes[day.date]?.text?.trim()).length
    const words = noteDates.map((date) => wordCount(activeNotes[date].text))
    return {
      thisMonth: noteDates.filter((date) => date.slice(0, 7) === monthKey).length,
      coverage: recentDays.length ? (covered / recentDays.length) * 100 : 0,
      covered,
      recentCount: recentDays.length,
      averageWords: words.length ? Math.round(avgOf(words)) : 0,
      recent: noteDates.slice(0, 3),
    }
  }, [activeNotes, noteDates, stats.dayRows])

  const filteredDates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return noteDates.filter((date) => {
      const row = stats.dayMap.get(date)
      if (filter === 'win' && !(row && row.pnl > 0)) return false
      if (filter === 'loss' && !(row && row.pnl < 0)) return false
      if (q && !`${activeNotes[date].text} ${formatLongDate(date)} ${date}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [activeNotes, filter, noteDates, query, stats.dayMap])

  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    filteredDates.forEach((date) => {
      const key = date.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(date)
    })
    return Array.from(map.entries()).map(([key, dates]) => {
      const net = dates.reduce((sum, date) => sum + (stats.dayMap.get(date)?.pnl ?? 0), 0)
      return { key, dates, net }
    })
  }, [filteredDates, stats.dayMap])

  const activeFilters = !!query.trim() || filter !== 'all'

  if (!activeAccount) {
    return (
      <div className="page">
        <PageHeader
          kicker="Reflection log"
          title="Notes"
          subtitle="Daily context, lessons and intent — attached to the days that built your curve."
        />
        <EmptyState
          icon={<BookOpenText size={22} />}
          eyebrow="No active workspace"
          title="A journal begins with an account"
          description="Start a challenge or open a demo workspace. Then every session can carry a note, from the plan to the lesson."
          actions={
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={() => navigate('/accounts')}>
              Go to accounts
            </Button>
          }
        />
      </div>
    )
  }

  const today = todayISO()
  const todayNote = activeNotes[today]?.text?.trim()

  return (
    <div className="page notes-page">
      <PageHeader
        kicker="Reflection log"
        title="Notes"
        subtitle={
          <>
            Daily reflections from <b className="page-subject">{activeAccount.firm}</b>.
            {activeIsDemo ? ' Seeded with sample reflections while you explore.' : ''}
          </>
        }
        actions={
          <>
            {activeIsDemo && <Badge tone="violet">Sample data</Badge>}
            <AccountPill account={activeAccount} onClick={() => navigate('/accounts')} />
            <Button
              variant="primary"
              size="sm"
              iconLeft={<PenLine size={13} />}
              onClick={() => openDayReview(today, { editNote: true })}
            >
              {todayNote ? "Edit today's note" : "Today's note"}
            </Button>
          </>
        }
      />

      <section className="notes-kpis">
        <Card className="stat-kpi">
          <span className="stat-kpi-label"><i /> Notes written</span>
          <strong className="stat-kpi-value num">{noteDates.length}</strong>
          <span className="stat-kpi-sub">
            {noteDates.length ? `latest ${formatShortDate(noteDates[0])}` : 'none yet'}
          </span>
        </Card>
        <Card className="stat-kpi">
          <span className="stat-kpi-label"><i /> This month</span>
          <strong className="stat-kpi-value num">{summary.thisMonth}</strong>
          <span className="stat-kpi-sub">{monthName(new Date())}</span>
        </Card>
        <Card className="stat-kpi">
          <span className="stat-kpi-label"><i /> 30-day coverage</span>
          <strong className="stat-kpi-value num">
            {summary.recentCount ? `${plainPercent(summary.coverage, 0)}%` : '—'}
          </strong>
          <span className="stat-kpi-sub">
            {summary.recentCount ? `${summary.covered} of ${summary.recentCount} trading days` : 'no recent sessions'}
          </span>
        </Card>
        <Card className="stat-kpi">
          <span className="stat-kpi-label"><i /> Average length</span>
          <strong className="stat-kpi-value num">{summary.averageWords ? `${summary.averageWords}` : '—'}<small>{summary.averageWords ? ' words' : ''}</small></strong>
          <span className="stat-kpi-sub">per written note</span>
        </Card>
      </section>

      <div className="notes-toolbar-row">
        <Card className="notes-toolbar">
          <div className="search-input notes-search">
            <BookOpenText size={14} />
            <input
              className="input"
              type="search"
              placeholder="Search notes, dates or lessons…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search notes"
            />
            {query && (
              <button className="entries-search-clear" type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
          <Segmented label="Filter notes" value={filter} options={FILTER_OPTIONS} onChange={setFilter} size="sm" />
          {activeFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
            >
              Clear
            </Button>
          )}
        </Card>
        <span className="notes-result-count num">
          {filteredDates.length} note{filteredDates.length === 1 ? '' : 's'}
          {activeFilters ? ' filtered' : ''}
        </span>
      </div>

      {filteredDates.length === 0 ? (
        <EmptyState
          className="notes-empty"
          icon={activeFilters ? <SearchX size={22} /> : <BookOpenText size={22} />}
          eyebrow={activeFilters ? 'No matches' : 'A blank page'}
          title={activeFilters ? 'No notes match this view' : 'Your journal starts with one sentence'}
          description={
            activeFilters
              ? 'Try a different search, or clear the filters to see every reflection.'
              : 'Capture what you saw, what you executed and what you will repeat. Notes attach to each trading day and account.'
          }
          actions={
            activeFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" iconLeft={<PenLine size={14} />} onClick={() => openDayReview(today, { editNote: true })}>
                Write today's note
              </Button>
            )
          }
        />
      ) : (
        <div className="notes-months">
          {groups.map((group) => (
            <section className="notes-month" key={group.key}>
              <div className="notes-month-head">
                <div className="notes-month-title">
                  <span className="notes-month-kicker">Notebook</span>
                  <h2>{monthKeyName(group.key)}</h2>
                </div>
                <div className="notes-month-meta">
                  <span>{group.dates.length} note{group.dates.length === 1 ? '' : 's'}</span>
                  <span className={cn('num', group.net > 0 && 'is-pos', group.net < 0 && 'is-neg')}>
                    {group.net ? `${signedMoney(group.net)} on noted days` : 'flat on noted days'}
                  </span>
                </div>
              </div>
              <div className="notes-grid">
                {group.dates.map((date) => {
                  const note = activeNotes[date]
                  const row = stats.dayMap.get(date)
                  const pnl = row?.pnl ?? 0
                  const words = wordCount(note.text)
                  const dateParts = formatNoteDate(date)
                  const isToday = date === today
                  return (
                    <button
                      className={cn(
                        'note-card',
                        pnl > 0 && 'is-win',
                        pnl < 0 && 'is-loss',
                        isToday && 'is-today',
                      )}
                      type="button"
                      key={date}
                      onClick={() => openDayReview(date)}
                    >
                      <span className="note-card-top">
                        <span className="note-date">
                          <b className="num">{dateParts.day}</b>
                          <span>{dateParts.month}</span>
                        </span>
                        <span className="note-card-badges">
                          {isToday && <Badge tone="accent">Today</Badge>}
                          {note.seeded && <Badge tone="violet">Sample</Badge>}
                        </span>
                        <span className={cn('note-pnl num', pnl > 0 && 'is-pos', pnl < 0 && 'is-neg')}>
                          {row ? signedMoney(pnl) : 'No trades'}
                        </span>
                        <ArrowUpRight size={13} className="note-open-icon" />
                      </span>
                      <p className="note-body">{note.text}</p>
                      <span className="note-card-foot">
                        <span><CalendarDays size={11} />{dateParts.weekday}</span>
                        <span><ListOrdered size={11} />{row ? `${row.count} trade${row.count === 1 ? '' : 's'}` : 'no trades'}</span>
                        <span>{words} words</span>
                        <span className="note-saved">{noteSavedLabel(note.updatedAt)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeIsDemo && noteDates.length > 0 && (
        <div className="notes-demo-note">
          <Sparkles size={13} />
          <span>Sample reflections are local to this workspace. Log a real trade and they make way for your own journal.</span>
        </div>
      )}

      <div className="notes-footnote">
        <span><BookOpenText size={12} /> {noteDates.length} reflections · {summary.thisMonth} this month</span>
        <span>{activeIsDemo ? 'Sample workspace' : 'Stored on this device'}</span>
      </div>
    </div>
  )
}
