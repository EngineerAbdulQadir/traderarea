import { useId, useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  History,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PhaseHistoryModal } from '@/components/modals/PhaseHistoryModal'
import { ACCOUNT_PHASES } from '@/data/firms'
import {
  accountBadge,
  accountGradient,
  accountMeta,
  nextStageFor,
  phaseState,
  titleFor,
} from '@/lib/accounts'
import { computeStats, evaluateAccount, getStartingBalance, type AccountEvaluation } from '@/lib/stats'
import { formatMoney, plainPercent, signedMoney, signedPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Account, Stats } from '@/lib/types'

type CandleTone = 'sapphire' | 'emerald' | 'sovereign' | 'slate'

const CANDLE_PALETTES: Record<
  CandleTone,
  {
    label: string
    coreStart: string
    coreMid: string
    coreEnd: string
    facetLight: string
    facetDark: string
    rimStroke: string
    metalLight: string
    metalMid: string
    metalDark: string
    aura: string
  }
> = {
  sapphire: {
    label: 'ACTIVE',
    coreStart: '#3b82f6',
    coreMid: '#1d4ed8',
    coreEnd: '#09245e',
    facetLight: '#93c5fd',
    facetDark: '#071b47',
    rimStroke: '#60a5fa',
    metalLight: '#f8fafc',
    metalMid: '#94a3b8',
    metalDark: '#334155',
    aura: 'rgba(37, 99, 235, 0.22)',
  },
  emerald: {
    label: 'PASSED',
    coreStart: '#34d399',
    coreMid: '#059669',
    coreEnd: '#064e3b',
    facetLight: '#a7f3d0',
    facetDark: '#022c22',
    rimStroke: '#6ee7b7',
    metalLight: '#f1f5f9',
    metalMid: '#94a3b8',
    metalDark: '#334155',
    aura: 'rgba(16, 185, 129, 0.22)',
  },
  sovereign: {
    label: 'FUNDED',
    coreStart: '#334155',
    coreMid: '#111827',
    coreEnd: '#030712',
    facetLight: '#64748b',
    facetDark: '#020617',
    rimStroke: '#f5d084',
    metalLight: '#fef3c7',
    metalMid: '#d4a64a',
    metalDark: '#785113',
    aura: 'rgba(212, 166, 74, 0.24)',
  },
  slate: {
    label: 'BREACHED',
    coreStart: '#64748b',
    coreMid: '#334155',
    coreEnd: '#0f172a',
    facetLight: '#cbd5e1',
    facetDark: '#0f172a',
    rimStroke: '#94a3b8',
    metalLight: '#f1f5f9',
    metalMid: '#94a3b8',
    metalDark: '#334155',
    aura: 'rgba(100, 116, 139, 0.16)',
  },
}

function selectCandleTone(
  account: Account,
  passed: boolean,
  breached: boolean,
): CandleTone {
  if (breached) return 'slate'
  if (passed) return 'emerald'
  if (account.stage === 'Funded') return 'sovereign'
  return 'sapphire'
}

