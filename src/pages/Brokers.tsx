import { useId, useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUpRight,
  Building2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { BROKER_TYPE_LABELS } from '@/data/brokers'
import { titleFor } from '@/lib/accounts'
import { computeStats, evaluateAccount, getStartingBalance, type AccountEvaluation } from '@/lib/stats'
import { formatMoney, plainPercent, signedMoney, signedPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Account, Stats } from '@/lib/types'

type CandleTone = 'sapphire' | 'azure' | 'sovereign' | 'crimson'

const CANDLE_PALETTES: Record<
  CandleTone,
  {
    coreDeep: string
    coreMid: string
    coreBright: string
    leftLit: string
    rightShadow: string
    refractLight: string
    cageLight: string
    cageMid: string
    cageDark: string
    cageEdge: string
    aura: string
  }
> = {
  sapphire: {
    coreDeep: '#061238',
    coreMid: '#1238a8',
    coreBright: '#3b82f6',
    leftLit: '#93c5fd',
    rightShadow: '#040b24',
    refractLight: '#dbeafe',
    cageLight: '#f1f5f9',
    cageMid: '#94a3b8',
    cageDark: '#334155',
    cageEdge: '#ffffff',
    aura: 'rgba(37, 99, 235, 0.12)',
  },
  azure: {
    coreDeep: '#041a3d',
    coreMid: '#1d4ed8',
    coreBright: '#4c8bf5',
    leftLit: '#7dd3fc',
    rightShadow: '#020e26',
    refractLight: '#e0f2fe',
    cageLight: '#f1f5f9',
    cageMid: '#94a3b8',
    cageDark: '#334155',
    cageEdge: '#ffffff',
    aura: 'rgba(76, 139, 245, 0.15)',
  },
  sovereign: {
    coreDeep: '#04070d',
    coreMid: '#111827',
    coreBright: '#334155',
    leftLit: '#94a3b8',
    rightShadow: '#020408',
    refractLight: '#fef3c7',
    cageLight: '#fef08a',
    cageMid: '#d4a64a',
    cageDark: '#6b4710',
    cageEdge: '#fffbeb',
    aura: 'rgba(212, 166, 74, 0.14)',
  },
  crimson: {
    coreDeep: '#240508',
    coreMid: '#991b1b',
    coreBright: '#ef4444',
    leftLit: '#fca5a5',
    rightShadow: '#160204',
    refractLight: '#fee2e2',
    cageLight: '#e2e8f0',
    cageMid: '#64748b',
    cageDark: '#1e293b',
    cageEdge: '#f8fafc',
    aura: 'rgba(220, 38, 38, 0.12)',
  },
}

function selectBrokerCandleTone(
  account: Account,
  goalMet: boolean,
  breached: boolean,
): { tone: CandleTone; label: string } {
  if (breached) return { tone: 'crimson', label: 'LIMIT HIT' }
  if (goalMet) return { tone: 'azure', label: 'GOAL MET' }
  if (account.brokerMode === 'Demo') return { tone: 'sapphire', label: 'DEMO' }
  return { tone: 'sovereign', label: 'LIVE' }
}

function brokerCardSubtitle(account: Account): string {
  const tier = account.brokerType ? BROKER_TYPE_LABELS[account.brokerType] : 'Standard'
  const mode = account.brokerMode ?? 'Live'
  return `${account.firm || 'Exness'} · ${tier} · ${mode}`
}

function SculptedCandleArtwork({ tone }: { tone: CandleTone }) {
  const uid = useId().replace(/:/g, '')
  const p = CANDLE_PALETTES[tone]

  return (
    <svg
      viewBox="0 0 132 204"
      width="106"
      height="164"
      className="acct-candle-svg"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`core-grad-${uid}`} x1="36" y1="48" x2="96" y2="156" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.coreBright} />
          <stop offset="48%" stopColor={p.coreMid} />
          <stop offset="100%" stopColor={p.coreDeep} />
        </linearGradient>

        <linearGradient id={`flank-l-${uid}`} x1="36" y1="54" x2="48" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.leftLit} stopOpacity="0.82" />
          <stop offset="65%" stopColor={p.coreBright} stopOpacity="0.65" />
          <stop offset="100%" stopColor={p.coreMid} stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id={`flank-r-${uid}`} x1="82" y1="50" x2="96" y2="152" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.coreMid} />
          <stop offset="100%" stopColor={p.rightShadow} />
        </linearGradient>

        <linearGradient id={`cage-face-${uid}`} x1="30" y1="40" x2="102" y2="164" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.cageLight} />
          <stop offset="46%" stopColor={p.cageMid} />
          <stop offset="100%" stopColor={p.cageDark} />
        </linearGradient>

        <linearGradient id={`cage-depth-${uid}`} x1="80" y1="44" x2="98" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.cageMid} />
          <stop offset="100%" stopColor={p.cageDark} />
        </linearGradient>

        <linearGradient id={`collar-band-${uid}`} x1="48" y1="0" x2="84" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.cageDark} />
          <stop offset="30%" stopColor={p.cageLight} />
          <stop offset="62%" stopColor={p.cageMid} />
          <stop offset="100%" stopColor={p.cageDark} />
        </linearGradient>

        <clipPath id={`crystal-clip-${uid}`}>
          <polygon points="48,48 82,48 94,58 94,146 82,156 48,156 38,146 38,58" />
        </clipPath>
      </defs>

      <polygon points="66,9 66,35 62.6,35" fill={p.cageLight} />
      <polygon points="66,9 69.4,35 66,35" fill={p.cageDark} />
      <line x1="66" y1="9" x2="66" y2="35" stroke={p.cageEdge} strokeOpacity="0.7" strokeWidth="0.6" />
      <polygon points="57,35 75,35 77,38.5 55,38.5" fill={`url(#collar-band-${uid})`} />
      <polygon points="52,38.5 80,38.5 82,43 50,43" fill={`url(#collar-band-${uid})`} stroke={p.cageDark} strokeOpacity="0.35" strokeWidth="0.5" />
      <rect x="55" y="43" width="22" height="2.2" fill={p.cageDark} fillOpacity="0.65" />

      <rect x="55" y="158.8" width="22" height="2.2" fill={p.cageDark} fillOpacity="0.65" />
      <polygon points="50,161 82,161 80,165.5 52,165.5" fill={`url(#collar-band-${uid})`} stroke={p.cageDark} strokeOpacity="0.35" strokeWidth="0.5" />
      <polygon points="55,165.5 77,165.5 75,169 57,169" fill={`url(#collar-band-${uid})`} />
      <polygon points="62.6,169 66,169 66,195" fill={p.cageLight} />
      <polygon points="66,169 69.4,169 66,195" fill={p.cageDark} />
      <line x1="66" y1="169" x2="66" y2="195" stroke={p.cageEdge} strokeOpacity="0.45" strokeWidth="0.6" />

      <g clipPath={`url(#crystal-clip-${uid})`}>
        <polygon points="38,48 94,48 94,156 38,156" fill={`url(#core-grad-${uid})`} />
        <polygon points="38,58 49,54 49,150 38,146" fill={`url(#flank-l-${uid})`} />
        <polygon points="83,54 94,58 94,146 83,150" fill={`url(#flank-r-${uid})`} />
        <polygon points="53,60 79,60 79,144 53,144" fill={p.rightShadow} fillOpacity="0.42" />
        <polygon points="48,48 82,48 83,58 49,78 38,58" fill={p.refractLight} fillOpacity="0.28" />
        <polygon points="49,82 83,64 83,96 49,116" fill={p.leftLit} fillOpacity="0.2" />
        <polygon points="49,128 83,110 83,148 49,150" fill={p.refractLight} fillOpacity="0.14" />
        <line x1="49" y1="78" x2="83" y2="58" stroke={p.refractLight} strokeOpacity="0.55" strokeWidth="0.7" />
        <line x1="49" y1="116" x2="83" y2="96" stroke={p.leftLit} strokeOpacity="0.4" strokeWidth="0.65" />
        <line x1="65" y1="50" x2="65" y2="154" stroke={p.refractLight} strokeOpacity="0.28" strokeWidth="0.7" />
        <polygon points="38,146 49,149 83,149 94,146 82,156 48,156" fill={p.rightShadow} fillOpacity="0.78" />
      </g>

      <polygon
        points="82,45 87,45 97,56 97,148 87,159 82,159 82,155.5 92.5,146 92.5,58 82,48.5"
        fill={`url(#cage-depth-${uid})`}
        stroke={p.cageDark}
        strokeOpacity="0.4"
        strokeWidth="0.5"
      />
      <polygon
        points="45,45 87,45 93,52 82,52 80,48.5 52,48.5 50,52 39,52"
        fill={`url(#cage-face-${uid})`}
        stroke={p.cageDark}
        strokeOpacity="0.32"
        strokeWidth="0.5"
      />
      <polygon
        points="39,152 50,152 52,155.5 80,155.5 82,152 93,152 87,159 45,159"
        fill={`url(#cage-face-${uid})`}
        stroke={p.cageDark}
        strokeOpacity="0.32"
        strokeWidth="0.5"
      />
      <polygon
        points="35,56 45,45 49.5,48.5 40.5,58 40.5,146 49.5,155.5 45,159 35,148"
        fill={`url(#cage-face-${uid})`}
        stroke={p.cageDark}
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      <polygon
        points="40,76 62,50 67.5,50 40,83"
        fill={`url(#cage-face-${uid})`}
        stroke={p.cageDark}
        strokeOpacity="0.35"
        strokeWidth="0.45"
      />
      <polygon
        points="66,154 92.5,123 92.5,130 71.5,154"
        fill={`url(#cage-depth-${uid})`}
        stroke={p.cageDark}
        strokeOpacity="0.35"
        strokeWidth="0.45"
      />
      <polygon points="63.5,48.5 68.5,48.5 68.5,64 66,68 63.5,64" fill={`url(#cage-face-${uid})`} />
      <polygon points="63.5,140 66,136 68.5,140 68.5,155.5 63.5,155.5" fill={`url(#cage-face-${uid})`} />
      <circle cx="66" cy="54.5" r="1.25" fill={p.cageDark} stroke={p.cageEdge} strokeOpacity="0.5" strokeWidth="0.4" />
      <circle cx="66" cy="149.5" r="1.25" fill={p.cageDark} stroke={p.cageEdge} strokeOpacity="0.5" strokeWidth="0.4" />
      <polyline
        points="35.5,147 35.5,56 45,45.5 87,45.5"
        stroke={p.cageEdge}
        strokeOpacity="0.75"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DormantCandleGlyph({ breached }: { breached: boolean }) {
  const uid = useId().replace(/:/g, '')
  const lightTone = breached ? '#94a3b8' : '#cbd5e1'
  const darkTone = breached ? '#475569' : '#64748b'

  return (
    <svg
      viewBox="0 0 132 204"
      width="98"
      height="152"
      className="acct-dormant-svg"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`dorm-core-${uid}`} x1="38" y1="50" x2="94" y2="154" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lightTone} stopOpacity="0.32" />
          <stop offset="100%" stopColor={darkTone} stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <polygon points="66,12 66,36 63,36" fill="currentColor" fillOpacity="0.34" />
      <polygon points="66,12 69,36 66,36" fill="currentColor" fillOpacity="0.18" />
      <polygon points="53,38 79,38 81,43 51,43" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.6" />

      <polygon points="51,161 81,161 79,166 53,166" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.6" />
      <polygon points="63,168 66,168 66,192" fill="currentColor" fillOpacity="0.32" />
      <polygon points="66,168 69,168 66,192" fill="currentColor" fillOpacity="0.16" />

      <polygon
        points="46,47 86,47 95,57 95,147 86,157 46,157 37,147 37,57"
        fill={`url(#dorm-core-${uid})`}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="0.85"
      />

      <polygon points="40,76 62,50 67,50 40,82.5" fill="currentColor" fillOpacity="0.22" />
      <polygon points="66,154 92,124 92,130.5 71.5,154" fill="currentColor" fillOpacity="0.22" />
      <line x1="48" y1="47" x2="48" y2="157" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.65" />
      <line x1="84" y1="47" x2="84" y2="157" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.65" />
      <line x1="49" y1="116" x2="83" y2="96" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.65" />
    </svg>
  )
}

