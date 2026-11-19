import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react'
import logoDark from '../../assets/logodark.png'
import logoLight from '../../assets/logolight.png'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented, type SegmentOption } from '@/components/ui/Segmented'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useTheme } from '@/hooks/useTheme'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import {
  hasDevOwnerSession,
  isAuthorizedOwner,
  isWaitlistOnly,
  ownerLoginPath,
} from '@/lib/access'
import { isFirebaseConfigured } from '@/lib/firebase'
import {
  listAllPartnerVerifications,
  listWaitlistEntries,
  type WaitlistEntry,
} from '@/lib/cloud'
import {
  EZE_PARTNER_CODE,
  EZE_PARTNER_URL,
  FREE_ACCOUNT_SLOTS,
  type PartnerVerificationRequest,
} from '@/lib/partner'
import { cn } from '@/lib/cn'

type AdminTab = 'verifications' | 'waitlist' | 'controls'
type VerificationFilter = 'all' | 'pending' | 'approved' | 'rejected'

const TAB_OPTIONS: SegmentOption<AdminTab>[] = [
  { value: 'verifications', label: 'Partner Verifications' },
  { value: 'waitlist', label: 'Waitlist Signups' },
  { value: 'controls', label: 'Access & Controls' },
]

const STATUS_FILTERS: SegmentOption<VerificationFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
]

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusLabel(status: PartnerVerificationRequest['status']): string {
  if (status === 'approved') return 'Approved · +1'
  if (status === 'rejected') return 'Declined'
  return 'Pending'
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user } = useAuth()
  const { partnerVerifications, reviewPartnerVerification, showToast } = useApp()

  const isAdmin = isAuthorizedOwner(user) || hasDevOwnerSession()

  const [tab, setTab] = useState<AdminTab>('verifications')
  const [statusFilter, setStatusFilter] = useState<VerificationFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [waitlistSearch, setWaitlistSearch] = useState('')

  const [cloudVerifications, setCloudVerifications] = useState<PartnerVerificationRequest[]>([])
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<'partner' | 'admin' | null>(null)

  const loadAdminRecords = useCallback(async () => {
    if (!isAdmin) return
    if (!isFirebaseConfigured) {
      setCloudVerifications(partnerVerifications)
      setWaitlistEntries([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const [verificationsData, waitlistData] = await Promise.all([
        listAllPartnerVerifications(),
        listWaitlistEntries(),
      ])
      setCloudVerifications(verificationsData)
      setWaitlistEntries(waitlistData)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load admin records.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, partnerVerifications])

  useEffect(() => {
    loadAdminRecords()
  }, [loadAdminRecords])

  const verifications = useMemo(
    () => (isFirebaseConfigured ? cloudVerifications : partnerVerifications),
    [cloudVerifications, partnerVerifications],
  )

  const counts = useMemo(() => {
    let pending = 0
    let approved = 0
    let rejected = 0
    verifications.forEach((item) => {
      if (item.status === 'pending') pending += 1
      else if (item.status === 'approved') approved += 1
      else if (item.status === 'rejected') rejected += 1
    })
    return {
      pending,
      approved,
      rejected,
      total: verifications.length,
      waitlist: waitlistEntries.length,
    }
  }, [verifications, waitlistEntries.length])

  const filteredVerifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return verifications.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!q) return true
      const haystack = `${item.orderId} ${item.userEmail} ${item.ezeEmail}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [verifications, statusFilter, searchQuery])

  const filteredWaitlist = useMemo(() => {
    const q = waitlistSearch.trim().toLowerCase()
    if (!q) return waitlistEntries
    return waitlistEntries.filter(
      (entry) =>
        entry.email.toLowerCase().includes(q) ||
        (entry.source ?? 'web').toLowerCase().includes(q),
    )
  }, [waitlistEntries, waitlistSearch])

  if (!isAdmin) {
    return <Navigate to="/metrics" replace />
  }

  const handleReview = async (id: string, nextStatus: 'approved' | 'rejected') => {
    setReviewingId(id)
    try {
      await reviewPartnerVerification(id, nextStatus)
      const reviewer = user?.email ?? 'admin'
      const nowIso = new Date().toISOString()
      setCloudVerifications((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, status: nextStatus, reviewedAt: nowIso, reviewedBy: reviewer }
            : item,
        ),
      )
      showToast(
        nextStatus === 'approved' ? 'Slot unlocked' : 'Request declined',
        nextStatus === 'approved'
          ? 'Approved Eze Funded partner order (+1 account slot).'
          : 'Verification request marked as declined.',
        nextStatus === 'approved' ? 'success' : 'info',
      )
    } catch (error) {
      showToast(
        'Review failed',
        error instanceof Error ? error.message : 'Could not update verification status.',
        'error',
      )
    } finally {
      setReviewingId(null)
    }
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

  const handleCopy = async (kind: 'partner' | 'admin', value: string, toastTitle: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(kind)
      showToast(toastTitle, value, 'info')
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      showToast('Copy unavailable', value, 'info')
    }
  }

  const fullAdminUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${ownerLoginPath}` : ownerLoginPath

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
          <span className="admin-topbar-label">Admin</span>
        </div>

        <div className="admin-topbar-right">
          <Button variant="ghost" size="sm" onClick={() => navigate('/metrics')}>
            <ArrowLeft size={14} />
            <span>Back to app</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/waitlist')}>
            <ExternalLink size={14} />
            <span>Waitlist</span>
          </Button>
          <Button variant="secondary" size="sm" loading={loading} onClick={loadAdminRecords}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-head">
          <div className="admin-head-copy">
            <span className="page-kicker">Administration</span>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">
              Manage Eze Funded partner verifications, waitlist records, and workspace controls.
            </p>
          </div>
        </div>

        <section className="admin-kpi-strip num" aria-label="Admin metrics overview">
          <div className="admin-kpi-cell">
            <span className="admin-kpi-label">Pending reviews</span>
            <strong className={cn('admin-kpi-value', counts.pending > 0 && 'is-warn')}>
              {counts.pending}
            </strong>
            <span className="admin-kpi-meta">Awaiting order match</span>
          </div>
          <div className="admin-kpi-cell">
            <span className="admin-kpi-label">Approved unlocks</span>
            <strong className="admin-kpi-value is-pos">{counts.approved}</strong>
            <span className="admin-kpi-meta">+1 slot granted each</span>
          </div>
          <div className="admin-kpi-cell">
            <span className="admin-kpi-label">Declined</span>
            <strong className="admin-kpi-value">{counts.rejected}</strong>
            <span className="admin-kpi-meta">Unmatched or invalid</span>
          </div>
          <div className="admin-kpi-cell">
            <span className="admin-kpi-label">Waitlist signups</span>
            <strong className="admin-kpi-value">{counts.waitlist}</strong>
            <span className="admin-kpi-meta">
              {isFirebaseConfigured ? 'Synced from Firestore' : 'Local preview mode'}
            </span>
          </div>
        </section>

        <div className="admin-nav-bar">
          <Segmented
            value={tab}
            options={TAB_OPTIONS}
            onChange={setTab}
            label="Admin dashboard sections"
          />
        </div>

        {loadError && (
          <div className="admin-alert" role="alert">
            <span>{loadError}</span>
            <Button variant="ghost" size="sm" onClick={loadAdminRecords}>
              Retry
            </Button>
          </div>
        )}

        {tab === 'verifications' && (
          <section className="admin-surface" aria-label="Partner verification queue">
            <div className="admin-toolbar">
              <label className="admin-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search order ID, user email, or Eze email…"
                  aria-label="Search partner verification requests"
                />
              </label>

              <Segmented
                size="sm"
                value={statusFilter}
                options={STATUS_FILTERS}
                onChange={setStatusFilter}
                label="Filter verifications by status"
              />
            </div>

            {loading && verifications.length === 0 ? (
              <div className="admin-loading">Loading partner verification queue…</div>
            ) : filteredVerifications.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={20} />}
                title={
                  verifications.length === 0
                    ? 'No verification requests yet'
                    : 'No matching verification requests'
                }
                description={
                  verifications.length === 0
                    ? 'When traders submit their Eze Funded order ID and email in Plans & Access, requests appear here.'
                    : 'Try clearing the search query or switching the status filter.'
                }
                actions={
                  (searchQuery || statusFilter !== 'all') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('')
                        setStatusFilter('all')
                      }}
                    >
                      Reset filters
                    </Button>
                  )
                }
              />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Account email</th>
                      <th>Eze email</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVerifications.map((item) => (
                      <tr key={item.id}>
                        <td className="num admin-mono">{item.orderId}</td>
                        <td>{item.userEmail || '—'}</td>
                        <td>{item.ezeEmail}</td>
                        <td className="num">{formatDate(item.createdAt)}</td>
                        <td>
                          <span className={cn('plans-status', `is-${item.status}`)}>
                            {item.status === 'approved' ? (
                              <CheckCircle2 size={12} aria-hidden="true" />
                            ) : item.status === 'rejected' ? (
                              <XCircle size={12} aria-hidden="true" />
                            ) : (
                              <Clock3 size={12} aria-hidden="true" />
                            )}
                            <span>{statusLabel(item.status)}</span>
                          </span>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            {item.status !== 'approved' && (
                              <Button
                                variant="primary"
                                size="sm"
                                loading={reviewingId === item.id}
                                onClick={() => handleReview(item.id, 'approved')}
                              >
                                Approve +1
                              </Button>
                            )}
                            {item.status !== 'rejected' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={reviewingId === item.id}
                                onClick={() => handleReview(item.id, 'rejected')}
                              >
                                Decline
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'waitlist' && (
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
        )}

        {tab === 'controls' && (
          <section className="admin-controls-grid" aria-label="Workspace access and controls">
            <div className="admin-control-panel">
              <div className="admin-control-head">
                <h3>Access &amp; Gate Configuration</h3>
                <p>Current runtime settings governing public registration and account slots.</p>
              </div>

              <dl className="admin-spec-list">
                <div className="admin-spec-row">
                  <dt>Public access gate</dt>
                  <dd>{isWaitlistOnly ? 'Waitlist-only mode' : 'Open registration'}</dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Free slot allowance</dt>
                  <dd className="num">{FREE_ACCOUNT_SLOTS} account per trader</dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Partner unlock reward</dt>
                  <dd className="num">+1 slot per approved Eze order</dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Storage backend</dt>
                  <dd>{isFirebaseConfigured ? 'Firebase Cloud (Firestore)' : 'Local browser'}</dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Active admin session</dt>
                  <dd className="admin-mono">{user?.email ?? 'Local dev admin'}</dd>
                </div>
              </dl>
            </div>

            <div className="admin-control-panel">
              <div className="admin-control-head">
                <h3>Partner &amp; Admin Links</h3>
                <p>Shareable partner checkout URL and private admin sign-in route.</p>
              </div>

              <div className="admin-link-stack">
                <div className="admin-link-item">
                  <div className="admin-link-meta">
                    <span>Eze Funded partner link</span>
                    <strong className="num">Code: {EZE_PARTNER_CODE}</strong>
                  </div>
                  <div className="plan-partner-url-row">
                    <code className="plan-partner-url">{EZE_PARTNER_URL}</code>
                    <button
                      type="button"
                      className="plan-copy-btn"
                      onClick={() => handleCopy('partner', EZE_PARTNER_URL, 'Partner link copied')}
                    >
                      {copiedKey === 'partner' ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey === 'partner' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="admin-link-item">
                  <div className="admin-link-meta">
                    <span>Private admin login URL</span>
                    <strong className="admin-mono">{ownerLoginPath}</strong>
                  </div>
                  <div className="plan-partner-url-row">
                    <code className="plan-partner-url">{fullAdminUrl}</code>
                    <button
                      type="button"
                      className="plan-copy-btn"
                      onClick={() => handleCopy('admin', fullAdminUrl, 'Admin login route copied')}
                    >
                      {copiedKey === 'admin' ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey === 'admin' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
