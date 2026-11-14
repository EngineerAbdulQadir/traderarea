import { useEffect, useId, useMemo, useState } from 'react'
import { CheckCircle2, Download, Lock } from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useProfile } from '@/hooks/useProfile'
import { useApp } from '@/store/AppStore'
import {
  downloadCertificateCard,
  renderCertificateBlob,
  type CertificateOptions,
} from '@/lib/certificateCard'
import {
  CONSISTENCY_TIERS,
  evaluateConsistencyCertificates,
  type ConsistencyTier,
} from '@/lib/certificates'
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

const TIER_META: Record<
  ConsistencyTier,
  {
    level: string
    edition: string
  }
> = {
  3: {
    level: 'Level I',
    edition: 'Consistency Milestone',
  },
  6: {
    level: 'Level II',
    edition: 'Discipline Milestone',
  },
  9: {
    level: 'Level III',
    edition: 'Executive Milestone',
  },
  12: {
    level: 'Level IV',
    edition: 'Sovereign Distinction',
  },
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

  const [selectedTier, setSelectedTier] = useState<ConsistencyTier>(
    () => evaluation.highestUnlocked ?? 3,
  )
  const [traderName, setTraderName] = useState(profile.name)

  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [rendering, setRendering] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (open) {
      setTraderName((prev) => prev || profile.name)
      setSelectedTier(evaluation.highestUnlocked ?? 3)
    }
  }, [open, profile.name, evaluation.highestUnlocked])

  const activeTier = evaluation.tiers[selectedTier]
  const tierMeta = TIER_META[selectedTier]
  const isUnlocked = Boolean(activeTier.unlocked && activeTier.stats && activeTier.stats.count > 0)

  const certOptions: CertificateOptions = {
    traderName: traderName.trim() || profile.name,
    accountName,
    firmName,
    accountMeta,
    tierMonths: selectedTier,
    currency,
    rangeLabel: activeTier.rangeLabel,
  }

  useEffect(() => {
    if (!open || !isUnlocked || !activeTier.stats) {
      setPreviewUrl('')
      setRendering(false)
      return
    }

    let cancelled = false
    let objectUrl = ''
    setRendering(true)

    renderCertificateBlob(activeTier.stats, {
      traderName: traderName.trim() || profile.name,
      accountName,
      firmName,
      accountMeta,
      tierMonths: selectedTier,
      currency,
      rangeLabel: activeTier.rangeLabel,
    })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl('')
      })
      .finally(() => {
        if (!cancelled) setRendering(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [
    open,
    isUnlocked,
    activeTier.stats,
    activeTier.rangeLabel,
    profile.name,
    accountName,
    firmName,
    accountMeta,
    selectedTier,
    currency,
    traderName,
  ])

  const handleDownload = async () => {
    if (!isUnlocked || !activeTier.stats) return
    setDownloading(true)
    try {
      await downloadCertificateCard(activeTier.stats, certOptions)
      showToast('Certificate exported', `Saved ${selectedTier}-month certificate PNG.`, 'success')
    } catch {
      showToast('Export failed', 'Could not render the certificate image.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const accountContext = [accountName, firmName].filter(Boolean).join(' · ')

  return (
    <Modal open={open} onClose={onClose} size="lg" labelledBy={titleId} className="share-modal">
      <div className="modal-head share-modal-head">
        <div className="modal-head-copy">
          <div className="modal-eyebrow">Consistency milestones</div>
          <h2 id={titleId} className="modal-title">
            Performance certificates
          </h2>
          <p className="modal-sub">
            Earned through consecutive profitable calendar months
            {accountContext ? ` · ${accountContext}` : '.'}
          </p>
        </div>
        <ModalClose onClick={onClose} />
      </div>

      <div className="modal-body share-modal-body">
        <div className="share-tiers" role="tablist" aria-label="Consistency certificate tiers">
          {CONSISTENCY_TIERS.map((tier) => {
            const status = evaluation.tiers[tier]
            const meta = TIER_META[tier]
            const active = selectedTier === tier
            return (
              <button
                key={tier}
                type="button"
                role="tab"
                data-tier={tier}
                aria-selected={active}
                className={cn(
                  'share-tier-btn',
                  active && 'is-active',
                  status.unlocked ? 'is-unlocked' : 'is-locked',
                )}
                onClick={() => setSelectedTier(tier)}
              >
                <span className="share-tier-top">
                  <span className="share-tier-level">{meta.level}</span>
                  {status.unlocked ? (
                    <CheckCircle2 size={13} className="share-tier-icon is-unlocked" />
                  ) : (
                    <Lock size={12} className="share-tier-icon is-locked" />
                  )}
                </span>
                <span className="share-tier-bottom">
                  <span className="share-tier-name">{status.title}</span>
                  <span className="share-tier-state">
                    {status.unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="share-toolbar">
          {isUnlocked ? (
            <>
              <label className="share-cert-inline" htmlFor={traderInputId}>
                <span>Recipient name</span>
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

              <div className="share-toolbar-meta num">
                <span>{tierMeta.edition}</span>
                {activeTier.rangeLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{activeTier.rangeLabel}</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="share-toolbar-meta num">
                <span>
                  Current streak: <strong>{evaluation.currentStreak} mo</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Best streak: <strong>{evaluation.longestStreak} mo</strong>
                </span>
              </div>
            </>
          )}
        </div>

        {isUnlocked ? (
          <div className="share-preview-stage">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`${selectedTier}-month performance certificate`}
                className={cn('share-preview-img', rendering && 'is-updating')}
              />
            ) : (
              <div className="share-preview-skeleton" aria-hidden="true" />
            )}
          </div>
        ) : (
          <div className="share-tracker" data-tier={selectedTier}>
            <div className="share-tracker-head">
              <div className="share-tracker-icon">
                <Lock size={17} />
              </div>
              <div className="share-tracker-copy">
                <div className="share-tracker-kicker">
                  {tierMeta.level} · {tierMeta.edition}
                </div>
                <h3>{selectedTier}-Month Certificate Locked</h3>
              </div>
              <div className="share-tracker-counter num">
                <strong>
                  {activeTier.progressMonths} / {selectedTier}
                </strong>
                <span>months earned</span>
              </div>
            </div>

            <div className="share-tracker-progress">
              <div
                className="share-tracker-segments"
                style={{ gridTemplateColumns: `repeat(${selectedTier}, minmax(0, 1fr))` }}
                aria-label={`${activeTier.progressMonths} of ${selectedTier} consecutive profitable months`}
              >
                {Array.from({ length: selectedTier }, (_, idx) => {
                  const filled = idx < activeTier.progressMonths
                  return (
                    <span
                      key={idx}
                      className={cn('share-tracker-segment', filled && 'is-filled')}
                    />
                  )
                })}
              </div>
              <div className="share-tracker-hint num">
                {activeTier.remainingMonths} more consecutive profitable{' '}
                {activeTier.remainingMonths === 1 ? 'month' : 'months'} needed to unlock
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-foot share-modal-foot">
        <div className="share-foot-left">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="share-modal-actions">
          <Button
            variant="primary"
            size="sm"
            loading={downloading}
            disabled={!isUnlocked}
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
