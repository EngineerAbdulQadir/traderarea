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
import { isFirebaseConfigured } from '@/lib/firebase'
import { joinWaitlist, listWaitlistEntries, type WaitlistEntry } from '@/lib/cloud'
import { cn } from '@/lib/cn'

type Status = 'idle' | 'loading' | 'success' | 'error'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function WaitlistPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { allowed: isOwnerSignedIn, configured } = useWorkspaceAccess()

  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  // Owner-only waitlist directory (rendered only when already signed in)
  const [showSignups, setShowSignups] = useState(false)
  const [signups, setSignups] = useState<WaitlistEntry[]>([])
  const [signupsLoading, setSignupsLoading] = useState(false)
  const [signupsError, setSignupsError] = useState('')

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
    listWaitlistEntries()
      .then((entries) => {
        if (!cancelled) setSignups(entries)
      })
      .catch((error) => {
        if (!cancelled) {
          setSignupsError(error instanceof Error ? error.message : 'Failed to load waitlist entries.')
        }
      })
      .finally(() => {
        if (!cancelled) setSignupsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showSignups, isOwnerSignedIn, configured])

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

          <p className="wl-subtitle">
            Log your trades, review your performance, and track your edge in one clean workspace,
            built to take you from a retail trader to an HNI.
          </p>

          {status === 'success' ? (
            <div className="wl-success" role="status">
              <span className="wl-success-icon" aria-hidden="true">
                <Check size={16} strokeWidth={2.3} />
              </span>
              <div className="wl-success-copy">
                <p className="wl-success-title">You&apos;re on the waitlist.</p>
                <p className="wl-success-desc">
                  Reserved for <span className="wl-mono">{submittedEmail}</span>. We&apos;ll email
                  you when access opens.
                </p>
              </div>
              <button
                type="button"
                className="wl-success-reset"
                onClick={() => {
                  setStatus('idle')
                  setEmail('')
                  setMessage('')
                }}
              >
                Add another
              </button>
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
          <section className="wl-owner-panel" aria-label="Owner waitlist signups">
            <div className="wl-owner-head">
              <div className="wl-owner-title">
                <ShieldCheck size={15} />
                <span>Owner Console · Waitlist Directory</span>
              </div>
              <button
                type="button"
                className="wl-owner-toggle"
                onClick={() => setShowSignups((value) => !value)}
              >
                <Users size={14} />
                <span>{showSignups ? 'Hide signups' : 'View signups'}</span>
                <ChevronRight
                  size={14}
                  className={cn('wl-owner-chevron', showSignups && 'is-open')}
                />
              </button>
            </div>

            {showSignups && (
              <div className="wl-owner-body">
                {signupsLoading ? (
                  <p className="wl-owner-empty">Loading signups…</p>
                ) : signupsError ? (
                  <p className="wl-owner-error">{signupsError}</p>
                ) : signups.length === 0 ? (
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