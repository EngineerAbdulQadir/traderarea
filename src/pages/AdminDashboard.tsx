import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, RefreshCw, Search, Users } from 'lucide-react'
import logoDark from '../../assets/logodark.png'
import logoLight from '../../assets/logolight.png'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useTheme } from '@/hooks/useTheme'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import { hasDevOwnerSession, isAuthorizedOwner } from '@/lib/access'
import { isFirebaseConfigured } from '@/lib/firebase'
import { listWaitlistEntries, type WaitlistEntry } from '@/lib/cloud'
import { cn } from '@/lib/cn'

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user } = useAuth()
  const { showToast } = useApp()

  const isAdmin = isAuthorizedOwner(user) || hasDevOwnerSession()

  const [waitlistSearch, setWaitlistSearch] = useState('')
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const loadWaitlist = useCallback(async () => {
    if (!isAdmin) return
    if (!isFirebaseConfigured) {
      setWaitlistEntries([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const data = await listWaitlistEntries()
      setWaitlistEntries(data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load waitlist entries.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    loadWaitlist()
  }, [loadWaitlist])

  const filteredWaitlist = useMemo(() => {
    const q = waitlistSearch.trim().toLowerCase()
    if (!q) return waitlistEntries
    return waitlistEntries.filter(
      (entry) =>
        entry.email.toLowerCase().includes(q) || (entry.source ?? '').toLowerCase().includes(q),
    )
  }, [waitlistEntries, waitlistSearch])

  if (!isAdmin) {
    return <Navigate to="/metrics" replace />
  }

  const handleExportWaitlist = () => {
    if (!filteredWaitlist.length) return
    const lines = [
      ['Email', 'Joined At', 'Source'].map(csvCell).join(','),
      ...filteredWaitlist.map((entry) =>
        [entry.email, entry.createdAt ?? '', entry.source ?? 'web'].map(csvCell).join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `traders-area-waitlist-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Waitlist exported', `${filteredWaitlist.length} records downloaded as CSV.`, 'success')
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            type="button"
            className="admin-brand-btn"
            onClick={() => navigate('/metrics')}
            aria-label="Return to Traders Area workspace"
          >
            <img
              className="admin-logo"
              src={isDark ? logoDark : logoLight}
              alt="Traders Area"
              draggable={false}
            />
          </button>
          <span className="admin-topbar-divider" aria-hidden="true" />
          <span className="admin-topbar-label">Admin Console</span>
        </div>

        <div className="admin-topbar-right">
          <span
            className={cn('admin-sync-chip', isFirebaseConfigured ? 'is-live' : 'is-local')}
            title={
              isFirebaseConfigured
                ? `Connected to Firebase Firestore (${user?.email ?? 'Admin'})`
                : 'Previewing local device storage'
            }
          >
            <i aria-hidden="true" />
            <span>{isFirebaseConfigured ? 'Firestore Live' : 'Local Mode'}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/metrics')}>
            <ArrowLeft size={14} />
            <span>Back to app</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/waitlist')}>
            <ExternalLink size={14} />
            <span>Waitlist</span>
          </Button>
          <Button variant="secondary" size="sm" loading={loading} onClick={loadWaitlist}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="admin-workspace">
        <main className="admin-canvas">
          {loadError && (
            <div className="admin-alert" role="alert">
              <span>{loadError}</span>
              <Button variant="ghost" size="sm" onClick={loadWaitlist}>
                Retry
              </Button>
            </div>
          )}

          <div className="admin-section-stack">
            <div className="admin-head">
              <div className="admin-head-copy">
                <span className="page-kicker">Directory</span>
                <h1 className="page-title">Waitlist Signups</h1>
                <p className="page-subtitle">
                  Search and export traders registered on the pre-launch waitlist.
                </p>
              </div>
            </div>

            <section className="admin-surface" aria-label="Waitlist signups">
              <div className="admin-toolbar">
                <label className="admin-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={waitlistSearch}
                    onChange={(event) => setWaitlistSearch(event.target.value)}
                    placeholder="Search waitlist emails…"
                    aria-label="Search waitlist signups"
                  />
                </label>

                <div className="admin-toolbar-right">
                  <span className="admin-toolbar-meta num">
                    {filteredWaitlist.length} of {waitlistEntries.length}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={filteredWaitlist.length === 0}
                    onClick={handleExportWaitlist}
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>

              {loading && waitlistEntries.length === 0 ? (
                <div className="admin-loading">Loading waitlist directory…</div>
              ) : filteredWaitlist.length === 0 ? (
                <EmptyState
                  icon={<Users size={20} />}
                  title={
                    !isFirebaseConfigured
                      ? 'Waitlist directory requires Firebase'
                      : waitlistEntries.length === 0
                        ? 'No waitlist signups yet'
                        : 'No matching waitlist emails'
                  }
                  description={
                    !isFirebaseConfigured
                      ? 'Connect Firebase Firestore to inspect and export live waitlist registrations.'
                      : waitlistEntries.length === 0
                        ? 'New waitlist entries submitted on the landing page will list here.'
                        : 'Try adjusting your search query.'
                  }
                />
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Joined</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWaitlist.map((entry) => (
                        <tr key={entry.email}>
                          <td className="admin-mono">{entry.email}</td>
                          <td className="num">{formatDate(entry.createdAt)}</td>
                          <td>{entry.source ?? 'web'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