function SculptedCandleArtwork({ tone }: { tone: CandleTone }) {
  const uid = useId().replace(/:/g, '')
  const p = CANDLE_PALETTES[tone]

  return (
    <svg
      viewBox="0 0 120 176"
      width="102"
      height="150"
      className="acct-candle-svg"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`core-${uid}`} x1="36" y1="42" x2="84" y2="134" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.coreStart} />
          <stop offset="52%" stopColor={p.coreMid} />
          <stop offset="100%" stopColor={p.coreEnd} />
        </linearGradient>

        <linearGradient id={`facet-l-${uid}`} x1="34" y1="44" x2="54" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.facetLight} stopOpacity="0.65" />
          <stop offset="100%" stopColor={p.coreMid} stopOpacity="0.25" />
        </linearGradient>

        <linearGradient id={`facet-r-${uid}`} x1="68" y1="44" x2="86" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.coreMid} stopOpacity="0.45" />
          <stop offset="100%" stopColor={p.facetDark} stopOpacity="0.88" />
        </linearGradient>

        <linearGradient id={`metal-h-${uid}`} x1="30" y1="0" x2="90" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.metalDark} />
          <stop offset="28%" stopColor={p.metalLight} />
          <stop offset="55%" stopColor={p.metalMid} />
          <stop offset="82%" stopColor={p.metalLight} />
          <stop offset="100%" stopColor={p.metalDark} />
        </linearGradient>

        <linearGradient id={`wick-grad-${uid}`} x1="53" y1="0" x2="67" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.metalDark} />
          <stop offset="38%" stopColor={p.metalLight} />
          <stop offset="100%" stopColor={p.metalMid} />
        </linearGradient>

        <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <clipPath id={`body-clip-${uid}`}>
          <polygon points="44,44 76,44 86,56 86,120 76,132 44,132 34,120 34,56" />
        </clipPath>
      </defs>

      <g transform="rotate(11 60 88)">
        {/* Upper precision spike wick */}
        <polygon points="60,12 64.5,35 55.5,35" fill={`url(#wick-grad-${uid})`} />
        <rect x="52" y="34.5" width="16" height="4.2" rx="1.5" fill={`url(#metal-h-${uid})`} />

        {/* Lower precision spike wick */}
        <rect x="52" y="137.3" width="16" height="4.2" rx="1.5" fill={`url(#metal-h-${uid})`} />
        <polygon points="55.5,141 64.5,141 60,164" fill={`url(#wick-grad-${uid})`} />

        {/* Outer titanium/gold beveled frame */}
        <polygon
          points="42,38.5 78,38.5 91,53.5 91,122.5 78,137.5 42,137.5 29,122.5 29,53.5"
          fill={`url(#metal-h-${uid})`}
          stroke={p.metalDark}
          strokeOpacity="0.32"
          strokeWidth="0.9"
        />

        {/* Faceted crystal body */}
        <polygon
          points="44,44 76,44 86,56 86,120 76,132 44,132 34,120 34,56"
          fill={`url(#core-${uid})`}
        />

        {/* Left beveled refraction facet */}
        <polygon points="44,44 53,54 53,122 44,132 34,120 34,56" fill={`url(#facet-l-${uid})`} />

        {/* Right shadowed crystal facet */}
        <polygon points="76,44 86,56 86,120 76,132 67,122 67,54" fill={`url(#facet-r-${uid})`} />

        {/* Center jewel crown facets */}
        <polygon points="53,54 67,54 76,44 44,44" fill={p.facetLight} fillOpacity="0.34" />
        <polygon points="53,122 67,122 76,132 44,132" fill={p.facetDark} fillOpacity="0.46" />

        {/* Animated light sweep gliding across the crystal core */}
        <g clipPath={`url(#body-clip-${uid})`}>
          <motion.rect
            x="24"
            y="40"
            width="72"
            height="28"
            fill={`url(#sheen-${uid})`}
            transform="rotate(-18 60 88)"
            initial={{ y: -32 }}
            animate={{ y: [-32, 138, 138] }}
            transition={{
              duration: 4.4,
              times: [0, 0.45, 1],
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </g>

        {/* Crisp lattice strut ribs */}
        <path
          d="M44 44 L53 54 L67 54 L76 44 M44 132 L53 122 L67 122 L76 132 M53 54 L53 122 M67 54 L67 122"
          stroke={p.rimStroke}
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <polygon
          points="44,44 76,44 86,56 86,120 76,132 44,132 34,120 34,56"
          stroke={p.metalLight}
          strokeOpacity="0.52"
          strokeWidth="1"
        />
      </g>
    </svg>
  )
}

