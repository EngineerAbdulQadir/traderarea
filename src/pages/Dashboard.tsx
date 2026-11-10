import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Plus,
  ShieldCheck,
  BarChart3,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { PnlHeatmap } from '@/components/charts/PnlHeatmap'
import { Donut } from '@/components/charts/Donut'
import { ProfitFactorGauge } from '@/components/charts/ProfitFactorGauge'
import { DayStrip } from '@/components/charts/DayStrip'
import { AvgWinLossChart } from '@/components/charts/AvgWinLossChart'
import { RadarChart } from '@/components/charts/RadarChart'
import { usePersistentState } from '@/hooks/usePersistentState'
import { STORAGE_KEYS } from '@/lib/persistence'
import { accountBadge, accountGradient, accountMetaCompact, titleFor } from '@/lib/accounts'
import {
  buildRules,
  computeEdgeScore,
  computeStats,
  filterByDateRange,
  getStartingBalance,
} from '@/lib/stats'
import {
  addDays,
  dateToISO,
  isValidISODate,
  startOfDay,
  todayISO,
} from '@/lib/dates'
import {
  formatUsd2,
  plainPercent,
  signedMoney,
  signedPercent,
} from '@/lib/format'
import { cn } from '@/lib/cn'

function ruleToneClass(tone: 'is-done' | 'is-info' | 'is-ok' | 'is-warn' | 'is-danger') {
  return tone
}

