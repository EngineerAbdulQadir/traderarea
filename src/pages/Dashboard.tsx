import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Flame,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { EquityChart } from '@/components/charts/EquityChart'
import { DailyPnl } from '@/components/charts/DailyPnl'
import { Donut } from '@/components/charts/Donut'
import { ProfitFactorGauge } from '@/components/charts/ProfitFactorGauge'
import { DayStrip } from '@/components/charts/DayStrip'
import { RadarChart } from '@/components/charts/RadarChart'
import { Calendar } from '@/components/calendar/Calendar'
import { usePersistentState } from '@/hooks/usePersistentState'
import { STORAGE_KEYS } from '@/lib/persistence'
import { accountBadge, accountGradient, accountMetaCompact, titleFor } from '@/lib/accounts'
import {
  buildCumulativeSeries,
  buildInsights,
  buildRules,
  computeEdgeScore,
  computeStats,
  filterByDateRange,
  getStartingBalance,
} from '@/lib/stats'
import {
  addDays,
  dateToISO,
  formatDateRange,
  formatShortDate,
  isValidISODate,
  startOfDay,
  todayISO,
} from '@/lib/dates'
import {
  formatMoney,
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
    activeNotes,
    openTradeEditor,
    openChallenge,
    addDemoAccount,
    openDayReview,
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
  const rangeLabel = formatDateRange(rangeFrom, rangeTo)
  const [chartMode, setChartMode] = useState<'equity' | 'drawdown'>('equity')
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
  const cumulative = useMemo(() => buildCumulativeSeries(stats), [stats])
  const rules = useMemo(
    () => (activeAccount ? buildRules(activeAccount, allStats) : null),
    [activeAccount, allStats],
  )
  const edge = useMemo(
    () => (activeAccount ? computeEdgeScore(activeAccount, stats) : null),
    [activeAccount, stats],
  )
  const insights = useMemo(() => buildInsights(rangeTrades, stats), [rangeTrades, stats])

  if (!activeAccount) {
    return (
      <div className="page">
        <PageHeader
          title="Journal"
          subtitle="Your trading command center. Open a challenge to unlock metrics, risk tracking and a day-by-day journal."
        />
        <EmptyState
          icon={<TrendingUp size={22} />}
          eyebrow="First run"
          title="Build your performance terminal"
          description="Start a challenge to track rules, equity and every decision. Or load a demo workspace and explore the terminal with sample trades."
          actions={
            <>
              <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
                Start a challenge
              </Button>
              <Button variant="secondary" iconLeft={<Sparkles size={14} />} onClick={addDemoAccount}>
                Load demo workspace
              </Button>
            </>
          }
        />
      </div>
    )
  }

  const returnPct = starting ? (stats.net / starting) * 100 : 0

  const targetAmount = starting * ((Number(activeAccount.rules?.target) || 0) / 100)
  const planTarget = targetAmount > 0 ? targetAmount : starting * 0.1
  const gainSpan = planTarget || 1
  const lossLimitPct = Number(activeAccount.rules?.max) || 10
  const lossLimitAmount = starting * (lossLimitPct / 100)
  const lossSpan = lossLimitAmount || 1
  const balance = starting + allStats.net
  const currentVsBase = balance - starting
  const markerPct =
    currentVsBase === 0
      ? 50
      : currentVsBase > 0
        ? 50 + Math.min(1, currentVsBase / gainSpan) * 50
        : 50 - Math.min(1, Math.abs(currentVsBase) / lossSpan) * 50
  const fillLeft = Math.min(50, markerPct)
  const fillWidth = Math.abs(markerPct - 50)
  const lossBuffer = Math.max(0, lossLimitAmount + currentVsBase)
  const targetGap = Math.max(0, planTarget - currentVsBase)
  const targetReached = currentVsBase >= planTarget
  const earliest = activeTrades.reduce(
    (min, trade) => (trade.date && trade.date < min ? trade.date : min),
    activeAccount.startDate || rangeFrom,
  )
  const heroMeta = accountMetaCompact(activeAccount)
  const recentDays = stats.dayRows.slice(-20)
  const recentNet = recentDays.reduce((sum, day) => sum + day.pnl, 0)
  const recentAverage = recentDays.length ? recentNet / recentDays.length : 0
  const bestDay = recentDays.length ? recentDays.reduce((best, day) => (day.pnl > best.pnl ? day : best)) : null
  const worstDay = recentDays.length ? recentDays.reduce((worst, day) => (day.pnl < worst.pnl ? day : worst)) : null
  const equal = stats.avgLoss === 0

  return (
    <div className="page dashboard-page">
      <PageHeader
        title="Journal"
        actions={
          <>
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
            <Button variant="secondary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Challenge
            </Button>
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={() => openTradeEditor()}>
              Log trade
            </Button>
          </>
        }
      />

      <section className="hero-card card card-glow" data-hero={heroVariant}>
        <div className="hero-main">
          <div className="hero-top">
            <button className="hero-account" type="button" onClick={() => navigate('/accounts')}>
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
              <b className="num">{formatMoney(balance)}</b>
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
                <b className="num">{stats.count ? signedMoney(stats.bestDay!.pnl) : '$0'}</b>
              </div>
              <div className="hero-day-stat">
                <span className="hero-day-stat-label">
                  <ArrowDownRight size={12} className="hero-day-arrow is-neg" />
                  Worst day
                </span>
                <b className="num">{stats.count ? signedMoney(stats.worstDay!.pnl) : '$0'}</b>
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
            <strong className="metric-value num">{plainPercent(stats.winRate)}<small>%</small></strong>
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
              <span className="is-pos">+{formatMoney(stats.grossProfit)} profit</span>
              <i aria-hidden="true" />
              <span className="is-neg">−{formatMoney(stats.grossLoss)} loss</span>
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
            <strong className="metric-value num">{plainPercent(stats.dayWinRate)}<small>%</small></strong>
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
              <span className="is-pos">Win {stats.avgWin ? formatMoney(stats.avgWin) : '—'}</span>
              <i aria-hidden="true" />
              <span className="is-neg">Loss {stats.avgLoss ? `−${formatMoney(stats.avgLoss)}` : '—'}</span>
              <i aria-hidden="true" />
              <span>B/E {stats.count && stats.avgWl > 0 ? `${plainPercent((1 / (1 + stats.avgWl)) * 100, 0)}%` : '—'}</span>
            </span>
          </div>
          <Donut
            segments={[
              { label: 'Avg win', value: stats.avgWin, color: 'var(--chart-blue)' },
              { label: 'Avg loss', value: stats.avgLoss, color: 'var(--chart-blue-muted)' },
            ]}
            size={78}
            thickness={8}
            centerLabel={stats.avgWin + stats.avgLoss > 0 ? `${plainPercent((stats.avgWin / (stats.avgWin + stats.avgLoss)) * 100, 0)}%` : '—'}
            centerSub="win share"
          />
        </Card>
      </section>

      <div className="dash-grid">
        <Card className="chart-card equity-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Performance curve</span>
              <h3 className="card-title">Equity &amp; drawdown</h3>
              <p className="card-sub">{rangeLabel} · {stats.dayRows.length} sessions</p>
            </div>
            <div className="card-actions">
              <Segmented
                label="Chart view"
                value={chartMode}
                options={[
                  { value: 'equity', label: 'Equity' },
                  { value: 'drawdown', label: 'Underwater' },
                ]}
                onChange={setChartMode}
                size="sm"
              />
            </div>
          </div>
          <div className="chart-split">
            <div className="equity-summary">
              <span>{chartMode === 'equity' ? 'Net return' : 'Max drawdown'}</span>
              <strong className={cn('num', chartMode === 'equity' ? (stats.net >= 0 ? 'is-pos' : 'is-neg') : 'is-neg')}>
                {chartMode === 'equity'
                  ? signedMoney(stats.net)
                  : stats.maxDrawdown
                    ? `−${formatMoney(stats.maxDrawdown)}`
                    : '$0'}
              </strong>
              <em>{chartMode === 'equity' ? `${signedPercent(returnPct)} on starting capital` : `${stats.maxDrawdownPct.toFixed(2)}% from peak`}</em>
            </div>
            <EquityChart points={cumulative} mode={chartMode} height={236} />
          </div>
          <div className="chart-chips">
            <span>Peak <b className="num">{signedMoney(cumulative.length ? Math.max(0, ...cumulative.map((point) => point.peak)) : 0)}</b></span>
            <span>Max drawdown <b className="num is-neg">{stats.maxDrawdown ? `−${formatMoney(stats.maxDrawdown)}` : '$0'}</b></span>
            <span>Recovery <b className="num">{stats.recovery > 0 ? `${stats.recovery.toFixed(2)}×` : '—'}</b></span>
            <span>Profit factor <b className="num">{stats.grossLoss ? `${stats.pf.toFixed(2)}×` : stats.grossProfit ? '∞' : '—'}</b></span>
          </div>
        </Card>

      </div>

      <div className="dash-grid">
        <Card className="chart-card daily-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Session flow</span>
              <h3 className="card-title">Daily P&amp;L</h3>
              <p className="card-sub">
                {recentDays.length
                  ? `${recentDays.length} sessions · ${formatShortDate(recentDays[0].date)} — ${formatShortDate(recentDays[recentDays.length - 1].date)}`
                  : 'No sessions in this range'}
              </p>
            </div>
            <div className="card-head-value">
              <b className={cn('num', recentNet > 0 && 'is-pos', recentNet < 0 && 'is-neg')}>{signedMoney(recentNet)}</b>
              <span>recent net</span>
            </div>
          </div>
          <DailyPnl days={recentDays} height={224} />
          <div className="chart-chips">
            <span>Best <b className="num is-pos">{bestDay ? signedMoney(bestDay.pnl) : '—'}</b>{bestDay && <em>{formatShortDate(bestDay.date)}</em>}</span>
            <span>Worst <b className="num is-neg">{worstDay ? signedMoney(worstDay.pnl) : '—'}</b>{worstDay && <em>{formatShortDate(worstDay.date)}</em>}</span>
            <span>Avg / session <b className={cn('num', recentAverage > 0 && 'is-pos', recentAverage < 0 && 'is-neg')}>{signedMoney(recentAverage)}</b></span>
          </div>
        </Card>

        <Card className="rules-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Challenge guardrails</span>
              <h3 className="card-title">Risk &amp; progress</h3>
              <p className="card-sub">Full account history</p>
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
                    <span>{row.name}</span>
                    <b className="num">
                      {row.value} {row.limit && <small>{row.limit}</small>}
                    </b>
                  </div>
                  <div className="rule-track">
                    <i style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }} />
                  </div>
                  <div className="rule-sub">
                    <span>{row.left}</span>
                    <span>{row.right}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rules-empty">
                <ShieldCheck size={18} />
                <p>No rules configured for this account yet.</p>
              </div>
            )}
          </div>
          <div className="rules-foot">
            <Target size={13} />
            <span>
              {rules?.rows.length
                ? 'Limits update from the full account history, not the selected range.'
                : 'Add a challenge with rules to track your buffers.'}
            </span>
          </div>
        </Card>
      </div>

      <div className="dash-grid">
        <Card className="calendar-card">
          <Calendar trades={activeTrades} notes={activeNotes} onOpenDay={openDayReview} />
        </Card>

        <div className="dash-side-stack">
          <Card className="balance-card">
            <div className="card-head">
              <div className="card-head-copy">
                <span className="card-kicker"><i className="dot" /> Account value</span>
                <h3 className="card-title">Balance from base</h3>
              </div>
              <Wallet size={16} className="card-icon" />
            </div>
            <div className="balance-value-row">
              <strong className={cn('num', balance < starting && 'is-neg')}>{formatMoney(balance)}</strong>
              <span className={cn('balance-delta', allStats.net >= 0 ? 'is-pos' : 'is-neg')}>
                {signedPercent(starting ? (allStats.net / starting) * 100 : 0)}
              </span>
            </div>
            <div className="balance-stats">
              <div><span>Starting</span><b className="num">{formatMoney(starting)}</b></div>
              <div><span>Net since base</span><b className={cn('num', allStats.net > 0 && 'is-pos', allStats.net < 0 && 'is-neg')}>{signedMoney(allStats.net)}</b></div>
              <div><span>Return</span><b className={cn('num', allStats.net >= 0 ? 'is-pos' : 'is-neg')}>{signedPercent(starting ? (allStats.net / starting) * 100 : 0)}</b></div>
            </div>
            <div className="balance-range">
              <div className="balance-range-labels">
                <div className="balance-range-label is-loss">
                  <span>Loss limit</span>
                  <b className="num">−{formatMoney(lossLimitAmount)}</b>
                </div>
                <div className="balance-range-label is-base">
                  <span>Base</span>
                  <b className="num">{formatMoney(starting)}</b>
                </div>
                <div className="balance-range-label is-gain">
                  <span>{targetAmount > 0 ? 'Target' : 'Milestone'}</span>
                  <b className="num">+{formatMoney(planTarget)}</b>
                </div>
              </div>
              <div className={cn('balance-range-track', currentVsBase < 0 ? 'is-loss' : 'is-gain')}>
                <span className="balance-range-half is-loss" aria-hidden="true" />
                <span className="balance-range-half is-gain" aria-hidden="true" />
                <span
                  className="balance-range-fill"
                  style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
                  aria-hidden="true"
                />
                <span className="balance-range-base" aria-hidden="true" />
                <span
                  className="balance-range-marker"
                  style={{ left: `${markerPct}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="balance-range-foot">
                <span>{lossBuffer > 0 ? `${formatMoney(lossBuffer)} buffer` : 'At loss limit'}</span>
                <span>Current <b className="num">{formatMoney(balance)}</b></span>
                <span>
                  {targetReached
                    ? 'Target reached'
                    : `${formatMoney(targetGap)} to ${targetAmount > 0 ? 'target' : 'milestone'}`}
                </span>
              </div>
            </div>
          </Card>

          <Card className="insights-card">
            <div className="card-head">
              <div className="card-head-copy">
                <span className="card-kicker"><i className="dot" /> Pattern engine</span>
                <h3 className="card-title">What the data says</h3>
              </div>
              <Sparkles size={15} className="card-icon" />
            </div>
            <div className="insight-list">
              {insights.length ? (
                insights.slice(0, 3).map((insight) => (
                  <div className={cn('insight', insight.tone === 'pos' ? 'is-pos' : insight.tone === 'neg' ? 'is-neg' : 'is-warn')} key={`${insight.tag}-${insight.title}`}>
                    <span className="insight-tag">
                      {insight.tone === 'pos' ? <Flame size={10} /> : <Sparkles size={10} />}
                      {insight.tag}
                    </span>
                    <b>{insight.title}</b>
                    <p>{insight.text}</p>
                  </div>
                ))
              ) : (
                <div className="insight-empty">
                  <Sparkles size={18} />
                  <p>Not enough trades in this range to surface patterns. Keep logging.</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="insights-link"
              iconRight={<ArrowUpRight size={13} />}
              onClick={() => navigate('/stats')}
            >
              Open full statistics
            </Button>
          </Card>
        </div>
      </div>

      {activeIsDemo && (
        <div className="demo-banner">
          <div className="demo-banner-icon"><Sparkles size={16} /></div>
          <div>
            <b>You're exploring a sample workspace.</b>
            <p>These trades are generated locally to show how Trader Area works. Log your first real trade and the sample data steps aside for your own journal.</p>
          </div>
          <div className="demo-banner-actions">
            <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => openTradeEditor()}>
              Log first trade
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/entries')}>
              Browse entries
            </Button>
          </div>
        </div>
      )}

      <div className="dash-footnote">
        <span>Today is {today}</span>
        <span>All data lives on this device</span>
      </div>
    </div>
  )
}
