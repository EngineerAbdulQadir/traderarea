import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Download,
  ListOrdered,
  PencilLine,
  Plus,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountPill } from '@/components/ui/AccountPill'
import type { Trade } from '@/lib/types'
import { downloadCsv, TRADE_CSV_HEADER, tradeCsvRows } from '@/lib/csv'
import { formatPrice, formatR, formatTime, plainPercent, signedMoney } from '@/lib/format'
import { formatShortDate as formatDate, todayISO } from '@/lib/dates'
import { computeStats, DASHBOARD_RANGES, filterByRange, getStartingBalance } from '@/lib/stats'
import { tradeGrade } from '@/lib/trades'
import { cn } from '@/lib/cn'

type SideFilter = 'all' | 'LONG' | 'SHORT'
type ResultFilter = 'all' | 'win' | 'loss'
type SortKey = 'date' | 'ticker' | 'side' | 'volume' | 'entry' | 'exit' | 'pnl' | 'r' | 'playbook'
type SortDir = 'asc' | 'desc'

const PER_PAGE = 14

const SIDE_OPTIONS: { value: SideFilter; label: string }[] = [
  { value: 'all', label: 'All sides' },
  { value: 'LONG', label: 'Long' },
  { value: 'SHORT', label: 'Short' },
]

const RESULT_OPTIONS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'All results' },
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
]

const RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last 12 months' },
]

function sortValue(trade: Trade, key: SortKey): string | number {
  if (key === 'date') return `${trade.date} ${trade.openTime || ''}`
  if (key === 'r') return Number(trade.rMultiple) || 0
  if (key === 'ticker' || key === 'side' || key === 'playbook') return String(trade[key]).toLowerCase()
  return Number(trade[key]) || 0
}

