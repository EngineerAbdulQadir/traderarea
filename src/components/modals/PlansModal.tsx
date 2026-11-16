import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Layers,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import { CHALLENGE_SIZES } from '@/data/firms'
import { formatSize } from '@/lib/format'
import { isAuthorizedOwner, hasDevOwnerSession } from '@/lib/access'
import { isFirebaseConfigured } from '@/lib/firebase'
import { listAllPartnerVerifications } from '@/lib/cloud'
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

function statusToneClass(status: PartnerVerificationRequest['status']) {
  if (status === 'approved') return 'is-approved'
  if (status === 'rejected') return 'is-rejected'
  return 'is-pending'
}

export function PlansModal() {
  const {
    plansOpen,
    plansReason,
    closePlans,
    openChallenge,
    partnerSummary,
    partnerVerifications,
    submitPartnerVerification,
    reviewPartnerVerification,
    showToast,
  } = useApp()
  const { user } = useAuth()

  const isOwner = isAuthorizedOwner(user) || hasDevOwnerSession()

  const [ezeEmail, setEzeEmail] = useState('')
  const [orderId, setOrderId] = useState('')
  const [challengeSize, setChallengeSize] = useState<number>(CHALLENGE_SIZES[2] ?? 10_000)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState(false)

  // Owner review state
  const [ownerQueue, setOwnerQueue] = useState<PartnerVerificationRequest[]>([])
  const [ownerLoading, setOwnerLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const loadOwnerQueue = useCallback(async () => {
    if (!isOwner) return
    if (!isFirebaseConfigured) {
      setOwnerQueue(partnerVerifications)
      return
    }
    setOwnerLoading(true)
    try {
      const items = await listAllPartnerVerifications()
      setOwnerQueue(items)
    } catch {
      // Fallback to current user's subscribed items if global list is unavailable.
      setOwnerQueue(partnerVerifications)
    } finally {
      setOwnerLoading(false)
    }
  }, [isOwner, partnerVerifications])

  useEffect(() => {
    if (!plansOpen) return
    setFormError('')
    setCopied(false)
    if (!ezeEmail && user?.email) {
      setEzeEmail(user.email)
    }
    if (isOwner) {
      loadOwnerQueue()
    }
  }, [plansOpen, isOwner, loadOwnerQueue, user?.email, ezeEmail])

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
        challengeSize,
      })
      setOrderId('')
      showToast(
        'Verification submitted',
        'Your Eze Funded order is queued for review. Your new slot unlocks once confirmed.',
      )
      if (isOwner) {
        await loadOwnerQueue()
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to submit verification.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    setReviewingId(id)
    try {
      await reviewPartnerVerification(id, status)
      await loadOwnerQueue()
      showToast(
        status === 'approved' ? 'Slot unlocked' : 'Request declined',
        status === 'approved'
          ? 'Approved Eze Funded partner purchase (+1 account slot).'
          : 'The verification request was marked as declined.',
        status === 'approved' ? 'success' : 'info',
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

  const queueItems = isFirebaseConfigured ? ownerQueue : partnerVerifications
  const pendingReviewCount = queueItems.filter((item) => item.status === 'pending').length

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
                ? 'Unlock your next account slot'
                : 'Plans & partner access'}
            </h2>
            <p className="modal-sub">
              Your first trading account is free forever. Additional accounts unlock at $0 when
              purchased through the Traders Area Eze Funded partner link.
            </p>
          </div>
          <ModalClose onClick={closePlans} />
        </header>

        <div className="modal-body plans-body">
          {plansReason === 'limit-reached' && (
            <div className="plans-notice" role="status">
              <AlertCircle size={15} aria-hidden="true" />
              <div className="plans-notice-copy">
                <b>Free account slot in use</b>
                <span>
                  Your 1 free account allowance is already used (whether active, passed, or
                  breached). Purchase your next Eze Funded challenge through our partner link and
                  submit verification below to unlock another slot.
                </span>
              </div>
            </div>
          )}

          <div className="plans-summary-strip num">
            <div className="plans-summary-cell">
              <span>Accounts used</span>
              <b>
                {partnerSummary.usedSlots} / {partnerSummary.totalSlots}
              </b>
            </div>
            <div className="plans-summary-cell">
              <span>Free allowance</span>
              <b>{partnerSummary.freeSlots} account</b>
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

          <div className="plans-grid">
            <section className="plan-card" aria-label="Free journal plan">
              <div className="plan-card-head">
                <div>
                  <p className="plan-audience">For your first account</p>
                  <h3 className="plan-name">Free Journal</h3>
                </div>
                <div className="plan-price num">
                  <strong>$0</strong>
                  <span>forever</span>
                </div>
              </div>

              <ul className="plan-specs">
                <li>
                  <span>Trading accounts</span>
                  <b className="num">1 account included</b>
                </li>
                <li>
                  <span>Account lifecycle</span>
                  <b>Active, passed, or breached</b>
                </li>
                <li>
                  <span>Analytics &amp; calendar</span>
                  <b>Full access</b>
                </li>
                <li>
                  <span>MT5 &amp; CSV imports</span>
                  <b>Included</b>
                </li>
              </ul>

              <div className="plan-card-foot">
                <span className="plan-status-text num">
                  {partnerSummary.usedSlots === 0
                    ? '1 free slot available'
                    : 'Free slot used (1 / 1)'}
                </span>
                {partnerSummary.canAddAccount && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      closePlans()
                      openChallenge()
                    }}
                  >
                    Start challenge
                  </Button>
                )}
              </div>
            </section>

            <section className="plan-card is-partner" aria-label="Eze Funded partner unlock">
              <div className="plan-card-head">
                <div>
                  <p className="plan-audience">For additional accounts</p>
                  <h3 className="plan-name">Eze Funded Partner</h3>
                </div>
                <div className="plan-price num">
                  <strong>$0</strong>
                  <span>per verified account</span>
                </div>
              </div>

              <ul className="plan-specs">
                <li>
                  <span>Extra slots</span>
                  <b className="num">+1 slot per purchase</b>
                </li>
                <li>
                  <span>Supported firm</span>
                  <b>Eze Funded</b>
                </li>
                <li>
                  <span>Partner code</span>
                  <b className="num">{EZE_PARTNER_CODE} (no discount)</b>
                </li>
                <li>
                  <span>Journal subscription</span>
                  <b>$0 · Partner funded</b>
                </li>
              </ul>

              <div className="plan-partner-box">
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
                  className="btn btn-primary btn-md plan-partner-cta"
                >
                  <span>Buy Eze Funded via Traders Area</span>
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </section>
          </div>

          <section className="plans-verify" aria-labelledby="plans-verify-heading">
            <div className="plans-verify-head">
              <div>
                <h3 id="plans-verify-heading">Verify your Eze Funded purchase</h3>
                <p>
                  Eze Funded does not currently offer an automated affiliate API, so submit your
                  purchase email and order ID below to unlock your next slot once matched.
                </p>
              </div>
              {partnerSummary.pendingCount > 0 && (
                <span className="plans-pending-note num">
                  {partnerSummary.pendingCount} pending
                </span>
              )}
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

              <div className="plans-size-row">
                <span className="field-label">Challenge size</span>
                <div className="plans-size-grid" role="group" aria-label="Eze Funded challenge size">
                  {CHALLENGE_SIZES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={cn('size-option', option === challengeSize && 'is-selected')}
                      aria-pressed={option === challengeSize}
                      onClick={() => setChallengeSize(option)}
                    >
                      {formatSize(option)}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="plans-form-error" role="alert">
                  <AlertCircle size={13} aria-hidden="true" />
                  <span>{formError}</span>
                </p>
              )}

              <div className="plans-verify-actions">
                <span className="plans-disclosure">
                  Partner referral link ({EZE_PARTNER_CODE}) · purchasing supports free journal access.
                </span>
                <Button type="submit" variant="primary" size="sm" loading={submitting}>
                  Submit verification
                </Button>
              </div>
            </form>

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
                        <th className="num">Size</th>
                        <th>Submitted</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerVerifications.map((item) => (
                        <tr key={item.id}>
                          <td className="num">{item.orderId}</td>
                          <td>{item.ezeEmail}</td>
                          <td className="num">{formatSize(item.challengeSize)}</td>
                          <td className="num">
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td>
                            <span className={cn('plans-status', statusToneClass(item.status))}>
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
              </div>
            )}
          </section>

          {isOwner && (
            <section className="plans-owner" aria-label="Owner verification review">
              <div className="plans-owner-head">
                <div className="plans-owner-title">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>Owner Review Queue</span>
                </div>
                <span className="plans-owner-meta num">
                  {pendingReviewCount} pending · {queueItems.length} total
                </span>
              </div>

              {ownerLoading ? (
                <p className="plans-owner-empty">Loading verification requests…</p>
              ) : queueItems.length === 0 ? (
                <p className="plans-owner-empty">
                  No verification requests submitted yet. Submit one above to test the approval flow.
                </p>
              ) : (
                <div className="plans-history-table-wrap">
                  <table className="plans-history-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Order ID</th>
                        <th>Eze email</th>
                        <th className="num">Size</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.userEmail || '—'}</td>
                          <td className="num">{item.orderId}</td>
                          <td>{item.ezeEmail}</td>
                          <td className="num">{formatSize(item.challengeSize)}</td>
                          <td>
                            <span className={cn('plans-status', statusToneClass(item.status))}>
                              {statusLabel(item.status)}
                            </span>
                          </td>
                          <td>
                            <div className="plans-owner-actions">
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
        </div>

        <footer className="modal-foot plans-foot">
          <div className="challenge-foot-summary">
            <Layers size={13} />
            <span className="num">
              {partnerSummary.remainingSlots > 0
                ? `${partnerSummary.remainingSlots} account slot available`
                : '0 slots remaining · Verify an Eze Funded order to add another'}
            </span>
          </div>
          <span className="spacer" />
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
