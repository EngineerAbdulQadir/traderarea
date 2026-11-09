import { useState } from 'react'
import { NotebookPen, Plus, Upload } from 'lucide-react'
import { titleFor } from '@/lib/accounts'
import { useApp } from '@/store/AppStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Calendar } from '@/components/calendar/Calendar'
import { ImportTradesModal } from '@/components/modals/ImportTradesModal'

export function JournalPage() {
  const [importOpen, setImportOpen] = useState(false)
  const [focusDate, setFocusDate] = useState('')
  const {
    activeAccount,
    activeTrades,
    activeNotes,
    openDayReview,
    openTradeEditor,
    openChallenge,
    viewingPhaseIndex,
    setViewingPhase,
  } = useApp()

  if (!activeAccount) {
    return (
      <div className="page journal-page">
        <EmptyState
          icon={<NotebookPen size={22} />}
          title="Build your trading journal"
          description="Start a challenge to unlock the session calendar, daily reflections and P&L tracking."
          actions={
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Start a challenge
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page journal-page">
      <div className="flex justify-end gap-2 mb-4">
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Upload size={14} />}
          onClick={() => setImportOpen(true)}
        >
          Import history
        </Button>
        <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={() => openTradeEditor()}>
          Log trade
        </Button>
      </div>

      {viewingPhaseIndex !== null && (
        <div className="phase-view-banner">
          <span>
            Reviewing {activeAccount?.stage ?? 'previous phase'} history for{' '}
            {activeAccount ? titleFor(activeAccount) : 'this account'}.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setViewingPhase(null)}>
            Back to current phase
          </Button>
        </div>
      )}

      {/* Full-width Calendar */}
      <Card className="calendar-card journal-calendar-full w-full">
        <Calendar trades={activeTrades} notes={activeNotes} onOpenDay={openDayReview} focusDate={focusDate} />
      </Card>

      <ImportTradesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(result) => setFocusDate(result.to)}
      />
    </div>
  )
}
