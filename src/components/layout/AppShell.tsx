import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  LogOut,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import logoDark from '../../../assets/logodark.png'
import logoLight from '../../../assets/logolight.png'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { readStorage, writeStorage } from '@/lib/storage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTheme } from '@/hooks/useTheme'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import { clearOwnerSessions, isWaitlistOnly } from '@/lib/access'
import { cn } from '@/lib/cn'
import { SyncError } from './SyncScreen'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function TrialExpiredGate() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { user, signOut, configured } = useAuth()
  const {
    accessPolicy,
    partnerSummary,
    partnerVerifications,
    submitPartnerVerification,
    showToast,
  } = useApp()

  const [ezeEmail, setEzeEmail] = useState(user?.email ?? '')
  const [orderId, setOrderId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState(false)

  const latest = partnerSummary.latestVerification

  const copyPartnerLink = async () => {
    try {
      await navigator.clipboard.writeText(accessPolicy.partnerUrl)
      setCopied(true)
      showToast('Partner link copied', 'Use this link at checkout on Eze Funded.', 'info')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      showToast('Copy unavailable', accessPolicy.partnerUrl, 'info')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanEmail = ezeEmail.trim().toLowerCase()
    const cleanOrder = orderId.trim()
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setFormError('Enter the email address used on your Eze Funded account.')
      return
    }
    if (cleanOrder.length < 2) {
      setFormError('Enter your Eze Funded order ID or receipt reference.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      await submitPartnerVerification({ ezeEmail: cleanEmail, orderId: cleanOrder })
      setOrderId('')
      showToast(
        'Verification submitted',
        'Your order is queued for review. Lifetime journal access unlocks once confirmed.',
      )
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to submit verification.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="trial-gate">
      <header className="trial-gate-top">
        <img
          className="admin-logo"
          src={isDark ? logoDark : logoLight}
          alt="Traders Area"
          draggable={false}
        />
        <div className="trial-gate-top-actions">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              clearOwnerSessions()
              if (configured) {
                try {
                  await signOut()
                } catch {
                  // Navigate regardless of transient signOut errors.
                }
              }
              navigate(isWaitlistOnly ? '/waitlist' : '/auth/login')
            }}
          >
            <LogOut size={14} />
            <span>Log out</span>
          </Button>
        </div>
      </header>

      <main className="trial-gate-main">
        <section className="trial-gate-shell" aria-labelledby="trial-gate-title">
          <div className="trial-gate-head">
            <div className="trial-gate-meta">
              <span className="page-kicker">
                {partnerSummary.pendingCount > 0 ? 'Verification Under Review' : 'Free trial ended'}
              </span>
              <span className="trial-gate-dates num">
                {formatShortDate(partnerSummary.trialStartedAt)} →{' '}
                {formatShortDate(partnerSummary.trialEndsAt)}
              </span>
            </div>
            <h1 id="trial-gate-title" className="trial-gate-title">
              {partnerSummary.pendingCount > 0
                ? 'Your order is queued for review'
                : 'Unlock lifetime access to your journal'}
            </h1>
            <p className="trial-gate-sub">
              {partnerSummary.pendingCount > 0
                ? `We received your verification request (${latest?.orderId ?? ''}). Your accounts, trades, and notes are safely preserved and unlock for lifetime access once confirmed.`
                : `Your ${partnerSummary.freeTrialDays}-day free access window has finished. Purchase any challenge through our Eze Funded affiliate link and submit verification to unlock Traders Area for life.`}
            </p>
          </div>

          <div className="plans-layout trial-gate-layout">
            <div className="plans-main-col">
              {partnerSummary.pendingCount > 0 && latest && (
                <div className="plans-notice is-warn" role="status">
                  <span className="plans-notice-icon" aria-hidden="true">
                    <Clock3 size={16} />
                  </span>
                  <div className="plans-notice-copy">
                    <b>Order {latest.orderId} is awaiting confirmation</b>
                    <span>
                      Eze Funded email: {latest.ezeEmail} · Submitted{' '}
                      {formatShortDate(latest.createdAt)}
                    </span>
                  </div>
                </div>
              )}

              {partnerSummary.pendingCount === 0 && latest?.status === 'rejected' && (
                <div className="plans-notice is-neg" role="status">
                  <span className="plans-notice-icon" aria-hidden="true">
                    <AlertCircle size={16} />
                  </span>
                  <div className="plans-notice-copy">
                    <b>Previous order ({latest.orderId}) was declined</b>
                    <span>
                      {latest.note
                        ? `${latest.note} — Verify your receipt details and resubmit below.`
                        : 'Confirm your Eze Funded checkout email and order ID, then resubmit below.'}
                    </span>
                  </div>
                </div>
              )}

              <div className="plans-steps">
                <section className="plans-step">
                  <div className="plans-step-head">
                    <span className="plans-step-num num">01</span>
                    <div className="plans-step-copy">
                      <div className="plans-verify-head">
                        <h3>Buy any account via Eze Funded link</h3>
                        <span className="plans-code-chip num">
                          Code: {accessPolicy.partnerCode}
                        </span>
                      </div>
                      <p>Checkout through our affiliate link to qualify for $0 lifetime access.</p>
                    </div>
                  </div>
                  <div className="plans-step-link-row">
                    <div className="plan-partner-url-row">
                      <code className="plan-partner-url">{accessPolicy.partnerUrl}</code>
                      <button
                        type="button"
                        className="plan-copy-btn"
                        onClick={copyPartnerLink}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <a
                      href={accessPolicy.partnerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm plans-open-partner"
                    >
                      <span>Open Eze Funded</span>
                      <ArrowUpRight size={14} />
                    </a>
                  </div>
                </section>

                <section className="plans-step">
                  <div className="plans-step-head">
                    <span className="plans-step-num num">02</span>
                    <div className="plans-step-copy">
                      <div className="plans-verify-head">
                        <h3>Submit order verification</h3>
                        {partnerSummary.pendingCount > 0 && (
                          <span className="plans-pending-note num">
                            {partnerSummary.pendingCount} pending review
                          </span>
                        )}
                      </div>
                      <p>Enter your Eze Funded receipt email and order ID to unlock lifetime.</p>
                    </div>
                  </div>

                  <form className="plans-verify-form" onSubmit={handleSubmit} noValidate>
                    <div className="plans-verify-fields">
                      <label className="field">
                        <span className="field-label">Eze Funded email</span>
                        <input
                          className="input"
                          type="email"
                          placeholder="trader@domain.com"
                          value={ezeEmail}
                          onChange={(event) => {
                            setEzeEmail(event.target.value)
                            if (formError) setFormError('')
                          }}
                          disabled={submitting}
                          required
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">Order ID / Receipt #</span>
                        <input
                          className="input num"
                          type="text"
                          maxLength={120}
                          placeholder="e.g. EZE-48291"
                          value={orderId}
                          onChange={(event) => {
                            setOrderId(event.target.value)
                            if (formError) setFormError('')
                          }}
                          disabled={submitting}
                          required
                        />
                      </label>
                    </div>

                    {formError && (
                      <p className="plans-form-error" role="alert">
                        <AlertCircle size={13} aria-hidden="true" />
                        <span>{formError}</span>
                      </p>
                    )}

                    <div className="plans-verify-actions">
                      <span className="plans-disclosure">
                        Signed in as {user?.email ?? 'trader'}. Your journal data is safely saved.
                      </span>
                      <Button type="submit" variant="primary" size="sm" loading={submitting}>
                        Submit verification
                      </Button>
                    </div>
                  </form>
                </section>
              </div>
            </div>

            <aside className="plans-ledger-col" aria-label="Account summary">
              <div className="plans-ledger-head">
                <span className="plans-ledger-kicker">Account Standing</span>
                <div className="plans-ledger-title-row">
                  <strong
                    className={cn(
                      'plans-ledger-title',
                      partnerSummary.pendingCount > 0 ? 'is-warn' : 'is-neg',
                    )}
                  >
                    {partnerSummary.pendingCount > 0 ? 'Pending Review' : 'Trial Ended'}
                  </strong>
                  <ShieldCheck size={16} className="plans-ledger-shield" aria-hidden="true" />
                </div>
                <div className="plans-ledger-meter">
                  <div className="plans-ledger-track">
                    <i
                      className={partnerSummary.pendingCount > 0 ? 'is-warn' : 'is-neg'}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="plans-ledger-meter-meta num">
                    <span>0 days left in free trial</span>
                    <span>{partnerSummary.usedSlots} slots saved</span>
                  </div>
                </div>
              </div>

              <div className="plans-rail">
                <div className="plans-rail-step is-done">
                  <span className="plans-rail-node num">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <div className="plans-rail-copy">
                    <b>{partnerSummary.freeTrialDays}-Day Free Trial</b>
                    <span>Completed · Data preserved</span>
                  </div>
                </div>
                <div
                  className={cn(
                    'plans-rail-step',
                    partnerSummary.pendingCount > 0 ? 'is-current' : 'is-current',
                  )}
                >
                  <span className="plans-rail-node num">02</span>
                  <div className="plans-rail-copy">
                    <b>Eze Funded Order</b>
                    <span>
                      {partnerSummary.pendingCount > 0
                        ? `Order ${latest?.orderId ?? ''} reviewing`
                        : 'Awaiting order verification'}
                    </span>
                  </div>
                </div>
                <div className="plans-rail-step">
                  <span className="plans-rail-node num">03</span>
                  <div className="plans-rail-copy">
                    <b>Lifetime Journal</b>
                    <span>Unlocks workspace + 1 slot</span>
                  </div>
                </div>
              </div>

              <dl className="plans-ledger-specs">
                <div className="plans-ledger-row">
                  <dt>Trial started</dt>
                  <dd className="num">{formatShortDate(partnerSummary.trialStartedAt)}</dd>
                </div>
                <div className="plans-ledger-row">
                  <dt>Trial ended</dt>
                  <dd className="num">{formatShortDate(partnerSummary.trialEndsAt)}</dd>
                </div>
                <div className="plans-ledger-row">
                  <dt>Saved accounts</dt>
                  <dd className="num">{partnerSummary.realAccountsCount} preserved</dd>
                </div>
              </dl>
            </aside>
          </div>

          {partnerVerifications.length > 0 && (
            <div className="plans-history">
              <div className="plans-history-head">
                <span>Your verification requests</span>
                <span className="num">{partnerVerifications.length} total</span>
              </div>
              <div className="plans-history-table-wrap">
                <table className="plans-history-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Eze email</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerVerifications.map((item) => (
                      <tr key={item.id}>
                        <td className="num">{item.orderId}</td>
                        <td>{item.ezeEmail}</td>
                        <td>
                          <span className={cn('plans-status', `is-${item.status}`)}>
                            {item.status === 'approved' ? (
                              <CheckCircle2 size={12} aria-hidden="true" />
                            ) : item.status === 'rejected' ? (
                              <XCircle size={12} aria-hidden="true" />
                            ) : (
                              <Clock3 size={12} aria-hidden="true" />
                            )}
                            <span>
                              {item.status === 'approved'
                                ? 'Approved · Lifetime'
                                : item.status === 'rejected'
                                  ? 'Declined'
                                  : 'Pending review'}
                            </span>
                          </span>
                        </td>
                        <td className="plans-history-note">
                          {item.note || (item.status === 'pending' ? 'Queued for admin' : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export function AppShell() {
  const { syncStatus, partnerSummary } = useApp()
  const [collapsed, setCollapsed] = useState(() => {
    const stored = readStorage('ta-ui-sidebar-collapsed', '')
    if (stored) return stored === '1'
    return readStorage('ta-sidebar-collapsed', '0') === '1'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const outlet = useOutlet()
  const isMobile = useMediaQuery('(max-width: 900px)')

  useEffect(() => {
    writeStorage('ta-ui-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  if (syncStatus === 'error') return <SyncError />

  if (!partnerSummary.canUseJournal) return <TrialExpiredGate />

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <main className="main-column">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <div className="content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
