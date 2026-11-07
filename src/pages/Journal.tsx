import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Calendar } from '@/components/calendar/Calendar'

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

  if (!activeAccount) {
    return (
      <div className="page journal-page">
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
      <div className="flex justify-end mb-4">
        <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={() => openTradeEditor()}>
          Log trade
        </Button>
      </div>

      {/* Full-width Calendar */}
      <Card className="calendar-card journal-calendar-full w-full">
        <Calendar trades={activeTrades} notes={activeNotes} onOpenDay={openDayReview} />
      </Card>


    </div>
  )
}
