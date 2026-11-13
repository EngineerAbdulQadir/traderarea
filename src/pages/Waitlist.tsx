import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, Loader2, Mail } from 'lucide-react'

import logoDark from '../../assets/logodark.png'
import logoLight from '../../assets/logolight.png'
import { isFirebaseConfigured } from '@/lib/firebase'
import { joinWaitlist } from '@/lib/cloud'
import { useTheme } from '@/hooks/useTheme'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function WaitlistPage() {
  const { isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = email.trim()
    if (!value) return
    if (!isFirebaseConfigured) {
      setStatus('error')
      setMessage('The waitlist is not available in this build.')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      await joinWaitlist(value)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <div className="waitlist-page">
      <div className="waitlist-ambient" aria-hidden="true">
        <span className="waitlist-orb waitlist-orb-a" />
        <span className="waitlist-orb waitlist-orb-b" />
        <span className="waitlist-orb waitlist-orb-c" />
        <span className="waitlist-mesh" />
      </div>

      <div className="waitlist-shell">
        <div className="waitlist-brandrow">
          <img
            className="waitlist-logo"
            src={isDark ? logoDark : logoLight}
            alt="Trader Area"
            draggable={false}
          />
          <span className="waitlist-status" aria-hidden="true">
            <span className="waitlist-status-dot" />
            Building
          </span>
        </div>

        <span className="waitlist-eyebrow">Early access · Private beta</span>

        <h1 className="waitlist-title">Be first in line when Trader Area launches.</h1>

        <p className="waitlist-sub">
          A modern trading journal for serious traders. Join the waitlist and we&apos;ll reach
          out the moment doors open.
        </p>

        {status === 'success' ? (
          <div className="waitlist-success" role="status">
            <span className="waitlist-success-icon" aria-hidden="true">
              <Check size={18} strokeWidth={2.2} />
            </span>
            <div className="waitlist-success-copy">
              <b>You&apos;re on the list.</b>
              <p>We&apos;ll email you before launch. No spam, ever.</p>
            </div>
          </div>
        ) : (
          <form className="waitlist-form" onSubmit={submit} noValidate>
            <div className="waitlist-input-wrap">
              <Mail size={15} className="waitlist-input-icon" aria-hidden="true" />
              <input
                className="waitlist-input"
                type="email"
                name="email"
                placeholder="you@domain.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={status === 'loading'}
                required
              />
            </div>
            <button className="waitlist-submit" type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? (
                <>
                  Joining
                  <Loader2 size={15} className="waitlist-spin" />
                </>
              ) : (
                <>
                  Join waitlist
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p className="waitlist-error" role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}