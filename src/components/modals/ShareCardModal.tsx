import { useEffect, useId, useMemo, useState } from 'react'
import { Award, Check, CheckCircle2, Copy, Download, Eye, EyeOff, Lock, Share2 } from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useProfile } from '@/hooks/useProfile'
import { useApp } from '@/store/AppStore'
import {
  certificateDataUrl,
  copyCertificateCard,
  downloadCertificateCard,
  shareCertificateCard,
  type CertificateOptions,
} from '@/lib/certificateCard'
import {
  CONSISTENCY_TIERS,
  evaluateConsistencyCertificates,
  type ConsistencyTier,
} from '@/lib/certificates'
import { formatDateRange, isValidISODate } from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import { computeStats } from '@/lib/stats'
import type { Trade } from '@/lib/types'
import { cn } from '@/lib/cn'

interface ShareCardModalProps {
  open: boolean
  onClose: () => void
  trades: Trade[]
  startingBalance: number
  accountName?: string
  firmName?: string
  accountMeta?: string
  currency?: string
}

export function ShareCardModal({
  open,
  onClose,
  trades,
  startingBalance,
  accountName,
  firmName,
  accountMeta,
  currency,
}: ShareCardModalProps) {
  const titleId = useId()
  const traderInputId = useId()
  const profile = useProfile()
  const { showToast } = useApp()

  const evaluation = useMemo(
    () => evaluateConsistencyCertificates(trades, startingBalance),
    [trades, startingBalance],
  )

  const ledgerStats = useMemo(
    () => computeStats(trades, startingBalance),
    [trades, startingBalance],
  )

  const ledgerRangeLabel = useMemo(() => {
    const dates = trades.map((t) => t.date).filter((d) => isValidISODate(d)).sort()
    if (!dates.length) return ''
    return formatDateRange(dates[0], dates[dates.length - 1])
  }, [trades])

  const [selectedTier, setSelectedTier] = useState<ConsistencyTier>(
    () => evaluation.highestUnlocked ?? 3,
  )
  const [viewLockedProgress, setViewLockedProgress] = useState(false)
  const [hideMoney, setHideMoney] = useState(false)
  const [traderName, setTraderName] = useState(profile.name)

  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [rendering, setRendering] = useState(false)
  const [busyAction, setBusyAction] = useState<'copy' | 'download' | 'share' | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setTraderName((prev) => prev || profile.name)
      setSelectedTier(evaluation.highestUnlocked ?? 3)
      setViewLockedProgress(false)
      setCopied(false)
    }
  }, [open, profile.name, evaluation.highestUnlocked])

  const activeTier = evaluation.tiers[selectedTier]
  const displayStats = activeTier.unlocked && activeTier.stats ? activeTier.stats : ledgerStats
  const displayRange = activeTier.unlocked && activeTier.rangeLabel ? activeTier.rangeLabel : ledgerRangeLabel
  const showingProgress = !activeTier.unlocked && viewLockedProgress

  const certOptions: CertificateOptions = {
    traderName: traderName.trim() || profile.name,
    accountName,
    firmName,
    accountMeta,
    tierMonths: selectedTier,
    currency,
    rangeLabel: displayRange,
    hideMoney,
  }

  useEffect(() => {
    if (!open || showingProgress || !displayStats || displayStats.count === 0) {
      return
    }
    let cancelled = false
    setRendering(true)

    certificateDataUrl(displayStats, {
      traderName: traderName.trim() || profile.name,
      accountName,
      firmName,
      accountMeta,
      tierMonths: selectedTier,
      currency,
      rangeLabel: displayRange,
      hideMoney,
    })
      .then((url) => {
        if (!cancelled) setPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl('')
      })
      .finally(() => {
        if (!cancelled) setRendering(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    open,
    showingProgress,
    displayStats,
    profile.name,
    accountName,
    firmName,
    accountMeta,
    selectedTier,
    currency,
    displayRange,
    hideMoney,
    traderName,
  ])

  const canNativeShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { share?: unknown }).share === 'function' &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function'

  const canExport = Boolean(activeTier.unlocked && activeTier.stats && activeTier.stats.count > 0)

  const handleCopy = async () => {
    if (!canExport || !activeTier.stats) return
    setBusyAction('copy')
    try {
      await copyCertificateCard(activeTier.stats, certOptions)
      setCopied(true)
      showToast('Certificate copied', 'Certificate image copied to your clipboard.', 'success')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      showToast('Copy unavailable', 'Use Download PNG to save the certificate directly.', 'info')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDownload = async () => {
    if (!canExport || !activeTier.stats) return
    setBusyAction('download')
    try {
      await downloadCertificateCard(activeTier.stats, certOptions)
      showToast('Certificate exported', `Saved ${selectedTier}-month certificate PNG.`, 'success')
    } catch {
      showToast('Export failed', 'Could not render the certificate image.', 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleNativeShare = async () => {
    if (!canExport || !activeTier.stats) return
    setBusyAction('share')
    try {
      await shareCertificateCard(activeTier.stats, certOptions)
    } finally {
      setBusyAction(null)
    }
  }

  const progressPct = Math.min(
    100,
    Math.max(0, (activeTier.progressMonths / selectedTier) * 100),
  )

  return (
    <Modal open={open} onClose={onClose} size="lg" labelledBy={titleId} className="share-modal">
      <div className="modal-head">
        <div className="modal-head-copy">
          <div className="modal-eyebrow">Consistency milestones</div>
          <h2 id={titleId} className="modal-title">Performance certificate</h2>
          <p className="modal-sub">
            Certificates unlock at 3, 6, 9, and 12 consecutive profitable calendar months.
          </p>
        </div>
        <ModalClose onClick={onClose} />
      </div>

      <div className="modal-body share-modal-body">
        <div className="share-tiers" role="tablist" aria-label="Consistency certificate tiers">
          {CONSISTENCY_TIERS.map((tier) => {
            const status = evaluation.tiers[tier]
            const active = selectedTier === tier
            return (
              <button
                key={tier}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  'share-tier-btn',
                  active && 'is-active',
                  status.unlocked ? 'is-unlocked' : 'is-locked',
                )}
                onClick={() => {
                  setSelectedTier(tier)
                  if (status.unlocked) setViewLockedProgress(false)
                }}
              >
                <span className="share-tier-title">
                  {status.unlocked ? <CheckCircle2 size={13} /> : <Lock size={12} />}
                  <span>{status.title}</span>
                </span>
                <span className="share-tier-meta num">
                  {status.unlocked ? 'Unlocked' : `${status.progressMonths}/${tier} mo`}
                </span>
              </button>
            )
          })}
        </div>

        <div className="share-controls">
          <label className="share-cert-inline" htmlFor={traderInputId}>
            <span>Trader name</span>
            <input
              id={traderInputId}
              type="text"
              className="share-cert-input"
              value={traderName}
              onChange={(e) => setTraderName(e.target.value)}
              placeholder={profile.name}
              maxLength={44}
            />
          </label>

          <div className="share-controls-right">
            {!activeTier.unlocked && (
              <button
                type="button"
                className={cn('share-privacy-btn', viewLockedProgress && 'is-active')}
                aria-pressed={viewLockedProgress}
                onClick={() => setViewLockedProgress((prev) => !prev)}
              >
                {viewLockedProgress ? <Award size={13} /> : <Lock size={13} />}
                <span>{viewLockedProgress ? 'View certificate' : 'Unlock progress'}</span>
              </button>
            )}

            <button
              type="button"
              className={cn('share-privacy-btn', hideMoney && 'is-active')}
              aria-pressed={hideMoney}
              onClick={() => setHideMoney((prev) => !prev)}
            >
              {hideMoney ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{hideMoney ? 'Dollar amounts hidden' : 'Hide $ amounts'}</span>
            </button>
          </div>
        </div>

        <div className="share-preview-stage">
          {!showingProgress ? (
            previewUrl ? (
              <img
                src={previewUrl}
                alt={`${selectedTier}-month performance certificate preview`}
                className={cn('share-preview-img', rendering && 'is-updating')}
              />
            ) : (
              <div className="share-preview-skeleton" aria-hidden="true" />
            )
          ) : (
            <div className="share-locked-card">
              <div className="share-locked-head">
                <div className="share-locked-icon">
                  <Lock size={18} />
                </div>
                <div className="share-locked-copy">
                  <span className="share-locked-kicker">
                    {selectedTier}-MONTH CONSISTENT PROFITS
                  </span>
                  <h3>{selectedTier}-Month Certificate Locked</h3>
                  <p>
                    Close {selectedTier} consecutive calendar months in net profit on this account to unlock your certificate.
                  </p>
                </div>
              </div>

              <div className="share-locked-meter">
                <div className="share-locked-meter-top">
                  <span>Consecutive profitable streak</span>
                  <b className="num">
                    {activeTier.progressMonths} / {selectedTier} months
                  </b>
                </div>
                <div className="share-locked-track" aria-hidden="true">
                  <i style={{ width: `${progressPct}%` }} />
                </div>
                <span className="share-locked-hint">
                  {activeTier.remainingMonths} more consecutive profitable{' '}
                  {activeTier.remainingMonths === 1 ? 'month' : 'months'} required
                  {evaluation.currentStreak > 0
                    ? ` · Current run: ${evaluation.currentStreak} ${evaluation.currentStreak === 1 ? 'month' : 'months'}`
                    : ''}
                </span>
              </div>

              {evaluation.months.length > 0 && (
                <div className="share-locked-months">
                  <div className="share-locked-months-head">Recent monthly ledger</div>
                  <div className="share-locked-months-grid">
                    {evaluation.months.slice(-6).map((month) => (
                      <div
                        key={month.month}
                        className={cn(
                          'share-locked-month',
                          month.profitable ? 'is-pos' : 'is-neg',
                        )}
                      >
                        <span className="share-locked-month-name">{month.label}</span>
                        <b className="num">
                          {hideMoney
                            ? month.profitable
                              ? 'Profitable'
                              : 'Loss'
                            : signedMoney(month.net)}
                        </b>
                        <span className="share-locked-month-sub num">
                          {month.count} {month.count === 1 ? 'trade' : 'trades'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="modal-foot share-modal-foot">
        <div className="share-foot-left">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          {!activeTier.unlocked && (
            <span className="share-foot-note">
              Preview only · Unlocks at {selectedTier} consecutive profitable months ({activeTier.progressMonths}/{selectedTier})
            </span>
          )}
        </div>
        <div className="share-modal-actions">
          {canNativeShare && (
            <Button
              variant="secondary"
              size="sm"
              loading={busyAction === 'share'}
              disabled={!canExport}
              iconLeft={<Share2 size={13} />}
              onClick={handleNativeShare}
            >
              Share
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={busyAction === 'copy'}
            disabled={!canExport}
            iconLeft={copied ? <Check size={13} /> : <Copy size={13} />}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy image'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={busyAction === 'download'}
            disabled={!canExport}
            iconLeft={<Download size={13} />}
            onClick={handleDownload}
          >
            Download PNG
          </Button>
        </div>
      </div>
    </Modal>
  )
}
