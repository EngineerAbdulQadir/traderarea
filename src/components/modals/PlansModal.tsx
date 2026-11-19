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
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import { hasDevOwnerSession, isAuthorizedOwner } from '@/lib/access'
import {
  EZE_PARTNER_CODE,
  EZE_PARTNER_URL,
  type PartnerVerificationRequest,
} from '@/lib/partner'
import { cn } from '@/lib/cn'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function statusLabel(status: PartnerVerificationRequest['status']) {
  if (status === 'approved') return 'Approved · +1 slot'
  if (status === 'rejected') return 'Declined'
  return 'Pending review'
}

export function PlansModal() {
  const navigate = useNavigate()
  const {
    plansOpen,
    plansReason,
    closePlans,
    openChallenge,
    partnerSummary,
    partnerVerifications,
    submitPartnerVerification,
    showToast,
  } = useApp()
  const { user } = useAuth()

  const isOwner = isAuthorizedOwner(user) || hasDevOwnerSession()

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
      await navigator.clipboard.writeText(EZE_PARTNER_URL)
      setCopied(true)
      showToast('Partner link copied', 'Use this link at checkout on ezefunded.com.', 'info')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      showToast('Copy unavailable', EZE_PARTNER_URL, 'info')
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
        'Your order is queued for review. Your extra slot unlocks once confirmed.',
      )
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to submit verification.')
    } finally {
      setSubmitting(false)
    }
  }

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
              {plansReason === 'limit-reached'
                ? 'Unlock another account slot'
                : 'Plans & Access'}
            </h2>
            <p className="modal-sub">
              Your first account is free forever. Unlock extra accounts at $0 when you purchase
              through our Eze Funded partner link.
            </p>
          </div>
          <ModalClose onClick={closePlans} />
        </header>

        <div className="modal-body plans-body">
          {plansReason === 'limit-reached' && (
            <div className="plans-notice" role="status">
              <AlertCircle size={15} aria-hidden="true" />
              <div className="plans-notice-copy">
                <b>Free slot already used</b>
                <span>
                  Complete the 2 steps below to unlock another journal slot at $0.
                </span>
              </div>
            </div>
          )}

          <div className="plans-summary-strip plans-summary-strip--3 num">
            <div className="plans-summary-cell">
              <span>Accounts used</span>
              <b>
                {partnerSummary.usedSlots} / {partnerSummary.totalSlots}
              </b>
            </div>
            <div className="plans-summary-cell">
              <span>Partner unlocks</span>
              <b>+{partnerSummary.verifiedSlots}</b>
            </div>
            <div className="plans-summary-cell">
              <span>Available now</span>
              <b className={partnerSummary.canAddAccount ? 'is-pos' : 'is-muted'}>
                {partnerSummary.remainingSlots} slot{partnerSummary.remainingSlots === 1 ? '' : 's'}
              </b>
            </div>
          </div>

          <div className="plans-steps">
            <section className="plans-step" aria-label="Step 1: Purchase via Eze Funded partner link">
              <div className="plans-step-head">
                <span className="plans-step-num num">01</span>
                <div>
                  <h3>Buy any challenge via partner link</h3>
                  <p>
                    Use the link below at checkout on Eze Funded (partner code{' '}
                    <span className="num">{EZE_PARTNER_CODE}</span>). Every verified purchase
                    unlocks +1 account slot for $0.
                  </p>
                </div>
              </div>

              <div className="plans-step-link-row">
                <div className="plan-partner-url-row">
                  <code className="plan-partner-url">{EZE_PARTNER_URL}</code>
                  <button
                    type="button"
                    className="plan-copy-btn"
                    onClick={copyPartnerLink}
                    aria-label="Copy Eze Funded partner link"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <a
                  href={EZE_PARTNER_URL}
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
                    <h3 id="plans-verify-heading">Submit order verification</h3>
                    {partnerSummary.pendingCount > 0 && (
                      <span className="plans-pending-note num">
                        {partnerSummary.pendingCount} pending
                      </span>
                    )}
                  </div>
                  <p>
                    Enter the email and order ID from your Eze Funded receipt so we can match and
                    unlock your slot.
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
                    First account is free forever ({partnerSummary.freeSlots}/1 included).
                  </span>
                  <Button type="submit" variant="primary" size="sm" loading={submitting}>
                    Submit verification
                  </Button>
                </div>
              </form>
            </section>
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
                    </tr>
                  </thead>
                  <tbody>
                    {partnerVerifications.map((item) => (
                      <tr key={item.id}>
                        <td className="num">{item.orderId}</td>
                        <td>{item.ezeEmail}</td>
                        <td className="num">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
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
          {isOwner && (
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
