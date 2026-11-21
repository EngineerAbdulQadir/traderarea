import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import { hasDevOwnerSession, isAuthorizedOwner } from '@/lib/access'
import type { PartnerVerificationRequest } from '@/lib/partner'
import { cn } from '@/lib/cn'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function statusLabel(status: PartnerVerificationRequest['status']) {
  if (status === 'approved') return 'Approved · Lifetime +1'
  if (status === 'rejected') return 'Declined'
  return 'Pending review'
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function PlansModal() {
  const navigate = useNavigate()
  const {
    plansOpen,
    plansReason,
    closePlans,
    openChallenge,
    partnerSummary,
    accessPolicy,
    partnerVerifications,
    submitPartnerVerification,
    showToast,
  } = useApp()
  const { user } = useAuth()

  const isAdmin = isAuthorizedOwner(user) || hasDevOwnerSession()

  const [ezeEmail, setEzeEmail] = useState('')
  const [orderId, setOrderId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!plansOpen) return
    setFormError('')
    setCopied(false)
    if (!ezeEmail && user?.email) {
      setEzeEmail(user.email)
    }
  }, [plansOpen, user?.email, ezeEmail])

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
      await submitPartnerVerification({
        ezeEmail: cleanEmail,
        orderId: cleanOrder,
      })
      setOrderId('')
      showToast(
        'Verification submitted',
        'Your order is queued for review. Lifetime access and +1 slot unlock once confirmed.',
      )
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to submit verification.')
    } finally {
      setSubmitting(false)
    }
  }

  const latest = partnerSummary.latestVerification

  const accessStatusLabel = partnerSummary.isAdmin
    ? 'Admin · Unlimited'
    : partnerSummary.hasLifetimeAccess
      ? 'Lifetime Active'
      : partnerSummary.trialExpired
        ? 'Trial Ended'
        : `${partnerSummary.daysRemaining}d Free Left`

  const accessStatusTone = partnerSummary.hasLifetimeAccess
    ? 'is-pos'
    : partnerSummary.trialExpired
      ? 'is-neg'
      : 'is-warn'

  const verificationCellText =
    partnerSummary.verifiedSlots > 0
      ? `${partnerSummary.verifiedSlots} approved`
      : partnerSummary.pendingCount > 0
        ? `${partnerSummary.pendingCount} pending review`
        : latest?.status === 'rejected'
          ? 'Last declined'
          : 'None submitted'

  const verificationCellTone =
    partnerSummary.verifiedSlots > 0
      ? 'is-pos'
      : partnerSummary.pendingCount > 0
        ? 'is-warn'
        : latest?.status === 'rejected'
          ? 'is-neg'
          : 'is-muted'

  const step1Done =
    partnerSummary.hasLifetimeAccess ||
    partnerSummary.pendingCount > 0 ||
    partnerSummary.trialExpired
  const step2Done = partnerSummary.verifiedSlots > 0 || partnerSummary.hasLifetimeAccess
  const step2Current =
    !step2Done &&
    (partnerSummary.pendingCount > 0 ||
      partnerSummary.trialExpired ||
      plansReason === 'limit-reached')
  const step3Done = partnerSummary.hasLifetimeAccess

  const trialPct = partnerSummary.hasLifetimeAccess
    ? 100
    : partnerSummary.freeTrialDays > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((partnerSummary.daysRemaining / partnerSummary.freeTrialDays) * 100)),
        )
      : 0

  const bannerInfo = (() => {
    if (partnerSummary.isAdmin) {
      return {
        tone: 'is-pos' as const,
        title: 'Admin workspace active',
        detail: 'You have full admin access. Trial locks do not apply to your session.',
      }
    }
    if (partnerSummary.hasLifetimeAccess) {
      return {
        tone: 'is-pos' as const,
        title:
          partnerSummary.verifiedSlots > 0
            ? 'Lifetime journal access unlocked'
            : 'Lifetime journal access active',
        detail:
          partnerSummary.verifiedSlots > 0
            ? `Verified ${partnerSummary.verifiedSlots} Eze Funded order${partnerSummary.verifiedSlots === 1 ? '' : 's'}. Add extra slots anytime at $0 via our affiliate link.`
            : 'Granted unlimited journal access without a trial expiration lock.',
      }
    }
    if (partnerSummary.pendingCount > 0) {
      return {
        tone: 'is-warn' as const,
        title: `Order ${latest?.orderId ?? ''} is under review`,
        detail: `Submitted ${formatShortDate(latest?.createdAt)} (${latest?.ezeEmail}). Lifetime access + 1 slot unlock once confirmed.`,
      }
    }
    if (latest?.status === 'rejected') {
      return {
        tone: 'is-neg' as const,
        title: `Verification for order ${latest.orderId} was declined`,
        detail: latest.note
          ? `${latest.note} — Verify your receipt details and resubmit below.`
          : 'Double-check your Eze Funded email and order ID from checkout and resubmit below.',
      }
    }
    if (partnerSummary.trialExpired) {
      return {
        tone: 'is-neg' as const,
        title: `Your ${partnerSummary.freeTrialDays}-day free trial ended on ${formatShortDate(partnerSummary.trialEndsAt)}`,
        detail:
          'Purchase any Eze Funded account through our affiliate link and submit your order ID below to unlock lifetime journal access.',
      }
    }
    if (plansReason === 'limit-reached') {
      return {
        tone: 'is-warn' as const,
        title: `Free account slot used (${partnerSummary.usedSlots}/${partnerSummary.freeSlots})`,
        detail: `Your trial runs until ${formatShortDate(partnerSummary.trialEndsAt)} (${partnerSummary.daysRemaining}d left). Buy any Eze Funded challenge below to add +1 slot and unlock lifetime access.`,
      }
    }
    return {
      tone: 'is-info' as const,
      title: `Free trial active · ${partnerSummary.daysRemaining} days left`,
      detail: `Started ${formatShortDate(partnerSummary.trialStartedAt)} · Ends ${formatShortDate(partnerSummary.trialEndsAt)}. Verify an Eze Funded order anytime to unlock lifetime access.`,
    }
  })()

  return (
    <Modal
      open={plansOpen}
      onClose={closePlans}
      size="lg"
      className="plans-modal"
      labelledBy="plans-modal-title"
      initialFocus="[data-autofocus]"
    >
      <div className="plans-shell">
        <header className="modal-head plans-head">
          <div className="modal-head-copy">
            <h2 className="modal-title" id="plans-modal-title">
              Plans &amp; Access
            </h2>
            <p className="modal-sub">
              {accessPolicy.trialEnabled && accessPolicy.requirePartnerAfterTrial
                ? `${accessPolicy.freeAccountSlots} free account for ${accessPolicy.freeTrialDays} days · Any verified Eze Funded affiliate purchase unlocks lifetime access.`
                : `${accessPolicy.freeAccountSlots} free account${accessPolicy.freeAccountSlots === 1 ? '' : 's'} included · Unlock extra slots at $0 via Eze Funded.`}
            </p>
          </div>
          <ModalClose onClick={closePlans} />
        </header>

        <div className="modal-body plans-body-scroll">
          <div className="plans-layout">
            <div className="plans-main-col">
              <div className={cn('plans-notice', bannerInfo.tone)} role="status">
                <span className="plans-notice-icon" aria-hidden="true">
                  {bannerInfo.tone === 'is-pos' ? (
                    <CheckCircle2 size={16} />
                  ) : bannerInfo.tone === 'is-warn' ? (
                    <Clock3 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                </span>
                <div className="plans-notice-copy">
                  <b>{bannerInfo.title}</b>
                  <span>{bannerInfo.detail}</span>
                </div>
              </div>

              <div className="plans-steps">
                <section
                  className="plans-step"
                  aria-label="Step 1: Purchase via Eze Funded affiliate link"
                >
                  <div className="plans-step-head">
                    <span className="plans-step-num num">01</span>
                    <div className="plans-step-copy">
                      <div className="plans-verify-head">
                        <h3>Purchase via Eze Funded link</h3>
                        <span className="plans-code-chip num">Code: {accessPolicy.partnerCode}</span>
                      </div>
                      <p>
                        Checkout through our affiliate link. Every verified purchase unlocks
                        lifetime journal access and +1 account slot.
                      </p>
                    </div>
                  </div>

                  <div className="plans-step-link-row">
                    <div className="plan-partner-url-row">
                      <code className="plan-partner-url">{accessPolicy.partnerUrl}</code>
                      <button
                        type="button"
                        className="plan-copy-btn"
                        onClick={copyPartnerLink}
                        aria-label="Copy Eze Funded affiliate link"
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

                <section className="plans-step" aria-labelledby="plans-verify-heading">
                  <div className="plans-step-head">
                    <span className="plans-step-num num">02</span>
                    <div className="plans-step-copy">
                      <div className="plans-verify-head">
                        <h3 id="plans-verify-heading">Verify your order</h3>
                        {partnerSummary.pendingCount > 0 && (
                          <span className="plans-pending-note num">
                            {partnerSummary.pendingCount} pending review
                          </span>
                        )}
                      </div>
                      <p>
                        Enter the email and order ID from your Eze Funded receipt so our team can
                        confirm and activate your lifetime access.
                      </p>
                    </div>
                  </div>

                  <form className="plans-verify-form" onSubmit={handleSubmit} noValidate>
                    <div className="plans-verify-fields">
                      <label className="field">
                        <span className="field-label">Eze Funded email</span>
                        <input
                          className="input"
                          type="email"
                          data-autofocus
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
                        Reviews grant lifetime access + 1 slot automatically.
                      </span>
                      <Button type="submit" variant="primary" size="sm" loading={submitting}>
                        Submit verification
                      </Button>
                    </div>
                  </form>
                </section>
              </div>
            </div>

            <aside className="plans-ledger-col" aria-label="Membership ledger">
              <div className="plans-ledger-head">
                <span className="plans-ledger-kicker">Membership Ledger</span>
                <div className="plans-ledger-title-row">
                  <strong className={cn('plans-ledger-title', accessStatusTone)}>
                    {accessStatusLabel}
                  </strong>
                  <ShieldCheck size={16} className="plans-ledger-shield" aria-hidden="true" />
                </div>
                <div className="plans-ledger-meter">
                  <div className="plans-ledger-track">
                    <i
                      className={accessStatusTone}
                      style={{ width: `${trialPct}%` }}
                    />
                  </div>
                  <div className="plans-ledger-meter-meta num">
                    <span>
                      {partnerSummary.hasLifetimeAccess
                        ? 'No expiration'
                        : partnerSummary.trialExpired
                          ? 'Trial window complete'
                          : `${partnerSummary.daysRemaining} of ${partnerSummary.freeTrialDays} days remaining`}
                    </span>
                    <span>
                      {partnerSummary.usedSlots}/{partnerSummary.totalSlots} slots
                    </span>
                  </div>
                </div>
              </div>

              <div className="plans-rail" aria-label="Account access steps">
                <div className={cn('plans-rail-step', step1Done ? 'is-done' : 'is-current')}>
                  <span className="plans-rail-node num">
                    {step1Done ? <Check size={10} strokeWidth={3} /> : '01'}
                  </span>
                  <div className="plans-rail-copy">
                    <b>{accessPolicy.freeTrialDays}-Day Free Trial</b>
                    <span>{accessPolicy.freeAccountSlots} free account included</span>
                  </div>
                </div>

                <div
                  className={cn(
                    'plans-rail-step',
                    step2Done ? 'is-done' : step2Current ? 'is-current' : '',
                  )}
                >
                  <span className="plans-rail-node num">
                    {step2Done ? <Check size={10} strokeWidth={3} /> : '02'}
                  </span>
                  <div className="plans-rail-copy">
                    <b>Eze Funded Affiliate Order</b>
                    <span>
                      {partnerSummary.pendingCount > 0
                        ? `Order ${latest?.orderId ?? ''} reviewing`
                        : step2Done
                          ? 'Purchase confirmed'
                          : 'Buy via link & submit receipt'}
                    </span>
                  </div>
                </div>

                <div className={cn('plans-rail-step', step3Done ? 'is-done' : '')}>
                  <span className="plans-rail-node num">
                    {step3Done ? <Check size={10} strokeWidth={3} /> : '03'}
                  </span>
                  <div className="plans-rail-copy">
                    <b>Lifetime Journal Access</b>
                    <span>{step3Done ? 'Active forever' : 'Unlocks upon approval'}</span>
                  </div>
                </div>
              </div>

              <dl className="plans-ledger-specs">
                <div className="plans-ledger-row">
                  <dt>Trial started</dt>
                  <dd className="num">{formatShortDate(partnerSummary.trialStartedAt)}</dd>
                </div>
                <div className="plans-ledger-row">
                  <dt>Trial ends</dt>
                  <dd className="num">
                    {partnerSummary.hasLifetimeAccess
                      ? 'Never (Lifetime)'
                      : formatShortDate(partnerSummary.trialEndsAt)}
                  </dd>
                </div>
                <div className="plans-ledger-row">
                  <dt>Account slots</dt>
                  <dd className="num">
                    {partnerSummary.usedSlots} used · {partnerSummary.remainingSlots} open
                  </dd>
                </div>
                <div className="plans-ledger-row">
                  <dt>Verification</dt>
                  <dd className={cn('num', verificationCellTone)}>{verificationCellText}</dd>
                </div>
              </dl>
            </aside>
          </div>

          {partnerVerifications.length > 0 && (
            <section className="plans-history" aria-label="Your verification requests">
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
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerVerifications.map((item) => (
                      <tr key={item.id}>
                        <td className="num">{item.orderId}</td>
                        <td>{item.ezeEmail}</td>
                        <td className="num">{formatShortDate(item.createdAt)}</td>
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
                        <td className="plans-history-note">
                          {item.note ||
                            (item.status === 'pending'
                              ? 'Awaiting admin review'
                              : item.status === 'approved'
                                ? 'Lifetime unlocked'
                                : 'Resubmit with valid receipt')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <footer className="modal-foot plans-foot">
          <div className="challenge-foot-summary">
            <Layers size={13} />
            <span className="num">
              {partnerSummary.remainingSlots > 0
                ? `${partnerSummary.remainingSlots} account slot available`
                : '0 slots remaining · Verify an Eze order to unlock +1'}
            </span>
          </div>
          <span className="spacer" />
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                closePlans()
                navigate('/admin')
              }}
            >
              <SlidersHorizontal size={13} />
              <span>Admin Dashboard</span>
            </Button>
          )}
          <Button variant="ghost" type="button" onClick={closePlans}>
            Close
          </Button>
          {partnerSummary.canAddAccount && (
            <Button
              variant="primary"
              type="button"
              onClick={() => {
                closePlans()
                openChallenge()
              }}
            >
              Start new challenge
            </Button>
          )}
        </footer>
      </div>
    </Modal>
  )
}