export function EntriesPage() {
  const {
    activeAccount,
    activeTrades,
    activeIsDemo,
    openTradeEditor,
    openDayReview,
    showToast,
  } = useApp()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [side, setSide] = useState<SideFilter>('all')
  const [result, setResult] = useState<ResultFilter>('all')
  const [setup, setSetup] = useState('all')
  const [rangeKey, setRangeKey] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const setupOptions = useMemo(() => {
    const books = new Set<string>()
    activeTrades.forEach((trade) => {
      if (trade.playbook && trade.playbook !== '—') books.add(trade.playbook)
    })
    return Array.from(books).sort()
  }, [activeTrades])

  useEffect(() => {
    if (setup !== 'all' && !setupOptions.includes(setup)) setSetup('all')
  }, [setup, setupOptions])

  const filtered = useMemo(() => {
    let list = filterByRange(activeTrades, rangeKey)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((trade) =>
        `${trade.ticker} ${trade.instrument} ${trade.playbook} ${(trade.tags || []).join(' ')}`
          .toLowerCase()
          .includes(q),
      )
    }
    if (side !== 'all') list = list.filter((trade) => trade.side === side)
    if (result === 'win') list = list.filter((trade) => trade.pnl > 0)
    if (result === 'loss') list = list.filter((trade) => trade.pnl < 0)
    if (setup !== 'all') list = list.filter((trade) => trade.playbook === setup)

    return list.slice().sort((a, b) => {
      const left = sortValue(a, sortKey)
      const right = sortValue(b, sortKey)
      const comparison = left < right ? -1 : left > right ? 1 : 0
      return comparison * (sortDir === 'asc' ? 1 : -1)
    })
  }, [activeTrades, query, side, result, setup, rangeKey, sortKey, sortDir])

  useEffect(() => {
    setPage(0)
  }, [query, side, result, setup, rangeKey, sortKey, sortDir])

  const starting = getStartingBalance(activeAccount)
  const stats = useMemo(() => computeStats(filtered, starting), [filtered, starting])
  const averageR = filtered.length
    ? filtered.reduce((sum, trade) => sum + (Number(trade.rMultiple) || 0), 0) / filtered.length
    : 0

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, pageCount - 1)
  const from = currentPage * PER_PAGE
  const rows = filtered.slice(from, from + PER_PAGE)
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === rangeKey)?.label ?? 'All time'
  const hasFilters = !!query.trim() || side !== 'all' || result !== 'all' || setup !== 'all' || rangeKey !== 'all'

  const clearFilters = () => {
    setQuery('')
    setSide('all')
    setResult('all')
    setSetup('all')
    setRangeKey('all')
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((direction) => (direction === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'ticker' || key === 'side' || key === 'playbook' ? 'asc' : 'desc')
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown size={10} className="sort-idle" />
    return sortDir === 'asc' ? <ArrowUp size={10} className="sort-ind" /> : <ArrowDown size={10} className="sort-ind" />
  }

  const exportCsv = () => {
    if (!filtered.length) {
      showToast('Nothing to export', 'No trades match the current filters.', 'info')
      return
    }
    downloadCsv(`trades-${todayISO()}.csv`, TRADE_CSV_HEADER, tradeCsvRows(filtered))
    showToast('Export ready', `${filtered.length} trade${filtered.length === 1 ? '' : 's'} saved to CSV.`)
  }

  if (!activeAccount) {
    return (
      <div className="page">
        <PageHeader
          kicker="Trade ledger"
          title="Entries"
          subtitle="Every closed trade, searchable, filterable and ready to review."
        />
        <EmptyState
          icon={<ListOrdered size={22} />}
          eyebrow="No active workspace"
          title="Your ledger needs an account"
          description="Start a challenge or open a demo workspace, then every trade you log lands here with the context around it."
          actions={
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={() => navigate('/portfolio')}>
              Go to accounts
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page entries-page">
      <PageHeader
        kicker="Trade ledger"
        title="Entries"
        subtitle={
          <>
            Every trade on <b className="page-subject">{activeAccount.firm}</b>, searchable and sortable.
            {activeIsDemo ? ' Showing sample data — add a trade to start your own journal.' : ''}
          </>
        }
        actions={
          <>
            {activeIsDemo && <Badge tone="violet">Sample data</Badge>}
            <AccountPill account={activeAccount} onClick={() => navigate('/portfolio')} />
            <Button variant="secondary" size="sm" iconLeft={<Download size={13} />} onClick={exportCsv}>
              Export
            </Button>
            <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => openTradeEditor()}>
              Log trade
            </Button>
          </>
        }
      />

      <section className="entries-summary card">
        <div className="entries-summary-lead">
          <span className="card-kicker"><i className="dot" /> Filtered snapshot</span>
          <div className="entries-summary-value-row">
            <strong className={cn('entries-summary-value num', stats.net > 0 && 'is-pos', stats.net < 0 && 'is-neg')}>
              {signedMoney(stats.net)}
            </strong>
            <span className="entries-summary-delta">
              {filtered.length} trade{filtered.length === 1 ? '' : 's'} in view
            </span>
          </div>
          <p>
            {rangeLabel}
            {hasFilters ? ' · filtered selection' : ' · full ledger'}
            {activeIsDemo ? ' · sample workspace' : ''}
          </p>
        </div>
        <div className="entries-summary-grid">
          <div>
            <span>Trades</span>
            <b className="num">{filtered.length}</b>
          </div>
          <div>
            <span>Win rate</span>
            <b className="num">{filtered.length ? `${plainPercent(stats.winRate, 0)}%` : '—'}</b>
          </div>
          <div>
            <span>Profit factor</span>
            <b className="num">{stats.grossLoss ? stats.pf.toFixed(2) : stats.grossProfit ? '∞' : '—'}</b>
          </div>
          <div>
            <span>Average R</span>
            <b className={cn('num', averageR > 0 && 'is-pos', averageR < 0 && 'is-neg')}>
              {filtered.length ? formatR(averageR) : '—'}
            </b>
          </div>
        </div>
      </section>

      <Card className="entries-toolbar">
        <div className="entries-toolbar-row">
          <div className="search-input entries-search">
            <SearchX size={14} />
            <input
              className="input"
              type="search"
              placeholder="Search symbol, setup or tag…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search entries"
            />
            {query && (
              <button className="entries-search-clear" type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
          <Segmented label="Filter by side" value={side} options={SIDE_OPTIONS} onChange={setSide} size="sm" />
          <Segmented label="Filter by result" value={result} options={RESULT_OPTIONS} onChange={setResult} size="sm" />
          <label className="entries-select">
            <SlidersHorizontal size={12} />
            <select
              className="select"
              value={rangeKey}
              onChange={(event) => setRangeKey(event.target.value)}
              aria-label="Filter by range"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <select
            className="select entries-setup-select"
            value={setup}
            onChange={(event) => setSetup(event.target.value)}
            aria-label="Filter by setup"
          >
            <option value="all">All setups</option>
            {setupOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      <Card className="entries-table-card">
        <div className="entries-table-head">
          <div className="entries-table-copy">
            <span className="card-kicker"><i className="dot" /> Ledger</span>
            <h3 className="card-title">{hasFilters ? 'Filtered entries' : 'All entries'}</h3>
            <p className="card-sub">
              {filtered.length
                ? `${filtered.length} trade${filtered.length === 1 ? '' : 's'} · ${rangeLabel}`
                : 'No trades in this selection'}
            </p>
          </div>
          <div className="entries-table-actions">
            <span className="entries-count num">
              {filtered.length ? `${from + 1}–${from + rows.length} of ${filtered.length}` : '0 trades'}
            </span>
          </div>
        </div>

        {rows.length ? (
          <>
            <div className="table-wrap entries-table-wrap">
              <table className="data-table entries-table">
                <thead>
                  <tr>
                    <th data-sort onClick={() => toggleSort('date')}>Date {sortIcon('date')}</th>
                    <th data-sort onClick={() => toggleSort('ticker')}>Symbol {sortIcon('ticker')}</th>
                    <th data-sort onClick={() => toggleSort('side')}>Side {sortIcon('side')}</th>
                    <th className="r" data-sort onClick={() => toggleSort('volume')}>Qty {sortIcon('volume')}</th>
                    <th className="r" data-sort onClick={() => toggleSort('entry')}>Entry {sortIcon('entry')}</th>
                    <th className="r" data-sort onClick={() => toggleSort('exit')}>Exit {sortIcon('exit')}</th>
                    <th className="r" data-sort onClick={() => toggleSort('pnl')}>Net P&amp;L {sortIcon('pnl')}</th>
                    <th className="r" data-sort onClick={() => toggleSort('r')}>R {sortIcon('r')}</th>
                    <th data-sort onClick={() => toggleSort('playbook')}>Setup {sortIcon('playbook')}</th>
                    <th>Grade</th>
                    <th className="r"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((trade) => {
                    const grade = tradeGrade(trade)
                    const secondary = trade.instrument.split(' · ')[1] || ''
                    const r = Number(trade.rMultiple) || 0
                    return (
                      <tr
                        key={trade.id}
                        className="entry-row"
                        tabIndex={0}
                        onClick={() => openDayReview(trade.date)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openDayReview(trade.date)
                          }
                        }}
                      >
                        <td>
                          <b className="entry-date">{formatDate(trade.date)}</b>
                          <small>{formatTime(trade.openTime)}{trade.closeTime ? `–${formatTime(trade.closeTime)}` : ''}</small>
                        </td>
                        <td>
                          <span className="entry-symbol">
                            <b className="t-sym">{trade.ticker}</b>
                            {trade.manual && <span className="entry-manual">Manual</span>}
                          </span>
                          <small>{secondary}</small>
                        </td>
                        <td>
                          <span className={cn('side-pill', trade.side === 'LONG' ? 'is-long' : 'is-short')}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="r num">{Number(trade.volume).toLocaleString('en-US')}</td>
                        <td className="r num">{formatPrice(trade.entry)}</td>
                        <td className="r num">{formatPrice(trade.exit)}</td>
                        <td className={cn('r num entry-pnl', trade.pnl > 0 && 'is-pos', trade.pnl < 0 && 'is-neg')}>
                          <b>{signedMoney(trade.pnl)}</b>
                        </td>
                        <td className={cn('r num', r > 0 && 'is-pos', r < 0 && 'is-neg')}>{formatR(r)}</td>
                        <td><span className="entry-setup">{trade.playbook}</span></td>
                        <td><span className={`exec-tag is-${grade.key}`}>{grade.label}</span></td>
                        <td className="r">
                          {trade.manual ? (
                            <button
                              className="entry-edit"
                              type="button"
                              title="Edit trade"
                              aria-label={`Edit ${trade.ticker} trade`}
                              onClick={(event) => {
                                event.stopPropagation()
                                openTradeEditor({ trade })
                              }}
                            >
                              <PencilLine size={13} />
                            </button>
                          ) : (
                            <span className="entry-open"><ArrowRight size={13} /></span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="entries-pagination">
              <span>
                Showing <b className="num">{from + 1}–{from + rows.length}</b> of <b className="num">{filtered.length}</b>
                <i aria-hidden="true" />
                <button className="entries-jump" type="button" onClick={clearFilters} disabled={!hasFilters}>
                  {hasFilters ? 'Reset filters' : 'All trades'}
                </button>
              </span>
              <div className="entries-page-buttons">
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<ArrowLeft size={12} />}
                  disabled={currentPage <= 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  Prev
                </Button>
                <span className="entries-page-count num">{currentPage + 1} / {pageCount}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconRight={<ArrowRight size={12} />}
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="entries-empty">
            <span className="entries-empty-icon"><SearchX size={19} /></span>
            <b>No trades match this view</b>
            <p>
              {hasFilters
                ? 'Try another symbol, widen the date range or clear the filters.'
                : 'Log your first trade to start building the ledger.'}
            </p>
            <div className="entries-empty-actions">
              {hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
              ) : (
                <Button variant="primary" size="sm" iconLeft={<Plus size={12} />} onClick={() => openTradeEditor()}>
                  Log trade
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {activeIsDemo && (
        <div className="demo-banner">
          <div className="demo-banner-icon"><Sparkles size={16} /></div>
          <div>
            <b>This ledger is a sample workspace.</b>
            <p>These trades are generated locally. Log your first real trade and the sample entries step aside for your own journal.</p>
          </div>
          <div className="demo-banner-actions">
            <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => openTradeEditor()}>
              Log first trade
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/notes')}>
              Browse notes
            </Button>
          </div>
        </div>
      )}

      <div className="entries-footnote">
        <span><ListOrdered size={12} /> {formatDate(todayISO())} · {activeAccount.firm}</span>
        <span>{DASHBOARD_RANGES[rangeKey]?.label ?? rangeLabel} · local data</span>
      </div>
    </div>
  )
}
