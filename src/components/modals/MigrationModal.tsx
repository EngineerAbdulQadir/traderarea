import { CloudUpload, Download, HardDrive } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useApp } from '@/store/AppStore'
import { exportWorkspaceBackup } from '@/lib/backup'

/**
 * Shown once per account when this browser already holds a journal but the
 * signed-in Firebase account is empty.
 */
export function MigrationModal() {
  const { syncStatus, migrating, migrateWorkspace, skipMigration, accounts, storedTradeCount } =
    useApp()
  const open = syncStatus === 'migration'

  return (
    <Modal
      open={open}
      onClose={skipMigration}
      closeOnBackdrop={false}
      size="sm"
      labelledBy="migration-title"
    >
      <div className="migration-panel">
        <div className="migration-head">
          <div className="migration-heading">
            <span className="migration-eyebrow">Cloud migration</span>
            <h2 id="migration-title">Bring your journal to the cloud</h2>
          </div>
        </div>

        <p className="migration-sub">
          This browser already has a workspace. Upload it once and your journal follows you to
          every device.
        </p>

        <div className="migration-stats">
          <div className="migration-stat">
            <b>{accounts.length}</b>
            <span>Account{accounts.length === 1 ? '' : 's'}</span>
          </div>
          <div className="migration-stat">
            <b>{storedTradeCount}</b>
            <span>Trade{storedTradeCount === 1 ? '' : 's'}</span>
          </div>
          <div className="migration-stat is-accent">
            <b>Firebase</b>
            <span>Destination</span>
          </div>
        </div>

        <div className="migration-actions">
          <Button
            variant="primary"
            loading={migrating}
            iconLeft={<CloudUpload size={15} />}
            onClick={migrateWorkspace}
          >
            Upload my workspace
          </Button>
          <Button
            variant="secondary"
            iconLeft={<HardDrive size={15} />}
            onClick={skipMigration}
            disabled={migrating}
          >
            Skip and start empty
          </Button>
        </div>

        <button type="button" className="migration-link" onClick={exportWorkspaceBackup} disabled={migrating}>
          <Download size={13} strokeWidth={1.9} />
          Download a backup first
        </button>
      </div>
    </Modal>
  )
}
