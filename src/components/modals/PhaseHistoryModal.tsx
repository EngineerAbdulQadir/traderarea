import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useApp } from '@/store/AppStore'
import { effectivePhaseHistory, titleFor, tradePhaseKey, tradesForPhase } from '@/lib/accounts'
import { computeStats, evaluateAccount, getStartingBalance } from '@/lib/stats'
import { formatNumericDate } from '@/lib/dates'
import { formatMoney, plainPercent, signedMoney } from '@/lib/format'
import type { Account, Rules, Stage, Stats, Trade } from '@/lib/types'
import { cn } from '@/lib/cn'

interface PhaseHistoryModalProps {
  open: boolean
  account: Account | null
  onClose: () => void
}

interface PhaseView {
  stage: Stage
  startingBalance: number
  rules: Rules
  trades: Trade[]
  stats: Stats
  status: 'passed' | 'breached' | 'active'
  endedAt: string
  current: boolean
}

function rangeLabel(trades: Trade[]): string {
  const dates = trades.map((trade) => trade.date).filter(Boolean).sort()
  if (!dates.length) return 'No trades recorded'
  const first = dates[0]
  const last = dates[dates.length - 1]
  return first === last
    ? formatNumericDate(first)
    : `${formatNumericDate(first)} – ${formatNumericDate(last)}`
}

function statusTone(status: PhaseView['status']) {
  if (status === 'passed') return 'pos' as const
  if (status === 'breached') return 'neg' as const
  return 'accent' as const
}

