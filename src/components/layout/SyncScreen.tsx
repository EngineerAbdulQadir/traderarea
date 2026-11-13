import { CloudOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useApp } from '@/store/AppStore'

function SyncAmbient() {
  return (
    <div className="sync-ambient" aria-hidden="true">
      <span className="sync-orb sync-orb-a" />
      <span className="sync-orb sync-orb-b" />
      <span className="sync-orb sync-orb-c" />
      <span className="sync-mesh" />
    </div>
  )
}

export function SyncError() {
  const { retrySync, syncStatus } = useApp()
  if (syncStatus !== 'error') return null

  return (
    <div className="sync-page">
      <SyncAmbient />

      <div className="sync-shell" role="alert">
        <div className="sync-error-badge" aria-hidden="true">
          <CloudOff size={22} strokeWidth={1.7} />
        </div>

        <h1 className="sync-title">Can&apos;t reach Firebase</h1>
        <p className="sync-copy">
          Your journal is still safe in this browser. Check your connection and the Firestore rules,
          then try again.
        </p>

        <Button
          variant="primary"
          size="md"
          className="sync-retry"
          iconLeft={<RefreshCw size={14} />}
          onClick={retrySync}
        >
          Retry sync
        </Button>

        <p className="sync-note">Nothing has been lost — writes stay queued until the connection returns.</p>
      </div>
    </div>
  )
}