export function DashboardPage() {
  const {
    activeAccount,
    activeTrades,
    activeIsDemo,
    openChallenge,
    openDayReview,
    viewingPhaseIndex,
    setViewingPhase,
  } = useApp()
  const navigate = useNavigate()
  const defaultFrom = useMemo(() => dateToISO(addDays(startOfDay(new Date()), -29)), [])
  const defaultTo = todayISO()
  const [storedFrom, setStoredFrom] = usePersistentState(STORAGE_KEYS.dashboardFrom, defaultFrom)
  const [storedTo, setStoredTo] = usePersistentState(STORAGE_KEYS.dashboardTo, defaultTo)
  const today = todayISO()
  const from = isValidISODate(storedFrom) ? storedFrom : defaultFrom
  const to = isValidISODate(storedTo) ? storedTo : defaultTo
  const rangeTo = to > today ? today : to
  const rangeFrom = from > rangeTo ? rangeTo : from
  // Temporary design-preview switch: /?hero=a|b|c
  const heroVariant = (() => {
    if (typeof window === 'undefined') return 'a'
    const value = new URLSearchParams(window.location.search).get('hero')
    return value === 'b' || value === 'c' ? value : 'a'
  })()

  const starting = getStartingBalance(activeAccount)
  const rangeTrades = useMemo(
    () => filterByDateRange(activeTrades, rangeFrom, rangeTo),
    [activeTrades, rangeFrom, rangeTo],
  )
  const stats = useMemo(() => computeStats(rangeTrades, starting), [rangeTrades, starting])
  const allStats = useMemo(() => computeStats(activeTrades, starting), [activeTrades, starting])
  const rules = useMemo(
    () => (activeAccount ? buildRules(activeAccount, allStats) : null),
    [activeAccount, allStats],
  )
  const edge = useMemo(
    () => (activeAccount ? computeEdgeScore(activeAccount, stats) : null),
    [activeAccount, stats],
  )

  if (!activeAccount) {
    return (
      <div className="page">
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="Build your performance terminal"
          description="Start a challenge to track rules, equity and every decision."
          actions={
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Start a challenge
            </Button>
          }
        />
      </div>
    )
  }

  const returnPct = starting ? (stats.net / starting) * 100 : 0

  const balance = starting + allStats.net
  const earliest = activeTrades.reduce(
    (min, trade) => (trade.date && trade.date < min ? trade.date : min),
    activeAccount.startDate || rangeFrom,
  )
  const heroMeta = accountMetaCompact(activeAccount)
  const equal = stats.avgLoss === 0

  return (
    <div className="page dashboard-page">
      <PageHeader
        className="dashboard-toolbar"
        actions={
          <DateRangePicker
            from={rangeFrom}
            to={rangeTo}
            minDate={earliest}
            maxDate={today}
            onChange={(nextFrom, nextTo) => {
              setStoredFrom(nextFrom)
              setStoredTo(nextTo)
            }}
          />
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

      <section className="hero-card card card-glow" data-hero={heroVariant}>
        <div className="hero-main">
          <div className="hero-top">
            <button className="hero-account" type="button" onClick={() => navigate('/portfolio')}>
              <span className="hero-avatar-wrap">
                <AccountAvatar
                  badge={accountBadge(activeAccount)}
                  gradient={accountGradient(activeAccount)}
                  size="md"
                />
                <i className="hero-status-dot" aria-hidden="true" />
              </span>
              <span className="hero-account-copy">
                <b>{titleFor(activeAccount)}</b>
                <span className="hero-account-meta">
                  <span>{heroMeta}</span>
                  <span className="hero-meta-sep" aria-hidden="true" />
                  <span className="hero-stage-text">{activeAccount.stage}</span>
                  {activeIsDemo && (
                    <>
                      <span className="hero-meta-sep" aria-hidden="true" />
                      <span className="hero-demo-flag">Sample</span>
                    </>
                  )}
                </span>
              </span>
              <ChevronRight size={14} className="hero-account-arrow" />
            </button>
            <div className="hero-balance">
              <span>Balance</span>
              <b className="num">{formatUsd2(balance)}</b>
            </div>
          </div>

          <div className="hero-value-block">
            <div className={cn('hero-pnl', stats.net > 0 && 'is-pos', stats.net < 0 && 'is-neg')}>
              <div className="hero-pnl-row">
                <strong className="hero-pnl-value num">{signedMoney(stats.net)}</strong>
                <span className={cn('hero-pnl-delta', returnPct >= 0 ? 'is-pos' : 'is-neg')}>
                  {returnPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {signedPercent(returnPct)}
                </span>
              </div>
            </div>
            <div className="hero-day-stats">
              <div className="hero-day-stat">
                <span className="hero-day-stat-label">
                  <ArrowUpRight size={12} className="hero-day-arrow is-pos" />
                  Best day
                </span>
                <b className="num">{stats.bestDay ? signedMoney(stats.bestDay.pnl) : '$0.00'}</b>
              </div>
              <div className="hero-day-stat">
                <span className="hero-day-stat-label">
                  <ArrowDownRight size={12} className="hero-day-arrow is-neg" />
                  Worst day
                </span>
                <b className="num">{stats.worstDay ? signedMoney(stats.worstDay.pnl) : '$0.00'}</b>
              </div>
            </div>
          </div>

        </div>

        <div className="hero-viz hero-viz-edge">
          <RadarChart components={edge?.components ?? []} hasData={!!edge?.hasData} size={216} />
          <div className="hero-edge-score">
            <div className="hero-edge-score-head">
              <span>Your Eze Score</span>
              <b className="num">
                {edge?.hasData ? edge.total : 0}
                <em>/ 100</em>
              </b>
            </div>
            <div className="hero-edge-score-track">
              <i style={{ width: `${edge?.hasData ? Math.max(0, Math.min(100, edge.total)) : 0}%` }} />
            </div>
          </div>
        </div>


      </section>

      <section className="dash-kpis">
        <Card className="metric-card">
          <div className="metric-copy">
            <span className="metric-label">Trade win rate</span>
            <strong className="metric-value num">{plainPercent(stats.winRate, 1)}<small>%</small></strong>
            <span className="metric-sub">
              {stats.count
                ? stats.winRate >= 60
                  ? 'Strong hit rate'
                  : stats.winRate >= 50
                    ? 'Steady hit rate'
                    : 'Room to improve'
                : 'No closed trades'}
            </span>
            <span className="metric-foot">
              <span>{stats.wins}W · {stats.losses}L{stats.be ? ` · ${stats.be}BE` : ''}</span>
              <i aria-hidden="true" />
              <span>{stats.count} closed</span>
            </span>
          </div>
          <Donut
            segments={[
              { label: 'Wins', value: stats.wins, color: 'var(--chart-blue)' },
              { label: 'Losses', value: stats.losses, color: 'var(--chart-blue-soft)' },
              { label: 'Breakeven', value: stats.be, color: 'var(--chart-neutral)' },
            ]}
            size={82}
            thickness={7}
            centerLabel={stats.count ? String(stats.wins) : '—'}
            centerSub="wins"
          />
        </Card>

        <Card className="metric-card">
          <div className="metric-copy">
            <span className="metric-label">Profit factor</span>
            <strong className="metric-value num">
              {stats.grossLoss ? stats.pf.toFixed(2) : stats.grossProfit ? '∞' : '0.00'}
            </strong>
            <span className="metric-sub">
              {stats.count
                ? stats.pf >= 2
                  ? 'Elite edge'
                  : stats.pf >= 1.5
                    ? 'Strong edge'
                    : stats.pf >= 1
                      ? 'Marginal edge'
                      : 'Below break-even'
                : 'No closed trades'}
            </span>
            <span className="metric-foot">
              <span className="is-pos">+{formatUsd2(stats.grossProfit)} profit</span>
              <i aria-hidden="true" />
              <span className="is-neg">−{formatUsd2(stats.grossLoss)} loss</span>
            </span>
          </div>
          <ProfitFactorGauge
            value={stats.pf}
            hasProfit={stats.grossProfit > 0}
            hasLoss={stats.grossLoss > 0}
          />
        </Card>

        <Card className="metric-card">
          <div className="metric-copy">
            <span className="metric-label">Day win rate</span>
            <strong className="metric-value num">{plainPercent(stats.dayWinRate, 1)}<small>%</small></strong>
            <span className="metric-sub">
              {stats.dayRows.length
                ? stats.dayWinRate >= 60
                  ? 'Strong rhythm'
                  : stats.dayWinRate >= 50
                    ? 'Steady rhythm'
                    : 'Choppy rhythm'
                : 'No sessions'}
            </span>
            <span className="metric-foot">
              <span className="is-pos">{stats.greenDays} green days</span>
              <i aria-hidden="true" />
              <span className="is-neg">{stats.redDays} red days</span>
            </span>
          </div>
          <DayStrip days={stats.dayRows} />
        </Card>

        <Card className="metric-card">
          <div className="metric-copy">
            <span className="metric-label">Avg win / loss</span>
            <strong className="metric-value num">
              {equal ? '∞' : stats.avgWl.toFixed(2)}
              <small>×</small>
            </strong>
            <span className="metric-sub">
              {stats.count
                ? stats.avgWl >= 2
                  ? 'Asymmetric payoff'
                  : stats.avgWl >= 1
                    ? 'Balanced payoff'
                    : 'Negative payoff'
                : 'No closed trades'}
            </span>
            <span className="metric-foot">
              <span className="is-pos">Win {stats.avgWin ? formatUsd2(stats.avgWin) : '—'}</span>
              <i aria-hidden="true" />
              <span className="is-neg">Loss {stats.avgLoss ? `−${formatUsd2(stats.avgLoss)}` : '—'}</span>
              <i aria-hidden="true" />
              <span>B/E {stats.count && stats.avgWl > 0 ? `${plainPercent((1 / (1 + stats.avgWl)) * 100, 1)}%` : '—'}</span>
            </span>
          </div>
          <AvgWinLossChart
            avgWin={stats.avgWin}
            avgLoss={stats.avgLoss}
            avgWl={stats.avgWl}
            count={stats.count}
          />
        </Card>
      </section>

      <Card className="chart-card pnl-heat-card">
        <PnlHeatmap days={allStats.dayRows} to={rangeTo} onOpenDay={openDayReview} />
      </Card>

      <div className="dash-grid dash-single">
        <Card className="rules-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker">Rules</span>
            </div>
            {rules && (
              <Badge tone={rules.tone === 'danger' ? 'neg' : rules.tone === 'warn' ? 'warn' : rules.tone === 'done' ? 'pos' : 'accent'} dot>
                {rules.status}
              </Badge>
            )}
          </div>
          <div className="rules-list">
            {rules?.rows.length ? (
              rules.rows.map((row) => (
                <div className={cn('rule-row', ruleToneClass(row.tone))} key={row.name}>
                  <div className="rule-top">
                    <span className="rule-name">{row.name}</span>
                    <span className="rule-figure">
                      <b className="num">{row.value}</b>
                      {row.limit && <small>{row.limit}</small>}
                    </span>
                  </div>
                  <div className="rule-track">
                    <i style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }} />
                  </div>
                  <span className="rule-note">{row.left}</span>
                </div>
              ))
            ) : (
              <div className="rules-empty">
                <ShieldCheck size={18} />
                <p>No rules configured for this account yet.</p>
              </div>
            )}
          </div>
        </Card>

      </div>

      <div className="dash-footnote">
        <span>Today is {today}</span>
        <span>All data lives on this device</span>
      </div>
    </div>
  )
}
