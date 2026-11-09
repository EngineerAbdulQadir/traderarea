import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Clock3,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountPill } from '@/components/ui/AccountPill'
import { BarList } from '@/components/charts/BarList'
import { ColumnChart } from '@/components/charts/ColumnChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { RHistogram } from '@/components/charts/RHistogram'
import { usePersistentState } from '@/hooks/usePersistentState'
import { STORAGE_KEYS } from '@/lib/persistence'
import {
  avgOf,
  buildInsights,
  computeStats,
  DASHBOARD_RANGES,
  filterByRange,
  getStartingBalance,
  groupStats,
  hourLabel,
  pfStr,
  tradeDow,
  WEEKDAYS,
  WD_SHORT,
  type GroupStats,
} from '@/lib/stats'
import { tradeGrade, tradeHoldMinutes, tradeHour } from '@/lib/trades'
import {
  formatHold,
  formatMoney,
  formatR,
  plainPercent,
  signedMoney,
  signedPercent,
} from '@/lib/format'
import { cn } from '@/lib/cn'

const RANGE_OPTIONS = [
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '180', label: '6M' },
  { value: '365', label: '12M' },
  { value: 'all', label: 'All' },
]

function PerfTable({ map, head }: { map: Map<string | number, GroupStats>; head: string }) {
  const rows = Array.from(map.values()).sort((a, b) => b.net - a.net).slice(0, 8)
  if (!rows.length) return <div className="chart-empty">No data in this range</div>
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.net)))
  return (
    <div className="table-wrap">
      <table className="data-table compact-table">
        <thead>
          <tr>
            <th>{head}</th>
            <th className="r">Trades</th>
            <th className="r">Win %</th>
            <th className="r">PF</th>
            <th className="r">Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.key)}>
              <td>
                <b className="t-sym">{String(row.key)}</b>
                <span className="mini-bar"><i className={row.net >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.max(3, (Math.abs(row.net) / max) * 100)}%` }} /></span>
              </td>
              <td className="r num">{row.count}</td>
              <td className="r num">{plainPercent(row.winRate, 0)}%</td>
              <td className="r num">{pfStr(row)}</td>
              <td className={cn('r num', row.net >= 0 ? 'is-pos' : 'is-neg')}>
                <b>{signedMoney(row.net)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatsPage() {
  const { activeAccount, activeTrades, activeIsDemo, openTradeEditor } = useApp()
  const navigate = useNavigate()
  const [storedRange, setStoredRange] = usePersistentState(STORAGE_KEYS.statsRange, 'all')
  const rangeKey = DASHBOARD_RANGES[storedRange] ? storedRange : 'all'

  const starting = getStartingBalance(activeAccount)
  const trades = useMemo(() => filterByRange(activeTrades, rangeKey), [activeTrades, rangeKey])
  const stats = useMemo(() => computeStats(trades, starting), [trades, starting])
  const insights = useMemo(() => buildInsights(trades, stats), [trades, stats])

  const model = useMemo(() => {
    const dowMap = groupStats(trades, tradeDow)
    const dowDays = [1, 2, 3, 4, 5, ...(dowMap.has(6) ? [6] : []), ...(dowMap.has(0) ? [0] : [])]
    const dowItems = dowDays.map((day) => {
      const group = dowMap.get(day)
      return {
        label: WEEKDAYS[day],
        value: group?.net ?? 0,
        sub: group ? `${group.count} trades · ${plainPercent(group.winRate, 0)}% win` : 'no trades',
      }
    })

    const hourMap = groupStats(trades, tradeHour)
    const knownHours = Array.from(hourMap.keys()).map(Number)
    const hourItems: { label: string; value: number; sub: string }[] = []
    if (knownHours.length) {
      const lo = Math.min(...knownHours)
      const hi = Math.max(...knownHours)
      for (let hour = lo; hour <= hi; hour++) {
        const group = hourMap.get(hour)
        hourItems.push({
          label: hourLabel(hour),
          value: group?.net ?? 0,
          sub: group ? `${group.count} trades · ${plainPercent(group.winRate, 0)}% win` : 'no trades',
        })
      }
    }

    const symbols = groupStats(trades, (trade) => (trade.ticker && trade.ticker !== '—' ? trade.ticker : null))
    const setups = groupStats(trades, (trade) => (trade.playbook === '—' ? null : trade.playbook))
    const sides = groupStats(trades, (trade) => trade.side)
    const grades = groupStats(trades, (trade) => tradeGrade(trade).key)

    const long = sides.get('LONG')
    const short = sides.get('SHORT')
    const longCount = long?.count ?? 0
    const shortCount = short?.count ?? 0
    const splitTotal = Math.max(1, longCount + shortCount)

    const holds = (list: typeof trades) =>
      avgOf(list.map(tradeHoldMinutes).filter((value): value is number => value !== null))
    const averageHold = holds(trades)
    const averageR = trades.length
      ? trades.reduce((sum, trade) => sum + (Number(trade.rMultiple) || 0), 0) / trades.length
      : 0
    const tradesPerDay = stats.dayRows.length ? stats.count / stats.dayRows.length : 0

    let bestWinStreak = 0
    let worstLossStreak = 0
    let winRun = 0
    let lossRun = 0
    trades.forEach((trade) => {
      if (trade.pnl > 0) {
        winRun += 1
        lossRun = 0
      } else if (trade.pnl < 0) {
        lossRun += 1
        winRun = 0
      } else {
        winRun = 0
        lossRun = 0
      }
      bestWinStreak = Math.max(bestWinStreak, winRun)
      worstLossStreak = Math.max(worstLossStreak, lossRun)
    })
    let greenRun = 0
    let bestGreenRun = 0
    stats.dayRows.forEach((day) => {
      if (day.pnl > 0) {
        greenRun += 1
        bestGreenRun = Math.max(bestGreenRun, greenRun)
      } else {
        greenRun = 0
      }
    })
    const currentStreak = winRun ? `${winRun} win${winRun === 1 ? '' : 's'}` : lossRun ? `${lossRun} loss${lossRun === 1 ? '' : 'es'}` : '—'

    const rValues = trades.map((trade) => Number(trade.rMultiple) || 0)
    const sloppy = grades.get('bad')

    return {
      dowItems,
      hourItems,
      symbols,
      setups,
      sides,
      grades,
      long,
      short,
      longCount,
      shortCount,
      splitTotal,
      averageHold,
      averageR,
      tradesPerDay,
      bestWinStreak,
      worstLossStreak,
      currentStreak,
      bestGreenRun,
      holdAll: averageHold,
      holdWins: holds(trades.filter((trade) => trade.pnl > 0)),
      holdLosses: holds(trades.filter((trade) => trade.pnl < 0)),
      rValues,
      sloppy,
    }
  }, [trades, stats])

  if (!activeAccount) {
    return (
      <div className="page">
        <PageHeader kicker="Pattern engine" title="Statistics" subtitle="Timing, markets and behaviour — once there is a journal to read." />
        <EmptyState
          icon={<Activity size={22} />}
          eyebrow="No active workspace"
          title="Statistics need trades"
          description="Start a challenge to open a journal, then log trades. Trader Area will surface your best hours, markets and habits."
          actions={
            <Button variant="primary" onClick={() => navigate('/portfolio')} iconRight={<ArrowUpRight size={14} />}>
              Go to accounts
            </Button>
          }
        />
      </div>
    )
  }

  const kpis = [
    {
      label: 'Net P&L',
      value: signedMoney(stats.net),
      sub: `${signedPercent(starting ? (stats.net / starting) * 100 : 0)} on ${formatMoney(starting)}`,
      tone: stats.net > 0 ? 'pos' : stats.net < 0 ? 'neg' : '',
    },
    {
      label: 'Win rate',
      value: `${plainPercent(stats.winRate)}%`,
      sub: `${stats.wins}W · ${stats.losses}L · ${stats.be}BE`,
      tone: '',
    },
    {
      label: 'Profit factor',
      value: stats.grossLoss ? stats.pf.toFixed(2) : stats.grossProfit ? '∞' : '—',
      sub: `${formatMoney(stats.grossProfit)} won · ${formatMoney(stats.grossLoss)} lost`,
      tone: stats.pf >= 1.5 ? 'pos' : stats.count && stats.pf < 1 ? 'neg' : '',
    },
    {
      label: 'Expectancy',
      value: stats.count ? signedMoney(stats.avgTrade) : '—',
      sub: `per trade · ${formatR(model.averageR)} average`,
      tone: stats.avgTrade > 0 ? 'pos' : stats.avgTrade < 0 ? 'neg' : '',
    },
    {
      label: 'Payoff ratio',
      value: stats.avgLoss ? `${stats.avgWl.toFixed(2)}×` : stats.avgWin ? '∞' : '—',
      sub: `avg win ${stats.avgWin ? formatMoney(stats.avgWin) : '—'} · avg loss ${stats.avgLoss ? formatMoney(stats.avgLoss) : '—'}`,
      tone: '',
    },
    {
      label: 'Avg hold time',
      value: model.averageHold ? formatHold(model.averageHold) : '—',
      sub: `${model.tradesPerDay.toFixed(1)} trades per session`,
      tone: '',
    },
    {
      label: 'Max drawdown',
      value: stats.maxDrawdown ? `−${formatMoney(stats.maxDrawdown)}` : '$0',
      sub: `${stats.maxDrawdownPct.toFixed(1)}% from equity peak`,
      tone: stats.maxDrawdown ? 'neg' : '',
    },
    {
      label: 'Green days',
      value: stats.dayRows.length ? `${stats.greenDays} / ${stats.dayRows.length}` : '—',
      sub: `${plainPercent(stats.dayWinRate, 0)}% day win rate`,
      tone: '',
    },
  ]

  const longShare = (model.longCount / model.splitTotal) * 100
  const shortShare = (model.shortCount / model.splitTotal) * 100

  const sideCard = (side: 'LONG' | 'SHORT', group: GroupStats | undefined) => (
    <div className="side-block">
      <div className="side-block-top">
        <Badge tone={side === 'LONG' ? 'pos' : 'violet'}>{side}</Badge>
        <b className={cn('num', group && (group.net >= 0 ? 'is-pos' : 'is-neg'))}>
          {group ? signedMoney(group.net) : '—'}
        </b>
      </div>
      {group ? (
        <dl className="side-stats">
          <div><dt>Trades</dt><dd className="num">{group.count}</dd></div>
          <div><dt>Win rate</dt><dd className="num">{plainPercent(group.winRate, 0)}%</dd></div>
          <div><dt>Profit factor</dt><dd className="num">{pfStr(group)}</dd></div>
          <div><dt>Avg trade</dt><dd className={cn('num', group.avg > 0 ? 'is-pos' : group.avg < 0 ? 'is-neg' : '')}>{signedMoney(group.avg)}</dd></div>
          <div><dt>Avg R</dt><dd className={cn('num', group.avgR > 0 ? 'is-pos' : group.avgR < 0 ? 'is-neg' : '')}>{formatR(group.avgR)}</dd></div>
        </dl>
      ) : (
        <p className="side-empty">No {side.toLowerCase()} trades in this range</p>
      )}
    </div>
  )

  return (
    <div className="page stats-page">
      <PageHeader
        kicker="Pattern engine"
        title="Statistics"
        subtitle="Timing, markets, execution and streaks. The details behind the equity curve."
        actions={
          <>
            {activeIsDemo && <Badge tone="violet">Sample data</Badge>}
            <AccountPill account={activeAccount} onClick={() => navigate('/portfolio')} />
            <Segmented
              label="Stats range"
              value={rangeKey}
              options={RANGE_OPTIONS}
              onChange={setStoredRange}
              size="sm"
            />
            <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => openTradeEditor()}>
              Log trade
            </Button>
          </>
        }
      />

      <section className="stats-kpis">
        {kpis.map((kpi) => (
          <Card className={cn('stat-kpi', kpi.tone && `t-${kpi.tone}`)} key={kpi.label}>
            <span className="stat-kpi-label"><i />{kpi.label}</span>
            <strong className={cn('stat-kpi-value num', kpi.tone === 'pos' && 'is-pos', kpi.tone === 'neg' && 'is-neg')}>{kpi.value}</strong>
            <span className="stat-kpi-sub">{kpi.sub}</span>
          </Card>
        ))}
      </section>

      <div className="stats-insights">
        {insights.length ? (
          insights.map((insight) => (
            <div
              className={cn(
                'insight-card',
                insight.tone === 'pos' ? 'is-pos' : insight.tone === 'neg' ? 'is-neg' : 'is-warn',
              )}
              key={`${insight.tag}-${insight.title}`}
            >
              <span className="insight-tag">
                {insight.tone === 'pos' ? <TrendingUp size={10} /> : insight.tone === 'neg' ? <TrendingDown size={10} /> : <Sparkles size={10} />}
                {insight.tag}
              </span>
              <b>{insight.title}</b>
              <p>{insight.text}</p>
            </div>
          ))
        ) : (
          <div className="insight-empty">
            <Sparkles size={18} />
            <p>Not enough trades in this range to find patterns yet.</p>
          </div>
        )}
      </div>

      <div className="stats-grid two">
        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Calendar rhythm</span>
              <h3 className="card-title">Results by weekday</h3>
              <p className="card-sub">Net P&amp;L across the trading week</p>
            </div>
          </div>
          <BarList items={model.dowItems} />
        </Card>

        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Session timing</span>
              <h3 className="card-title">Entry hour</h3>
              <p className="card-sub">Grouped by the hour a trade was opened</p>
            </div>
            <Clock3 size={15} className="card-icon" />
          </div>
          <ColumnChart items={model.hourItems} height={188} />
        </Card>
      </div>

      <Card className="stats-card heatmap-card">
        <div className="card-head">
          <div className="card-head-copy">
            <span className="card-kicker"><i className="dot" /> Edge map</span>
            <h3 className="card-title">When your edge shows up</h3>
            <p className="card-sub">Weekday × entry hour · darker means a larger result</p>
          </div>
        </div>
        <Heatmap trades={trades} />
      </Card>

      <div className="stats-grid two">
        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Market selection</span>
              <h3 className="card-title">Top symbols</h3>
              <p className="card-sub">Ranked by net P&amp;L</p>
            </div>
          </div>
          <PerfTable map={model.symbols} head="Symbol" />
        </Card>

        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Playbook</span>
              <h3 className="card-title">Top setups</h3>
              <p className="card-sub">Your highest-conviction patterns</p>
            </div>
          </div>
          <PerfTable map={model.setups} head="Setup" />
        </Card>
      </div>

      <div className="stats-grid two">
        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Direction</span>
              <h3 className="card-title">Long vs short</h3>
              <p className="card-sub">Where the asymmetry lives</p>
            </div>
          </div>
          <div className="side-grid">
            {sideCard('LONG', model.long)}
            {sideCard('SHORT', model.short)}
          </div>
          <div className="side-split">
            <i className="long" style={{ width: `${longShare}%` }} />
            <i className="short" style={{ width: `${shortShare}%` }} />
          </div>
          <div className="side-split-caption">
            <span>{plainPercent(longShare, 0)}% long · {model.longCount} trades</span>
            <span>{plainPercent(shortShare, 0)}% short · {model.shortCount} trades</span>
          </div>
        </Card>

        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Execution</span>
              <h3 className="card-title">Trade quality</h3>
              <p className="card-sub">From each trade's execution score</p>
            </div>
          </div>
          <div className="grades">
            {([
              ['good', 'Clean execution'],
              ['ok', 'Average execution'],
              ['bad', 'Sloppy execution'],
            ] as const).map(([key, label]) => {
              const group = model.grades.get(key)
              const share = trades.length ? ((group?.count ?? 0) / trades.length) * 100 : 0
              return (
                <div className="grade-row" key={key}>
                  <div className="grade-top">
                    <span className={`grade-pill ${key}`}>{label}</span>
                    <b className={cn('num', group && group.net > 0 && 'is-pos', group && group.net < 0 && 'is-neg')}>
                      {group ? signedMoney(group.net) : '—'}
                    </b>
                  </div>
                  <div className="grade-track">
                    <i className={key} style={{ width: `${share}%` }} />
                  </div>
                  <div className="grade-sub">
                    <span>{group?.count ?? 0} trades · {plainPercent(share, 0)}%</span>
                    <span>{group ? `${plainPercent(group.winRate, 0)}% win · ${signedMoney(group.avg)} avg` : '—'}</span>
                  </div>
                </div>
              )
            })}
            {model.sloppy && model.sloppy.net < 0 ? (
              <div className="grade-callout">
                <b>Cost of sloppy trades: {formatMoney(Math.abs(model.sloppy.net))}.</b>
                Without them your net would be {signedMoney(stats.net - model.sloppy.net)}.
              </div>
            ) : (
              <div className="grade-callout is-good">
                <b>Execution is not costing you.</b> Keep grading honestly so the signal stays useful.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="stats-grid two">
        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Risk distribution</span>
              <h3 className="card-title">R-multiple spread</h3>
              <p className="card-sub">How your risk translates into reward</p>
            </div>
          </div>
          <RHistogram values={model.rValues} />
        </Card>

        <Card className="stats-card">
          <div className="card-head">
            <div className="card-head-copy">
              <span className="card-kicker"><i className="dot" /> Behaviour</span>
              <h3 className="card-title">Streaks &amp; holding</h3>
              <p className="card-sub">Momentum and time in the trade</p>
            </div>
          </div>
          <div className="streak-tiles">
            <div><span>Best win streak</span><b className="num">{model.bestWinStreak} trades</b><em>consecutive winners</em></div>
            <div><span>Worst losing run</span><b className="num">{model.worstLossStreak} trades</b><em>consecutive losers</em></div>
            <div><span>Current streak</span><b className="num">{model.currentStreak}</b><em>most recent closes</em></div>
            <div><span>Best green-day run</span><b className="num">{model.bestGreenRun} days</b><em>in a row</em></div>
            <div><span>Avg hold · all</span><b className="num">{model.holdAll ? formatHold(model.holdAll) : '—'}</b><em>open to close</em></div>
            <div><span>Avg hold · winners</span><b className="num is-pos">{model.holdWins ? formatHold(model.holdWins) : '—'}</b><em>time in profit</em></div>
            <div><span>Avg hold · losers</span><b className="num is-neg">{model.holdLosses ? formatHold(model.holdLosses) : '—'}</b><em>time in drawdown</em></div>
            <div><span>Trades per session</span><b className="num">{model.tradesPerDay.toFixed(1)}</b><em>{stats.dayRows.length} sessions</em></div>
          </div>
        </Card>
      </div>

      <div className="stats-footnote">
        <span>
          <Activity size={12} /> {WD_SHORT[new Date().getDay()]} · {stats.count} closed trades analysed
        </span>
        <span>Range: {DASHBOARD_RANGES[rangeKey].label}</span>
      </div>
    </div>
  )
}
