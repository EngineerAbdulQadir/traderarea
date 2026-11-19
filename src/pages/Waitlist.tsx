import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Mail,
  SlidersHorizontal,
} from 'lucide-react'

import logoDark from '../../assets/logodark.png'
import logoLight from '../../assets/logolight.png'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useWorkspaceAccess } from '@/components/layout/AuthGate'
import { useTheme } from '@/hooks/useTheme'
import { isFirebaseConfigured } from '@/lib/firebase'
import { joinWaitlist } from '@/lib/cloud'

type Status = 'idle' | 'loading' | 'success' | 'error'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function WaitlistPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { allowed: isOwnerSignedIn } = useWorkspaceAccess()

  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

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
            <>
              <button
                type="button"
                className="wl-workspace-btn"
                onClick={() => navigate('/admin')}
              >
                <SlidersHorizontal size={14} />
                <span>Admin Dashboard</span>
              </button>
              <button
                type="button"
                className="wl-workspace-btn"
                onClick={() => navigate('/metrics')}
              >
                <span>Open Workspace</span>
                <ArrowRight size={14} />
              </button>
            </>
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
      </main>

      <footer className="wl-footer">
        <span>© 2026 Traders Area</span>
      </footer>
    </div>
  )
}