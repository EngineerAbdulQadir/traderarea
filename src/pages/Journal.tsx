import { useMemo } from 'react'
import {
  CalendarDays,
  PenLine,
  Plus,
  Sparkles,
  BookOpen,
  ChevronRight,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Calendar } from '@/components/calendar/Calendar'
import { formatLongDate, formatShortDate } from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

export function JournalPage() {
  const {
    activeAccount,
    activeTrades,
    activeNotes,
    openDayReview,
    openTradeEditor,
    openChallenge,
    addDemoAccount,
  } = useApp()

  // Collect notes sorted by date descending
  const recentNotes = useMemo(() => {
    return Object.entries(activeNotes)
      .filter(([, note]) => note?.text?.trim().length > 0)
      .map(([date, note]) => {
        const dayTrades = activeTrades.filter((t) => t.date === date)
        const dayPnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0)
        return {
          date,
          text: note.text,
          dayPnl,
          tradeCount: dayTrades.length,
          updatedAt: note.updatedAt,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [activeNotes, activeTrades])

  if (!activeAccount) {
    return (
      <div className="page journal-page">
        <PageHeader
          kicker="Session reflections"
          title="Journal"
          subtitle="Your day-by-day trading diary and session review. Open an account to start journaling."
        />
        <EmptyState
          icon={<CalendarDays size={22} />}
          eyebrow="First run"
          title="Build your trading journal"
          description="Start a challenge or load a demo workspace to unlock the session calendar, daily reflections and P&L tracking."
          actions={
            <>
              <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
                Start a challenge
              </Button>
              <Button variant="secondary" iconLeft={<Sparkles size={14} />} onClick={addDemoAccount}>
                Load demo workspace
              </Button>
            </>
          }
        />
      </div>
    )
  }

  return (
    <div className="page journal-page">
      <PageHeader
        kicker="Session reflections"
        title="Journal"
        subtitle="Day-by-day session review, calendar performance and trade reflections."
        actions={
          <>
            <Button
              variant="secondary"
              iconLeft={<Plus size={14} />}
              onClick={openChallenge}
            >
              Challenge
            </Button>
            <Button
              variant="primary"
              iconLeft={<Plus size={14} />}
              onClick={() => openTradeEditor()}
            >
              Log trade
            </Button>
          </>
        }
      />

      {/* Full-width Calendar */}
      <Card className="calendar-card journal-calendar-full w-full">
        <Calendar trades={activeTrades} notes={activeNotes} onOpenDay={openDayReview} />
      </Card>

      {/* Recent Notes on the next line */}
      <Card className="journal-notes-card mt-3">
        <div className="card-head">
          <div className="card-head-copy">
            <span className="card-kicker"><i className="dot" /> Reflections</span>
            <h3 className="card-title">Recent Journal Notes</h3>
            <p className="card-sub">Daily thoughts, trade reviews and lessons logged from your sessions.</p>
          </div>
          <BookOpen size={16} className="card-icon" />
        </div>

        <div className="journal-notes-grid">
          {recentNotes.length > 0 ? (
            recentNotes.map((note) => (
              <button
                key={note.date}
                type="button"
                className="journal-note-item"
                onClick={() => openDayReview(note.date)}
                title={`Review journal for ${formatLongDate(note.date)}`}
              >
                <div className="journal-note-top">
                  <div className="journal-note-date-wrap">
                    <b className="journal-note-date">{formatShortDate(note.date)}</b>
                    {note.tradeCount > 0 && (
                      <span className="journal-note-trades">
                        {note.tradeCount} trade{note.tradeCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {note.tradeCount > 0 && (
                    <span className={cn('journal-note-pnl num', note.dayPnl >= 0 ? 'is-pos' : 'is-neg')}>
                      {signedMoney(note.dayPnl)}
                    </span>
                  )}
                </div>
                <p className="journal-note-preview">{note.text}</p>
                <span className="journal-note-action">
                  <span>Review session</span>
                  <ChevronRight size={12} />
                </span>
              </button>
            ))
          ) : (
            <div className="journal-notes-empty">
              <PenLine size={22} className="opacity-40" />
              <p>No journal reflections written yet.</p>
              <span>Click any date on the calendar above to log your thoughts and session lessons.</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
