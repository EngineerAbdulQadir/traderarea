import { Fragment, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarRange,
  Download,
  FileBarChart,
  Printer,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ColumnChart } from '@/components/charts/ColumnChart'
import { BarList } from '@/components/charts/BarList'
import { usePersistentState } from '@/hooks/usePersistentState'
import { STORAGE_KEYS } from '@/lib/persistence'
import {
  buildBreakdown,
  buildReportOverview,
  inBounds,
  REPORT_PERIODS,
  REPORT_TABS,
  reportBounds,
  rpTone,
  rpUsd,
  type ReportPeriod,
  type ReportTab,
} from '@/lib/reports'
import { computeStats, getStartingBalance, pfStr } from '@/lib/stats'
import { downloadCsv, TRADE_CSV_HEADER, tradeCsvRows } from '@/lib/csv'
import { formatNumericDate, parseISODate, todayISO } from '@/lib/dates'
import { formatMoney, plainPercent, signedMoney } from '@/lib/format'
import { titleFor } from '@/lib/accounts'
import { cn } from '@/lib/cn'

function reportTabClass(active: boolean) {
  return cn('report-tab', active && 'is-active')
}

export function ReportsPage() {
  const {
    accounts,
    getTradesForAccount,
    isDemo,
    showToast,
  } = useApp()
  const navigate = useNavigate()
  const [storedPeriod, setStoredPeriod] = usePersistentState(STORAGE_KEYS.reportPeriod, 'all')
  const [storedTab, setStoredTab] = usePersistentState(STORAGE_KEYS.reportTab, 'overview')
  const [storedAccount, setStoredAccount] = usePersistentState(STORAGE_KEYS.reportAccount, 'all')

  const period = (REPORT_PERIODS.some((option) => option.value === storedPeriod) ? storedPeriod : 'all') as ReportPeriod
  const tab = (REPORT_TABS.some((option) => option.id === storedTab) ? storedTab : 'overview') as ReportTab
  const accountFilter =
    storedAccount === 'all' || accounts.some((account) => account.id === storedAccount)
      ? storedAccount
      : 'all'

  useEffect(() => {
    if (storedAccount !== accountFilter) setStoredAccount(accountFilter)
  }, [accountFilter, setStoredAccount, storedAccount])

  const scope = useMemo(() => {
    const picked =
      accountFilter === 'all' ? accounts : accounts.filter((account) => account.id === accountFilter)
    const allTrades = picked
      .flatMap((account) => getTradesForAccount(account))
      .sort((a, b) => (a.date + a.openTime).localeCompare(b.date + b.openTime))
    const starting = picked.reduce((sum, account) => sum + getStartingBalance(account), 0)
    return {
      picked,
      trades: allTrades,
      starting,
      demo: picked.length > 0 && picked.every((account) => isDemo(account)),
    }
  }, [accountFilter, accounts, getTradesForAccount, isDemo])

  const bounds = useMemo(() => reportBounds(period), [period])
  const trades = useMemo(() => inBounds(scope.trades, bounds), [bounds, scope.trades])
  const stats = useMemo(() => computeStats(trades, scope.starting), [trades, scope.starting])
  const overview = useMemo(() => buildReportOverview(trades, scope.starting), [trades, scope.starting])
  const breakdown = useMemo(
    () => (tab === 'overview' ? null : buildBreakdown(tab, trades)),
    [tab, trades],
  )
  const activeTab = REPORT_TABS.find((option) => option.id === tab) ?? REPORT_TABS[0]

  const accountLabel =
    accountFilter === 'all'
      ? 'All accounts'
      : accounts.find((account) => account.id === accountFilter)
        ? titleFor(accounts.find((account) => account.id === accountFilter)!)
        : 'All accounts'

  const exportCsv = () => {
    if (!trades.length) {
      showToast('Nothing to export', 'No trades in this report period.', 'info')
      return
    }
    downloadCsv(`report-${tab}-${todayISO()}.csv`, TRADE_CSV_HEADER, tradeCsvRows(trades))
    showToast('Export ready', `${trades.length} trade${trades.length === 1 ? '' : 's'} saved to CSV.`)
  }

  const printReport = () => {
    window.print()
  }

  const monthItems = overview.monthRows.map((month) => {
    const parsed = parseISODate(`${month.key}-01`)
    return {
      label: parsed.toLocaleDateString('en-US', { month: 'short' }),
      value: month.net,
      sub: `${month.count} trades`,
    }
  })

  if (!accounts.length) {
    return (
      <div className="page">
        <PageHeader
          kicker="Performance reports"
          title="Reports"
          subtitle="Clean, exportable breakdowns of where your edge lives."
        />
        <EmptyState
          icon={<FileBarChart size={22} />}

          title="Reports need a workspace"
          description="Start a challenge or open a demo account. Report periods, breakdowns and exports will populate automatically."
          actions={
            <Button variant="primary" iconLeft={<Wallet size={14} />} onClick={() => navigate('/portfolio')}>
              Go to accounts
            </Button>
          }
        />
      </div>
    )
  }

  const breakdownRows = breakdown?.rows.filter((row) => row.group) ?? []
  const breakdownActive = breakdownRows.length > 0
  const breakdownChartItems = breakdown
    ? breakdown.style === 'rows'
      ? breakdownRows.map((row) => ({
          label: row.label,
          value: row.group?.net ?? 0,
          sub: `${row.group?.count ?? 0} trades · ${plainPercent(row.group?.winRate ?? 0, 0)}% win`,
        }))
      : breakdown.rows.map((row) => ({
          label: row.short,
          value: row.group?.net ?? 0,
          sub: row.group
            ? `${row.group.count} trades · ${plainPercent(row.group.winRate, 0)}% win`
            : 'no trades',
        }))
    : []
  const bestBreakdown = breakdownRows.length
    ? breakdownRows.reduce((best, row) => ((row.group?.net ?? -Infinity) > (best.group?.net ?? -Infinity) ? row : best))
    : null
  const worstBreakdown = breakdownRows.length
    ? breakdownRows.reduce((worst, row) => ((row.group?.net ?? Infinity) < (worst.group?.net ?? Infinity) ? row : worst))
    : null
  const maxBreakdownNet = Math.max(1, ...breakdownRows.map((row) => Math.abs(row.group?.net ?? 0)))
  const breakdownNote = breakdown
    ? [
        breakdown.note,
        breakdown.excluded
          ? `${breakdown.excluded} trade${breakdown.excluded === 1 ? ' has' : 's have'} no recorded time and ${breakdown.excluded === 1 ? 'is' : 'are'} left out.`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  return (
    <div className="page reports-page">
      <PageHeader
        kicker="Performance reports"
        title="Reports"
        subtitle="Clean, exportable breakdowns of where your edge lives — by time, market and execution."
        actions={
          <>
            {scope.demo && <Badge tone="violet">Sample data</Badge>}
            <select
              className="select report-select"
              value={accountFilter}
              onChange={(event) => setStoredAccount(event.target.value)}
              aria-label="Report account"
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{titleFor(account)}</option>
              ))}
            </select>
            <select
              className="select report-select"
              value={period}
              onChange={(event) => setStoredPeriod(event.target.value)}
              aria-label="Report period"
            >
              {REPORT_PERIODS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button variant="secondary" size="sm" iconLeft={<Download size={13} />} onClick={exportCsv}>
              CSV
            </Button>
            <Button variant="primary" size="sm" iconLeft={<Printer size={13} />} onClick={printReport}>
              Print
            </Button>
          </>
        }
      />

      <section className="report-scope report-print-head">
        <div className="report-scope-lead">
          <span className="summary-kicker"><CalendarRange size={11} /> Report scope</span>
          <b>{accountLabel}</b>
          <p>
            {bounds.label}
            {bounds.start ? ` · ${formatNumericDate(bounds.start)} — ${formatNumericDate(bounds.end)}` : ` · through ${formatNumericDate(bounds.end)}`}
          </p>
          <span className="report-scope-note">
            {scope.picked.length} account{scope.picked.length === 1 ? '' : 's'} · {trades.length} trade{trades.length === 1 ? '' : 's'}
            {scope.demo ? ' · sample workspace' : ''}
          </span>
        </div>
        <div className="report-scope-grid">
          <div>
            <span>Net P&amp;L</span>
            <b className={cn('num', stats.net > 0 && 'is-pos', stats.net < 0 && 'is-neg')}>{signedMoney(stats.net)}</b>
            <em>{scope.starting ? `${scope.starting ? plainPercent((stats.net / scope.starting) * 100) : '0.0'}% return` : 'no starting balance'}</em>
          </div>
          <div>
            <span>Win rate</span>
            <b className="num">{trades.length ? `${plainPercent(stats.winRate, 0)}%` : '—'}</b>
            <em>{trades.length ? `${stats.wins}W · ${stats.losses}L · ${stats.be}BE` : 'no trades'}</em>
          </div>
          <div>
            <span>Profit factor</span>
            <b className="num">{stats.grossLoss ? stats.pf.toFixed(2) : stats.grossProfit ? '∞' : '—'}</b>
            <em>{stats.grossProfit || stats.grossLoss ? `${formatMoney(stats.grossProfit)} / ${formatMoney(stats.grossLoss)}` : 'no outcomes'}</em>
          </div>
          <div>
            <span>Trading days</span>
            <b className="num">{stats.dayRows.length || '—'}</b>
            <em>{stats.dayRows.length ? `${stats.greenDays} green · ${stats.redDays} red` : 'no sessions'}</em>
          </div>
        </div>
      </section>

      <Card className="report-tools report-no-print">
        <div className="report-tabs-wrap">
          <nav className="report-tabs" aria-label="Report view">
            {REPORT_TABS.map((item, index) => {
              const previous = REPORT_TABS[index - 1]
              const separator = previous && previous.group !== item.group
              return (
                <Fragment key={item.id}>
                  {separator && <span className="report-tab-sep" aria-hidden="true" />}
                  <button
                    className={reportTabClass(tab === item.id)}
                    type="button"
                    onClick={() => setStoredTab(item.id)}
                    aria-current={tab === item.id ? 'page' : undefined}
                  >
                    {item.label}
                  </button>
                </Fragment>
              )
            })}
          </nav>
        </div>
        <div className="report-tools-meta">
          <span>{activeTab.label}</span>
          <span className="report-tools-dot" />
          <span>{trades.length} trades analysed</span>
        </div>
      </Card>

      {scope.demo && (
        <div className="report-demo-note report-no-print">
          <Sparkles size={13} />
          <span>These reports are built from sample trades. Add your own trades in Entries and they replace the sample data.</span>
        </div>
      )}

      {tab === 'overview' ? (
        <div className="report-overview">
          <div className="rp-triple">
            <div className="rp-cell">
              <span className="rp-cell-label">Best month</span>
              <span className={cn('rp-cell-value num', originalTone(overview.bestMonth?.net ?? 0))}>
                {overview.bestMonth ? rpUsd(overview.bestMonth.net, true) : '—'}
              </span>
              <span className="rp-cell-sub">
                {overview.bestMonth
                  ? `${parseISODate(`${overview.bestMonth.key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · ${overview.bestMonth.count} trades`
                  : 'no months yet'}
              </span>
            </div>
            <div className="rp-cell">
              <span className="rp-cell-label">Lowest month</span>
              <span className={cn('rp-cell-value num', originalTone(overview.worstMonth?.net ?? 0))}>
                {overview.worstMonth ? rpUsd(overview.worstMonth.net, true) : '—'}
              </span>
              <span className="rp-cell-sub">
                {overview.worstMonth
                  ? `${parseISODate(`${overview.worstMonth.key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · ${overview.worstMonth.count} trades`
                  : 'no months yet'}
              </span>
            </div>
            <div className="rp-cell">
              <span className="rp-cell-label">Average per month</span>
              <span className={cn('rp-cell-value num', originalTone(overview.avgMonth ?? 0))}>
                {overview.avgMonth === null ? '—' : rpUsd(overview.avgMonth, true)}
              </span>
              <span className="rp-cell-sub">
                {overview.monthRows.length} month{overview.monthRows.length === 1 ? '' : 's'} traded
              </span>
            </div>
            <div className="rp-cell">
              <span className="rp-cell-label">Expectancy</span>
              <span className={cn('rp-cell-value num', originalTone(stats.avgTrade))}>
                {stats.count ? rpUsd(stats.avgTrade, true) : '—'}
              </span>
              <span className="rp-cell-sub">per closed trade</span>
            </div>
          </div>

          <Card className="rp-card report-month-card">
            <div className="card-head">
              <div className="card-head-copy">
                <span className="card-kicker"><i className="dot" /> Monthly rhythm</span>
                <h3 className="card-title">Net P&amp;L by month</h3>
                <p className="card-sub">Every month in the selected period</p>
              </div>
            </div>
            <ColumnChart items={monthItems} height={190} emptyText="No months in this period" />
          </Card>

          <div className="report-grid two">
            <Card className="rp-card">
              <div className="card-head">
                <div className="card-head-copy">
                  <span className="card-kicker"><i className="dot" /> Trade statistics</span>
                  <h3 className="card-title">How the trades performed</h3>
                  <p className="card-sub">Outcome quality and holding time</p>
                </div>
              </div>
              <div className="rp-list">
                {overview.tradeRows.map((row) => (
                  <div className="rp-row" key={row.label}>
                    <span>{row.label}</span>
                    <b className={cn('num', row.tone)}>
                      {row.value}
                      {row.small && <small>{row.small}</small>}
                    </b>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rp-card">
              <div className="card-head">
                <div className="card-head-copy">
                  <span className="card-kicker"><i className="dot" /> Day statistics</span>
                  <h3 className="card-title">How the sessions behaved</h3>
                  <p className="card-sub">Daily consistency and outliers</p>
                </div>
              </div>
              <div className="rp-list">
                {overview.dayRows.map((row) => (
                  <div className="rp-row" key={row.label}>
                    <span>{row.label}</span>
                    <b className={cn('num', row.tone)}>
                      {row.value}
                      {row.small && <small>{row.small}</small>}
                    </b>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : breakdown ? (
        <div className="report-breakdown">
          <Card className="rp-card report-chart-card">
            <div className="card-head">
              <div className="card-head-copy">
                <span className="card-kicker"><i className="dot" /> {breakdown.title}</span>
                <h3 className="card-title">Net P&amp;L by {breakdown.title.toLowerCase()}</h3>
                <p className="card-sub">{activeTab.label} · {bounds.label}</p>
              </div>
            </div>
            {breakdownActive ? (
              breakdown.style === 'rows' ? (
                <BarList items={breakdownChartItems} maxItems={14} />
              ) : (
                <ColumnChart items={breakdownChartItems} height={226} />
              )
            ) : (
              <div className="report-empty-card">
                <b>No data for {breakdown.title.toLowerCase()}</b>
                <span>{trades.length ? 'These trades do not have this dimension recorded.' : 'No trades in this period.'}</span>
              </div>
            )}
            <div className="report-chips">
              {bestBreakdown && (
                <span className="st-chip">
                  Best <b>{bestBreakdown.label}</b>{' '}
                  <span className={rpTone(bestBreakdown.group?.net ?? 0)}>{signedMoney(bestBreakdown.group?.net ?? 0)}</span>
                </span>
              )}
              {worstBreakdown && bestBreakdown && worstBreakdown.label !== bestBreakdown.label && (
                <span className="st-chip">
                  Weakest <b>{worstBreakdown.label}</b>{' '}
                  <span className={rpTone(worstBreakdown.group?.net ?? 0)}>{signedMoney(worstBreakdown.group?.net ?? 0)}</span>
                </span>
              )}
              <span className="st-chip"><b>{trades.length}</b> trades analysed</span>
            </div>
          </Card>

          <Card className="rp-card report-table-card">
            <div className="card-head">
              <div className="card-head-copy">
                <span className="card-kicker"><i className="dot" /> Breakdown</span>
                <h3 className="card-title">{breakdown.title} detail</h3>
                <p className="card-sub">Ranked by net result</p>
              </div>
            </div>
            {breakdownActive ? (
              <div className="table-wrap">
                <table className="data-table compact-table report-table">
                  <thead>
                    <tr>
                      <th>{breakdown.head}</th>
                      <th className="r">Trades</th>
                      <th className="r">Win %</th>
                      <th className="r">Avg P&amp;L</th>
                      <th className="r">PF</th>
                      <th className="r">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownRows.map((row) => {
                      const group = row.group!
                      return (
                        <tr key={row.label}>
                          <td>
                            <b className="t-sym">{row.label}</b>
                            <span className="mini-bar">
                              <i
                                className={group.net >= 0 ? 'pos' : 'neg'}
                                style={{ width: `${Math.max(3, (Math.abs(group.net) / maxBreakdownNet) * 100)}%` }}
                              />
                            </span>
                          </td>
                          <td className="r num">{group.count}</td>
                          <td className="r num">{plainPercent(group.winRate, 0)}%</td>
                          <td className={cn('r num', rpTone(group.avg))}>{signedMoney(group.avg)}</td>
                          <td className="r num">{pfStr(group)}</td>
                          <td className={cn('r num', rpTone(group.net))}><b>{signedMoney(group.net)}</b></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="report-empty-card">
                <b>Nothing to break down</b>
                <span>There are no trades in this period.</span>
              </div>
            )}
            {breakdownNote && <p className="rp-note">{breakdownNote}</p>}
          </Card>
        </div>
      ) : null}

      <div className="reports-footnote">
        <span><FileBarChart size={12} /> {activeTab.label} · {bounds.label} · {trades.length} trades</span>
        <span>Reports are generated locally · {todayISO()}</span>
      </div>
    </div>
  )
}

function originalTone(value: number) {
  return rpTone(value)
}
