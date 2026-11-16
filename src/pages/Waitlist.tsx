import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react'

import logoDark from '../../assets/logodark.png'
import logoLight from '../../assets/logolight.png'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useWorkspaceAccess } from '@/components/layout/AuthGate'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/store/AuthProvider'
import { isFirebaseConfigured } from '@/lib/firebase'
import {
  joinWaitlist,
  listAllPartnerVerifications,
  listWaitlistEntries,
  reviewCloudPartnerVerification,
  type WaitlistEntry,
} from '@/lib/cloud'
import { formatSize } from '@/lib/format'
import type { PartnerVerificationRequest } from '@/lib/partner'
import { cn } from '@/lib/cn'

type Status = 'idle' | 'loading' | 'success' | 'error'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function WaitlistPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { allowed: isOwnerSignedIn, configured } = useWorkspaceAccess()
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  // Owner-only directory (rendered only when already signed in)
  const [showSignups, setShowSignups] = useState(false)
  const [ownerTab, setOwnerTab] = useState<'waitlist' | 'verifications'>('waitlist')
  const [signups, setSignups] = useState<WaitlistEntry[]>([])
  const [verifications, setVerifications] = useState<PartnerVerificationRequest[]>([])
  const [signupsLoading, setSignupsLoading] = useState(false)
  const [signupsError, setSignupsError] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const submitWaitlist = async (event: FormEvent) => {
    event.preventDefault()
    const value = email.trim().toLowerCase()

    if (!value || !EMAIL_PATTERN.test(value)) {
      setStatus('error')
      setMessage('Enter a valid email address to continue.')
      return
    }

    if (!isFirebaseConfigured) {
      setStatus('error')
      setMessage('Waitlist storage is not connected in this preview build.')
      return
    }

    setStatus('loading')
    setMessage('')
    try {
      await joinWaitlist(value)
      setSubmittedEmail(value)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    }
  }

  useEffect(() => {
    if (!showSignups || !isOwnerSignedIn || !configured) return
    let cancelled = false
    setSignupsLoading(true)
    setSignupsError('')
    Promise.all([listWaitlistEntries(), listAllPartnerVerifications()])
      .then(([waitlistItems, verificationItems]) => {
        if (cancelled) return
        setSignups(waitlistItems)
        setVerifications(verificationItems)
      })
      .catch((error) => {
        if (!cancelled) {
          setSignupsError(error instanceof Error ? error.message : 'Failed to load owner records.')
        }
      })
      .finally(() => {
        if (!cancelled) setSignupsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showSignups, isOwnerSignedIn, configured])

  const handleReviewVerification = async (id: string, nextStatus: 'approved' | 'rejected') => {
    setReviewingId(id)
    try {
      const reviewer = user?.email ?? 'owner'
      await reviewCloudPartnerVerification(id, nextStatus, reviewer)
      setVerifications((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, status: nextStatus, reviewedAt: new Date().toISOString(), reviewedBy: reviewer }
            : item,
        ),
      )
    } catch (error) {
      setSignupsError(error instanceof Error ? error.message : 'Failed to update verification.')
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="wl-page">
      <div className="wl-grid-bg" aria-hidden="true" />
      <div className="wl-glow" aria-hidden="true" />

      <header className="wl-topbar">
        <div className="wl-brand">
          <img
            className="wl-logo"
            src={isDark ? logoDark : logoLight}
            alt="Traders Area"
            draggable={false}
          />
        </div>

        <div className="wl-topbar-right">
          {isOwnerSignedIn && (
            <button
              type="button"
              className="wl-workspace-btn"
              onClick={() => navigate('/metrics')}
            >
              <span>Open Workspace</span>
              <ArrowRight size={14} />
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="wl-stage">
        <section className="wl-card" aria-labelledby="wl-heading">
          <div className="wl-card-edge" aria-hidden="true" />

          <p className="wl-kicker">Waitlist</p>

          <h1 id="wl-heading" className="wl-title">
            A modern trading journal built for serious traders.
          </h1>

          {status === 'success' ? (
            <div className="wl-success" role="status" aria-live="polite">
              <div className="wl-success-head">
                <span className="wl-success-icon" aria-hidden="true">
                  <Check size={16} strokeWidth={2.4} />
                </span>
                <div className="wl-success-titles">
                  <p className="wl-success-title">You&apos;re on the waitlist</p>
                  <p className="wl-success-kicker">Early access spot reserved</p>
                </div>
              </div>

              <p className="wl-success-desc">
                We&apos;ve registered <span className="wl-mono">{submittedEmail}</span> and will
                email you as soon as access opens.
              </p>

              <div className="wl-success-foot">
                <button
                  type="button"
                  className="wl-success-reset"
                  onClick={() => {
                    setStatus('idle')
                    setEmail('')
                    setMessage('')
                  }}
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <form className="wl-form" onSubmit={submitWaitlist} noValidate>
              <label className="wl-input-wrap">
                <span className="sr-only">Email address</span>
                <Mail size={15} className="wl-input-icon" aria-hidden="true" />
                <input
                  className="wl-input"
                  type="email"
                  name="email"
                  placeholder="you@domain.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (status === 'error') {
                      setStatus('idle')
                      setMessage('')
                    }
                  }}
                  disabled={status === 'loading'}
                  required
                />
              </label>

              <button className="wl-submit" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? (
                  <>
                    <Loader2 size={15} className="wl-spin" />
                    <span>Joining</span>
                  </>
                ) : (
                  <>
                    <span>Join waitlist</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {status === 'error' && message && (
            <p className="wl-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{message}</span>
            </p>
          )}
        </section>

        {isOwnerSignedIn && configured && (
          <section className="wl-owner-panel" aria-label="Owner console">
            <div className="wl-owner-head">
              <div className="wl-owner-title">
                <ShieldCheck size={15} />
                <span>Owner Console · Directory &amp; Verifications</span>
              </div>
              <button
                type="button"
                className="wl-owner-toggle"
                onClick={() => setShowSignups((value) => !value)}
              >
                <Users size={14} />
                <span>{showSignups ? 'Hide records' : 'View records'}</span>
                <ChevronRight
                  size={14}
                  className={cn('wl-owner-chevron', showSignups && 'is-open')}
                />
              </button>
            </div>

            {showSignups && (
              <div className="wl-owner-body">
                <div className="wl-owner-tabs" role="tablist" aria-label="Owner console sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={ownerTab === 'waitlist'}
                    className={cn('wl-owner-tab', ownerTab === 'waitlist' && 'is-active')}
                    onClick={() => setOwnerTab('waitlist')}
                  >
                    Waitlist ({signups.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={ownerTab === 'verifications'}
                    className={cn('wl-owner-tab', ownerTab === 'verifications' && 'is-active')}
                    onClick={() => setOwnerTab('verifications')}
                  >
                    Partner Verifications ({verifications.length})
                  </button>
                </div>

                {signupsLoading ? (
                  <p className="wl-owner-empty">Loading records…</p>
                ) : signupsError ? (
                  <p className="wl-owner-error">{signupsError}</p>
                ) : ownerTab === 'waitlist' ? (
                  signups.length === 0 ? (
                    <p className="wl-owner-empty">No waitlist signups recorded yet.</p>
                  ) : (
                    <div className="wl-owner-table-wrap">
                      <table className="wl-owner-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Joined</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {signups.map((entry) => (
                            <tr key={entry.email}>
                              <td className="wl-mono">{entry.email}</td>
                              <td className="num">
                                {entry.createdAt
                                  ? new Date(entry.createdAt).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : '—'}
                              </td>
                              <td>{entry.source ?? 'web'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : verifications.length === 0 ? (
                  <p className="wl-owner-empty">No Eze Funded partner verifications submitted yet.</p>
                ) : (
                  <div className="wl-owner-table-wrap">
                    <table className="wl-owner-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Order ID</th>
                          <th>Eze email</th>
                          <th>Size</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verifications.map((item) => (
                          <tr key={item.id}>
                            <td className="wl-mono">{item.userEmail || '—'}</td>
                            <td className="wl-mono">{item.orderId}</td>
                            <td className="wl-mono">{item.ezeEmail}</td>
                            <td className="num">{formatSize(item.challengeSize)}</td>
                            <td>{item.status}</td>
                            <td>
                              <div className="wl-owner-actions">
                                {item.status !== 'approved' && (
                                  <button
                                    type="button"
                                    className="wl-owner-action is-approve"
                                    disabled={reviewingId === item.id}
                                    onClick={() => handleReviewVerification(item.id, 'approved')}
                                  >
                                    Approve +1
                                  </button>
                                )}
                                {item.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    className="wl-owner-action"
                                    disabled={reviewingId === item.id}
                                    onClick={() => handleReviewVerification(item.id, 'rejected')}
                                  >
                                    Decline
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="wl-footer">
        <span>© 2026 Traders Area</span>
      </footer>
    </div>
  )
}