function DormantCandleGlyph() {
  return (
    <svg
      viewBox="0 0 88 148"
      width="74"
      height="124"
      className="acct-dormant-svg"
      fill="none"
      aria-hidden="true"
    >
      <line x1="14" y1="74" x2="22" y2="74" stroke="currentColor" strokeWidth="1" opacity="0.28" />
      <line x1="66" y1="74" x2="74" y2="74" stroke="currentColor" strokeWidth="1" opacity="0.28" />
      <line
        x1="44"
        y1="10"
        x2="44"
        y2="138"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 4"
        opacity="0.2"
      />

      {/* Wicks */}
      <polygon points="44,15 47,33 41,33" stroke="currentColor" strokeWidth="1.15" opacity="0.52" />
      <polygon points="41,115 47,115 44,133" stroke="currentColor" strokeWidth="1.15" opacity="0.52" />

      {/* Chamfered candle frame */}
      <polygon
        points="34,37 54,37 62,46 62,102 54,111 34,111 26,102 26,46"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.54"
      />
      <polygon
        points="37,43 51,43 56,50 56,98 51,105 37,105 32,98 32,50"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity="0.28"
      />
    </svg>
  )
}

function AccountCandleWing({
  account,
  active,
  passed,
  breached,
  onActivate,
}: {
  account: Account
  active: boolean
  passed: boolean
  breached: boolean
  onActivate: () => void
}) {
  const tone = selectCandleTone(account, passed, breached)
  const palette = CANDLE_PALETTES[tone]

  if (active) {
    return (
      <div
        className={cn('acct-wing is-active', `tone-${tone}`)}
        aria-label={`Active account candle (${palette.label.toLowerCase()})`}
      >
        <div className="acct-wing-divider" aria-hidden="true" />

        <div className="acct-wing-stage">
          <motion.div
            className="acct-wing-aura"
            style={{ background: `radial-gradient(circle, ${palette.aura} 0%, transparent 72%)` }}
            aria-hidden="true"
            animate={{ opacity: [0.65, 1, 0.65], scale: [0.94, 1.06, 0.94] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${account.id}-${tone}`}
              className="acct-candle-float-wrap"
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -6 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                animate={{ y: [-3.5, 3.5, -3.5] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SculptedCandleArtwork tone={tone} />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <motion.span
            className="acct-candle-shadow"
            aria-hidden="true"
            animate={{ scaleX: [0.9, 1.08, 0.9], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="acct-wing-floor">
          <span className="acct-wing-rule" aria-hidden="true" />
          <span className="acct-wing-tag">{palette.label}</span>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="acct-wing is-dormant"
      onClick={onActivate}
      title={`Set ${titleFor(account)} as active`}
      aria-label={`Set ${titleFor(account)} as active account`}
    >
      <div className="acct-wing-divider" aria-hidden="true" />
      <div className="acct-wing-stage">
        <DormantCandleGlyph />
      </div>
      <div className="acct-wing-floor">
        <span className="acct-wing-rule" aria-hidden="true" />
        <span className="acct-wing-tag acct-wing-tag-dormant">
          <span className="acct-tag-rest">STANDBY</span>
          <span className="acct-tag-hover">ACTIVATE</span>
        </span>
      </div>
    </button>
  )
}

function PhaseBranchTree({
  phases,
  activeCard,
  breached,
}: {
  phases: { stage: string; index: number; state: 'done' | 'current' | 'upcoming' | 'skipped' }[]
  activeCard: boolean
  breached: boolean
}) {
  return (
    <div className="acct-tree" aria-label="Stage progression tree">
      {phases.map(({ stage, state }, idx) => {
        const isLast = idx === phases.length - 1
        const prevState = idx > 0 ? phases[idx - 1].state : null
        const branchTone =
          state === 'done' || (prevState === 'done' && state === 'current')
            ? state === 'done'
              ? 'is-done'
              : breached
                ? 'is-neg'
                : 'is-active'
            : 'is-muted'

        return (
          <div
            key={stage}
            className={cn('acct-tree-row', `state-${state}`, breached && state === 'current' && 'is-breached')}
            style={{ paddingLeft: `${idx * 22}px` }}
          >
            {idx > 0 && (
              <svg
                className={cn('acct-tree-branch', branchTone)}
                style={{ left: `${(idx - 1) * 22}px` }}
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 0 L7 13 Q7 21 15 21 L21 21"
                  stroke="currentColor"
                  strokeOpacity="0.22"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                {(state === 'done' || state === 'current') && (
                  <motion.path
                    d="M7 0 L7 13 Q7 21 15 21 L21 21"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 0.52,
                      delay: 0.1 + idx * 0.12,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}
              </svg>
            )}

            <span className={cn('acct-tree-node', isLast && 'is-terminal')} aria-hidden="true">
              {state === 'done' ? (
                <Check size={8} strokeWidth={3} />
              ) : isLast ? (
                <span className="acct-tree-diamond" />
              ) : (
                <span className="acct-tree-dot" />
              )}
              {state === 'current' && activeCard && !breached && (
                <span className="acct-tree-ring" />
              )}
            </span>

            <span className="acct-tree-label">{stage}</span>

            <span className="acct-tree-status">
              {state === 'done'
                ? 'Cleared'
                : state === 'current'
                  ? breached
                    ? 'Breached'
                    : 'Current'
                  : isLast
                    ? 'Target'
                    : 'Locked'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function AccountsPage() {
  const {
    accounts,
    activeAccount,
    setActiveAccount,
    advanceAccount,
    getTradesForAccount,
    openChallenge,
    removeAccount,
    showToast,
    viewingPhaseIndex,
    setViewingPhase,
  } = useApp()
  const navigate = useNavigate()
  const [pendingRemove, setPendingRemove] = useState<Account | null>(null)
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null)

  const evaluations = useMemo(() => {
    const map = new Map<
      string,
      { evaluation: AccountEvaluation; stats: Stats; startingBalance: number }
    >()
    accounts.forEach((account) => {
      const startingBalance = getStartingBalance(account)
      const stats = computeStats(getTradesForAccount(account), startingBalance)
      map.set(account.id, {
        evaluation: evaluateAccount(account, stats),
        stats,
        startingBalance,
      })
    })
    return map
  }, [accounts, getTradesForAccount])

  const openAccount = (account: Account) => {
    setActiveAccount(account.id)
    navigate('/metrics')
  }

  const confirmRemove = () => {
    if (!pendingRemove) return
    const title = titleFor(pendingRemove)
    removeAccount(pendingRemove.id)
    showToast('Account removed', `${title} and its trades were removed from this device.`, 'info')
    setPendingRemove(null)
  }

  const handleCardPointerMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <div className="page accounts-page">
      <PageHeader
        className="page-head--actions-end"
        actions={
          accounts.length > 0 ? (
            <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Start challenge
            </Button>
          ) : null
        }
      />

      {viewingPhaseIndex !== null && (
        <div className="phase-view-banner">
          <span>
            Reviewing {activeAccount?.stage ?? 'previous phase'} history for{' '}
            {activeAccount ? titleFor(activeAccount) : 'this account'}.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setViewingPhase(null)}>
            Back to current phase
          </Button>
        </div>
      )}

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="Your capital starts here"
          description="Create a challenge to set the rules, phase and starting balance. Trader Area then tracks every trade against them."
          actions={
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Start a challenge
            </Button>
          }
        />
      ) : (
        <div className="accounts-grid">
          {accounts.map((account, idx) => {
            const active = activeAccount?.id === account.id
            const entry = evaluations.get(account.id)
            const evaluation = entry?.evaluation
            const stats = entry?.stats
            const startingBalance = entry?.startingBalance ?? getStartingBalance(account)
            const net = stats?.net ?? 0
            const currentBalance = startingBalance + net
            const returnPct = startingBalance > 0 ? (net / startingBalance) * 100 : 0
            const passed = evaluation?.status === 'passed'
            const breached = evaluation?.status === 'breached'
            const nextStage = nextStageFor(account.type, account.stage)
            const canAdvance = passed && !!nextStage
            const phases = ACCOUNT_PHASES.map((stage, index) => ({
              stage,
              index,
              state: phaseState(account, index),
            })).filter((phase) => phase.state !== 'skipped')

            return (
              <motion.article
                key={account.id}
                className={cn(
                  'acct-card',
                  active && 'is-active',
                  passed && 'is-passed',
                  breached && 'is-breached',
                )}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.34,
                  delay: Math.min(idx * 0.045, 0.2),
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -2, transition: { duration: 0.16, ease: 'easeOut' } }}
                onMouseMove={handleCardPointerMove}
              >
                <div className="acct-card-sheen" aria-hidden="true" />
                {active && <div className="acct-card-beam" aria-hidden="true" />}

                <div className="acct-card-main">
                  <header className="acct-card-head">
                    <AccountAvatar
                      badge={accountBadge(account)}
                      gradient={accountGradient(account)}
                      size="sm"
                    />
                    <div className="acct-card-identity">
                      <h3 title={titleFor(account)}>{titleFor(account)}</h3>
                      <p className="acct-card-meta num">
                        <span>{accountMeta(account)}</span>
                        {passed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="acct-state-text is-pos">Passed</span>
                          </>
                        )}
                        {breached && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="acct-state-text is-neg">Breached</span>
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      className="account-remove acct-remove-btn"
                      type="button"
                      onClick={() => setPendingRemove(account)}
                      aria-label={`Remove ${titleFor(account)}`}
                      title="Remove account"
                    >
                      <Trash2 size={13} />
                    </button>
                  </header>

                  <div className="acct-equity-block">
                    <span className="acct-eyebrow">Equity</span>
                    <strong className="acct-balance num">
                      {formatMoney(currentBalance, account.currency)}
                    </strong>
                    <div className="acct-submetrics num">
                      <span
                        className={cn(
                          'acct-delta',
                          net > 0 && 'is-pos',
                          net < 0 && 'is-neg',
                        )}
                      >
                        {signedMoney(net, account.currency)} · {signedPercent(returnPct)}
                      </span>
                      <span className="acct-submetrics-sep" aria-hidden="true">·</span>
                      <span className="acct-win-stat">
                        {stats && stats.count > 0
                          ? `${plainPercent(stats.winRate, 0)}% win · ${stats.count}t`
                          : 'No trades'}
                      </span>
                    </div>

                    {(passed || breached) && evaluation && (
                      <p className={cn('acct-rule-notice', passed ? 'is-pos' : 'is-neg')}>
                        {passed ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        <span>{evaluation.reason}</span>
                      </p>
                    )}
                  </div>

                  <div className="acct-progression">
                    <PhaseBranchTree
                      phases={phases}
                      activeCard={active}
                      breached={breached}
                    />
                  </div>

                  <footer className="acct-card-foot">
                    <div className="acct-foot-left">
                      {(account.phaseHistory?.length || account.phaseStartedAt) ? (
                        <button
                          className="phase-history-btn"
                          type="button"
                          onClick={() => setHistoryAccount(account)}
                        >
                          <History size={11} />
                          History
                        </button>
                      ) : !active ? (
                        <button
                          type="button"
                          className="acct-activate-link"
                          onClick={() => setActiveAccount(account.id)}
                        >
                          Set active
                        </button>
                      ) : null}
                    </div>

                    <div className="acct-foot-actions">
                      {canAdvance && (
                        <Button
                          variant="primary"
                          size="sm"
                          iconRight={<ArrowRight size={13} />}
                          onClick={() => advanceAccount(account.id)}
                        >
                          Move to {nextStage}
                        </Button>
                      )}
                      <button
                        type="button"
                        className={cn(
                          'acct-open-btn',
                          active && !canAdvance && 'is-primary',
                        )}
                        onClick={() => openAccount(account)}
                      >
                        <span>{active ? 'Open metrics' : 'View metrics'}</span>
                        <ArrowUpRight size={13} className="acct-open-arrow" />
                      </button>
                    </div>
                  </footer>
                </div>

                <AccountCandleWing
                  account={account}
                  active={active}
                  passed={passed}
                  breached={breached}
                  onActivate={() => setActiveAccount(account.id)}
                />
              </motion.article>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title="Remove this account?"
        description={
          pendingRemove ? (
            <>
              <b>{titleFor(pendingRemove)}</b> and all of its trades and notes will be deleted from this device.
              This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Remove account"
        onConfirm={confirmRemove}
        onClose={() => setPendingRemove(null)}
      />

      <PhaseHistoryModal
        open={!!historyAccount}
        account={historyAccount}
        onClose={() => setHistoryAccount(null)}
      />
    </div>
  )
}