function statusLabel(status: PhaseView['status']) {
  if (status === 'passed') return 'Passed'
  if (status === 'breached') return 'Breached'
  return 'In progress'
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function PhaseHistoryModal({ open, account, onClose }: PhaseHistoryModalProps) {
  const { getAllTradesForAccount, setViewingPhase } = useApp()
  const navigate = useNavigate()
  const [active, setActive] = useState(0)

  const phases = useMemo<PhaseView[]>(() => {
    if (!account) return []
    const allTrades = getAllTradesForAccount(account)
    const history = effectivePhaseHistory(account)
    const views: PhaseView[] = []

    history.forEach((record, index) => {
      const previous = index > 0 ? history[index - 1] : null
      const startKey = previous?.endedAt ?? ''
      const phaseTrades = allTrades.filter((trade) => {
        const key = tradePhaseKey(trade)
        return (!startKey || key > startKey) && (!record.endedAt || key <= record.endedAt)
      })
      views.push({
        stage: record.stage,
        startingBalance: record.startingBalance,
        rules: record.rules,
        trades: phaseTrades,
        stats: computeStats(phaseTrades, record.startingBalance),
        status: record.status,
        endedAt: record.endedAt,
        current: false,
      })
    })

    const currentTrades = tradesForPhase(account, allTrades)
    const currentStats = computeStats(currentTrades, getStartingBalance(account))
    const evaluation = evaluateAccount(account, currentStats)
    views.push({
      stage: account.stage,
      startingBalance: getStartingBalance(account),
      rules: account.rules,
      trades: currentTrades,
      stats: currentStats,
      status: evaluation.status,
      endedAt: '',
      current: true,
    })

    return views
  }, [account, getAllTradesForAccount])

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, phases.length - 1))
  }, [open, account?.id, phases.length])

  const phase = phases[Math.min(active, Math.max(0, phases.length - 1))]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      className="phase-history-modal"
      labelledBy="phase-history-title"
    >
      <header className="modal-head">
        <div className="modal-mark accent">
          <History size={17} />
        </div>
        <div className="modal-head-copy">
          <span className="modal-eyebrow">Account history</span>
          <h2 className="modal-title" id="phase-history-title">
            Phase results
          </h2>
          <p className="modal-sub">
            {account ? titleFor(account) : 'Account'} · every completed phase stays available here.
          </p>
        </div>
        <ModalClose onClick={onClose} />
      </header>

      <div className="modal-body phase-history-body">
        {!phase ? (
          <p className="phase-history-empty">No phases recorded yet.</p>
        ) : (
          <>
            <div className="phase-tabs" role="tablist" aria-label="Account phases">
              {phases.map((item, index) => (
                <button
                  key={`${item.stage}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  className={cn('phase-tab', index === active && 'is-active')}
                  onClick={() => setActive(index)}
                >
                  <span>{item.stage}</span>
                  <Badge tone={statusTone(item.status)} dot>
                    {statusLabel(item.status)}
                  </Badge>
                </button>
              ))}
            </div>

            <div className="phase-summary-head">
              <div>
                <span className="phase-summary-stage">
                  {phase.stage}
                  {phase.current && <em>Current phase</em>}
                </span>
                <span className="phase-summary-range">
                  <CalendarDays size={12} /> {rangeLabel(phase.trades)}
                </span>
              </div>
              <Badge tone={statusTone(phase.status)} dot>
                {statusLabel(phase.status)}
              </Badge>
            </div>

            <div className="phase-kpis">
              <div className="phase-kpi">
                <span>Net P&amp;L</span>
                <b className={cn('num', phase.stats.net > 0 && 'is-pos', phase.stats.net < 0 && 'is-neg')}>
                  {signedMoney(phase.stats.net)}
                </b>
              </div>
              <div className="phase-kpi">
                <span>Trades</span>
                <b className="num">{phase.stats.count}</b>
              </div>
              <div className="phase-kpi">
                <span>Win rate</span>
                <b className="num">{plainPercent(phase.stats.winRate, 0)}%</b>
              </div>
              <div className="phase-kpi">
                <span>Profitable days</span>
                <b className="num">
                  {phase.stats.profitableDays}
                  <small>{phase.rules.days ? ` / ${phase.rules.days}` : ''}</small>
                </b>
              </div>
            </div>

            <div className="phase-rules">
              <PhaseRule
                label="Profit target"
                value={
                  phase.rules.target > 0
                    ? `${signedMoney(phase.stats.net)} / ${formatMoney((phase.startingBalance * phase.rules.target) / 100)}`
                    : 'No target'
                }
                pct={
                  phase.rules.target > 0
                    ? (phase.stats.net / ((phase.startingBalance * phase.rules.target) / 100)) * 100
                    : 0
                }
                done={phase.rules.target > 0 && phase.stats.net >= (phase.startingBalance * phase.rules.target) / 100}
              />
              <PhaseRule
                label="Max loss used"
                value={
                  phase.rules.max > 0
                    ? `${formatMoney(Math.max(0, phase.startingBalance - phase.stats.net))} buffer`
                    : 'No limit'
                }
                pct={
                  phase.rules.max > 0
                    ? (Math.max(0, phase.startingBalance - phase.stats.net) /
                        ((phase.startingBalance * phase.rules.max) / 100)) *
                      100
                    : 0
                }
                done={false}
              />
              <PhaseRule
                label="Profitable days"
                value={
                  phase.rules.days > 0
                    ? `${phase.stats.profitableDays} / ${phase.rules.days} days`
                    : 'Not required'
                }
                pct={phase.rules.days > 0 ? (phase.stats.profitableDays / phase.rules.days) * 100 : 0}
                done={phase.rules.days > 0 && phase.stats.profitableDays >= phase.rules.days}
              />
            </div>

            <div className="phase-trades">
              <div className="phase-trades-head">
                <span>Trade history</span>
                <span>P&amp;L</span>
              </div>
              {phase.trades.length ? (
                phase.trades
                  .slice()
                  .sort((a, b) => tradePhaseKey(b).localeCompare(tradePhaseKey(a)))
                  .map((trade) => (
                    <div className="phase-trade-row" key={trade.id}>
                      <span className="phase-trade-date">{formatNumericDate(trade.date)}</span>
                      <span className="phase-trade-symbol">{trade.ticker}</span>
                      <Badge tone={trade.side === 'LONG' ? 'pos' : 'neg'}>
                        {trade.side === 'LONG' ? 'Long' : 'Short'}
                      </Badge>
                      <span className="phase-trade-volume">{trade.volume || '—'} lots</span>
                      <b className={cn('num', trade.pnl >= 0 ? 'is-pos' : 'is-neg')}>
                        {signedMoney(trade.pnl)}
                      </b>
                    </div>
                  ))
              ) : (
                <p className="phase-trades-empty">No trades in this phase.</p>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="modal-foot">
        <span className="spacer" />
        <Button variant="ghost" type="button" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          type="button"
          iconRight={<ArrowRight size={14} />}
          onClick={() => {
            setViewingPhase(phase?.current ? null : active)
            onClose()
            navigate('/metrics')
          }}
          disabled={!phase}
        >
          View metrics &amp; journal
        </Button>
      </footer>
    </Modal>
  )
}

function PhaseRule({
  label,
  value,
  pct,
  done,
}: {
  label: string
  value: string
  pct: number
  done: boolean
}) {
  return (
    <div className={cn('phase-rule', done && 'is-done')}>
      <div className="phase-rule-top">
        <span>{label}</span>
        <b className="num">{value}</b>
      </div>
      <div className="phase-rule-track">
        <i style={{ width: `${clampPct(pct)}%` }} />
      </div>
    </div>
  )
}