function BrokerCandleWing({
  account,
  active,
  goalMet,
  breached,
  onActivate,
}: {
  account: Account
  active: boolean
  goalMet: boolean
  breached: boolean
  onActivate: () => void
}) {
  const { tone, label } = selectBrokerCandleTone(account, goalMet, breached)
  const palette = CANDLE_PALETTES[tone]

  if (active) {
    return (
      <div
        className={cn('acct-wing is-active', `tone-${tone}`)}
        aria-label={`Active broker candle (${label.toLowerCase()})`}
      >
        <div className="acct-wing-divider" aria-hidden="true" />

        <div className="acct-wing-stage">
          <div
            className="acct-wing-aura"
            style={{ background: `radial-gradient(ellipse at center, ${palette.aura} 0%, transparent 70%)` }}
            aria-hidden="true"
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${account.id}-${tone}`}
              className="acct-candle-float-wrap"
              initial={{ opacity: 0, scale: 0.92, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                animate={{ y: [-2.5, 2.5, -2.5] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SculptedCandleArtwork tone={tone} />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <motion.span
            className="acct-candle-shadow"
            aria-hidden="true"
            animate={{ scaleX: [0.92, 1.06, 0.92], opacity: [0.28, 0.46, 0.28] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="acct-wing-floor">
          <span className="acct-wing-rule" aria-hidden="true" />
          <span className="acct-wing-tag">{label}</span>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn('acct-wing is-dormant', breached && 'is-breached')}
      onClick={onActivate}
      title={`Set ${titleFor(account)} as active`}
      aria-label={`Set ${titleFor(account)} as active broker`}
    >
      <div className="acct-wing-divider" aria-hidden="true" />
      <div className="acct-wing-stage">
        <DormantCandleGlyph breached={breached} />
      </div>
      <div className="acct-wing-floor">
        <span className="acct-wing-rule" aria-hidden="true" />
        <span className="acct-wing-tag acct-wing-tag-dormant">
          <span className="acct-tag-rest">{breached ? 'LIMIT HIT' : 'STANDBY'}</span>
          <span className="acct-tag-hover">ACTIVATE</span>
        </span>
      </div>
    </button>
  )
}

function guardrailsSummary(account: Account): string {
  const daily = Number(account.rules?.daily) || 0
  const max = Number(account.rules?.max) || 0
  const goal = Number(account.rules?.target) || 0
  const parts: string[] = []
  if (daily > 0) parts.push(`${daily}% day`)
  if (max > 0) parts.push(`${max}% max`)
  if (goal > 0) parts.push(`${goal}% goal`)
  return parts.length ? parts.join(' / ') : 'Off'
}

export function BrokersPage() {
  const {
    brokerAccounts,
    activeAccount,
    setActiveBrokerAccount,
    removeBrokerAccount,
    getTradesForAccount,
    openBrokerChallenge,
    openEditBrokerAccount,
    showToast,
  } = useApp()
  const navigate = useNavigate()
  const [pendingRemove, setPendingRemove] = useState<Account | null>(null)

  const evaluations = useMemo(() => {
    const map = new Map<
      string,
      { evaluation: AccountEvaluation; stats: Stats; startingBalance: number }
    >()
    brokerAccounts.forEach((account) => {
      const startingBalance = getStartingBalance(account)
      const stats = computeStats(getTradesForAccount(account), startingBalance)
      map.set(account.id, {
        evaluation: evaluateAccount(account, stats),
        stats,
        startingBalance,
      })
    })
    return map
  }, [brokerAccounts, getTradesForAccount])

  const openAccount = (account: Account) => {
    setActiveBrokerAccount(account.id)
    navigate('/metrics')
  }

  const confirmRemove = () => {
    if (!pendingRemove) return
    const title = titleFor(pendingRemove)
    removeBrokerAccount(pendingRemove.id)
    showToast('Broker account removed', `${title} and its trades were removed from this device.`, 'info')
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
          <div className="accounts-head-actions">
            <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={openBrokerChallenge}>
              Add broker account
            </Button>
          </div>
        }
      />

      {brokerAccounts.length === 0 ? (
        <EmptyState
          icon={<Building2 size={22} />}
          title="Your Exness & broker accounts start here"
          description="Add an Exness Live or Demo account to track equity, execution specs, personal risk guardrails, and full performance metrics."
          actions={
            <div className="accounts-head-actions">
              <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openBrokerChallenge}>
                Add broker account
              </Button>
            </div>
          }
        />
      ) : (
        <div className="accounts-grid">
          {brokerAccounts.map((account, idx) => {
            const active = activeAccount?.id === account.id
            const entry = evaluations.get(account.id)
            const evaluation = entry?.evaluation
            const stats = entry?.stats
            const startingBalance = entry?.startingBalance ?? getStartingBalance(account)
            const net = stats?.net ?? 0
            const currentBalance = startingBalance + net
            const returnPct = startingBalance > 0 ? (net / startingBalance) * 100 : 0
            const goalMet = evaluation?.status === 'passed'
            const breached = evaluation?.status === 'breached'
            const isLive = account.brokerMode !== 'Demo'

            return (
              <motion.article
                key={account.id}
                className={cn(
                  'acct-card',
                  active && 'is-active',
                  goalMet && 'is-passed',
                  breached && 'is-breached',
                  isLive && !breached && 'is-funded',
                )}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.34,
                  delay: Math.min(idx * 0.045, 0.2),
                  ease: [0.22, 1, 0.36, 1],
                }}
                onMouseMove={handleCardPointerMove}
              >
                <div className="acct-card-sheen" aria-hidden="true" />

                <div className="acct-card-main">
                  <header className="acct-card-head">
                    <div className="acct-card-identity">
                      <h3 title={titleFor(account)}>{titleFor(account)}</h3>
                      <p className="acct-card-meta">
                        <span>{brokerCardSubtitle(account)}</span>
                      </p>
                    </div>

                    <div className="acct-head-actions">
                      <button
                        className="account-remove acct-head-btn acct-edit-btn"
                        type="button"
                        onClick={() => openEditBrokerAccount(account)}
                        aria-label={`Edit ${titleFor(account)}`}
                        title="Edit broker account"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="account-remove acct-head-btn acct-remove-btn"
                        type="button"
                        onClick={() => setPendingRemove(account)}
                        aria-label={`Remove ${titleFor(account)}`}
                        title="Remove broker account"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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
                  </div>

                  <div className="broker-spec-grid" aria-label="Broker account specifications">
                    <div className="broker-spec-cell">
                      <span className="broker-spec-label">Terminal</span>
                      <strong className="broker-spec-value">{account.platform || 'MT5'}</strong>
                    </div>
                    <div className="broker-spec-cell">
                      <span className="broker-spec-label">Leverage</span>
                      <strong className="broker-spec-value num">{account.leverage || '1:1000'}</strong>
                    </div>
                    <div className="broker-spec-cell">
                      <span className="broker-spec-label">Deposit</span>
                      <strong className="broker-spec-value num">
                        {formatMoney(startingBalance, account.currency)}
                      </strong>
                    </div>
                    <div className="broker-spec-cell">
                      <span className="broker-spec-label">Guardrails</span>
                      <strong className="broker-spec-value num">{guardrailsSummary(account)}</strong>
                    </div>
                  </div>

                  <footer className="acct-card-foot">
                    <div className="acct-foot-actions">
                      <button
                        type="button"
                        className={cn(
                          'acct-open-btn',
                          active && 'is-primary',
                        )}
                        onClick={() => openAccount(account)}
                      >
                        <span>{active ? 'Open metrics' : 'View metrics'}</span>
                        <ArrowUpRight size={13} className="acct-open-arrow" />
                      </button>
                    </div>
                  </footer>
                </div>

                <BrokerCandleWing
                  account={account}
                  active={active}
                  goalMet={goalMet}
                  breached={breached}
                  onActivate={() => setActiveBrokerAccount(account.id)}
                />
              </motion.article>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title="Remove this broker account?"
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
    </div>
  )
}
