import { STORAGE_KEYS } from '@/lib/persistence'

/** Keys included in a downloaded workspace backup. */
export const BACKUP_KEYS = [
  STORAGE_KEYS.accounts,
  STORAGE_KEYS.trades,
  STORAGE_KEYS.notes,
  STORAGE_KEYS.activeAccount,
  'ta-profile',
]

/** Download the current workspace as a JSON file. */
export function exportWorkspaceBackup(): void {
  const data: Record<string, unknown> = {}
  BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key)
    if (raw === null) return
    try {
      data[key] = JSON.parse(raw) as unknown
    } catch {
      data[key] = raw
    }
  })

  const payload = {
    app: 'Trader Area',
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trader-area-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
