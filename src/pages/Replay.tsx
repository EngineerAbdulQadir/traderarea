import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  LogIn,
  LogOut,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  TrendingUp,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { ReplayChart } from '@/components/replay/ReplayChart'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented, type SegmentOption } from '@/components/ui/Segmented'
import { accountStageLabel, titleFor } from '@/lib/accounts'
import { formatShortDate } from '@/lib/dates'
import { formatR, formatTime, formatUsd2, signedMoney } from '@/lib/format'
import { readStorage, writeStorage } from '@/lib/storage'
import {
  buildRealMarketSequence,
  computeReplayExcursion,
  fetchRealMarketCandles,
  formatReplayPrice,
  formatUtcOffset,
  suggestReplayTimeframe,
  type ReplaySequence,
  type ReplayTimeframe,
  type ReplayTzPreference,
} from '@/lib/replay'
import type { Trade } from '@/lib/types'
import { cn } from '@/lib/cn'

type PickerFilter = 'all' | 'win' | 'loss'
type PlaybackSpeed = 1 | 2 | 4 | 8
type SideTab = 'details' | 'trades'

const PICKER_FILTERS: SegmentOption<PickerFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
]

const SPEED_OPTIONS: PlaybackSpeed[] = [1, 2, 4, 8]

const TZ_STORAGE_PREFIX = 'replay:tz:'

function readAccountTz(accountId: string): ReplayTzPreference {
  if (!accountId) return 'auto'
  const raw = readStorage(`${TZ_STORAGE_PREFIX}${accountId}`, 'auto')
  if (!raw || raw === 'auto') return 'auto'
  const num = Number(raw)
  return Number.isFinite(num) ? num : 'auto'
}

function writeAccountTz(accountId: string, tz: ReplayTzPreference): void {
  if (!accountId) return
  writeStorage(`${TZ_STORAGE_PREFIX}${accountId}`, String(tz))
}

function sortNewestFirst(trades: Trade[]): Trade[] {
  return trades
    .slice()
    .sort((a, b) => `${b.date} ${b.openTime || ''}`.localeCompare(`${a.date} ${a.openTime || ''}`))
}

export function ReplayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    allAccounts: accounts,
    activeAccount,
    activeTrades,
    getTradesForAccount,
    setActiveAccount,
    openChallenge,
    openTradeEditor,
  } = useApp()

  const accountTrades = useMemo(() => sortNewestFirst(activeTrades), [activeTrades])

  const alternateAccount = useMemo(
    () =>
      accounts.find(
        (acc) => acc.id !== activeAccount?.id && getTradesForAccount(acc).length > 0,
      ) ?? null,
    [accounts, activeAccount?.id, getTradesForAccount],
  )

  const requestedTradeId = searchParams.get('trade') || ''
  const [selectedTradeId, setSelectedTradeId] = useState('')
  const [sideTab, setSideTab] = useState<SideTab>('details')
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState<PickerFilter>('all')
  const [pickerSearch, setPickerSearch] = useState('')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [cursor, setCursor] = useState(0)

  const [timeframe, setTimeframe] = useState<ReplayTimeframe>('1m')
  const [tzPreference, setTzPreference] = useState<ReplayTzPreference>('auto')
  const lastAutoTradeRef = useRef('')

  const [sequence, setSequence] = useState<ReplaySequence | null>(null)
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const timelineRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const localUtcOffset = useMemo(() => {
    const mins = -new Date().getTimezoneOffset()
    return Math.round((mins / 60) * 2) / 2
  }, [])

  const tzOptions = useMemo(() => {
    const base: { value: string; label: string }[] = [
      { value: 'auto', label: 'Auto (match entry/exit)' },
      { value: '0', label: 'UTC (0)' },
      { value: '2', label: 'UTC+2 (MT4/5 EET)' },
      { value: '3', label: 'UTC+3 (MT4/5 EEST)' },
      { value: '1', label: 'UTC+1 (CET)' },
      { value: '-5', label: 'UTC-5 (New York EST)' },
      { value: '-4', label: 'UTC-4 (New York EDT)' },
      { value: '4', label: 'UTC+4 (Dubai GST)' },
      { value: '5.5', label: 'UTC+5:30 (IST)' },
      { value: '8', label: 'UTC+8 (Singapore/HK)' },
    ]
    if (!base.some((opt) => opt.value === String(localUtcOffset))) {
      base.push({
        value: String(localUtcOffset),
        label: `Local (${formatUtcOffset(localUtcOffset)})`,
      })
    }
    return base
  }, [localUtcOffset])

  useEffect(() => {
    setTzPreference(readAccountTz(activeAccount?.id ?? ''))
  }, [activeAccount?.id])

  useEffect(() => {
    if (!accountSwitcherOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountSwitcherOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountSwitcherOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [accountSwitcherOpen])

  useEffect(() => {
    if (!accountTrades.length) {
      setSelectedTradeId('')
      return
    }
    if (requestedTradeId && accountTrades.some((t) => t.id === requestedTradeId)) {
      setSelectedTradeId(requestedTradeId)
      return
    }
    if (!selectedTradeId || !accountTrades.some((t) => t.id === selectedTradeId)) {
      setSelectedTradeId(accountTrades[0].id)
    }
  }, [accountTrades, requestedTradeId, selectedTradeId])

  const selectedTrade = useMemo(
    () => accountTrades.find((t) => t.id === selectedTradeId) ?? accountTrades[0] ?? null,
    [accountTrades, selectedTradeId],
  )

  // Pick an appropriate default timeframe whenever a different trade is selected
  useEffect(() => {
    if (!selectedTrade) {
      lastAutoTradeRef.current = ''
      return
    }
    if (lastAutoTradeRef.current !== selectedTrade.id) {
      lastAutoTradeRef.current = selectedTrade.id
      setTimeframe(suggestReplayTimeframe(selectedTrade))
    }
  }, [selectedTrade])

  useEffect(() => {
    if (!selectedTrade) {
      setSequence(null)
      setFeedError(null)
      setFeedLoading(false)
      return
    }

    const controller = new AbortController()
    setPlaying(false)
    setFeedLoading(true)
    setFeedError(null)

    fetchRealMarketCandles(selectedTrade, timeframe, tzPreference, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        const next = buildRealMarketSequence(selectedTrade, payload, timeframe)
        setSequence(next)
        setCursor(Math.max(0, next.candles.length - 1))
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setSequence(null)
        setFeedError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch market candles for this trade.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setFeedLoading(false)
      })

    return () => controller.abort()
  }, [selectedTrade, timeframe, tzPreference, reloadNonce])

  const filteredPickerTrades = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return accountTrades.filter((trade) => {
      if (pickerFilter === 'win' && trade.pnl <= 0) return false
      if (pickerFilter === 'loss' && trade.pnl >= 0) return false
      if (!q) return true
      return `${trade.ticker} ${trade.instrument} ${trade.date} ${trade.openTime || ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [accountTrades, pickerFilter, pickerSearch])

  const selectTrade = useCallback(
    (tradeId: string) => {
      setSelectedTradeId(tradeId)
      setSideTab('details')
      setSearchParams({ trade: tradeId }, { replace: true })
    },
    [setSearchParams],
  )

  const handleSelectAccount = useCallback(
    (accountId: string) => {
      setAccountSwitcherOpen(false)
      setActiveAccount(accountId)
      setSearchParams({}, { replace: true })
    },
    [setActiveAccount, setSearchParams],
  )

  const handleTzChange = useCallback(
    (value: string) => {
      const next: ReplayTzPreference = value === 'auto' ? 'auto' : Number(value)
      setTzPreference(next)
      if (activeAccount?.id) {
        writeAccountTz(activeAccount.id, next)
      }
    },
    [activeAccount?.id],
  )

  useEffect(() => {
    if (!playing || !sequence || !sequence.candles.length) return
    const lastIndex = sequence.candles.length - 1
    if (cursor >= lastIndex) {
      setPlaying(false)
      return
    }
    const intervalMs = Math.round(640 / speed)
    const timer = window.setInterval(() => {
      setCursor((prev) => {
        if (prev >= lastIndex) {
          setPlaying(false)
          return prev
        }
        const next = prev + 1
        if (next >= lastIndex) setPlaying(false)
        return next
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [playing, sequence, speed, cursor])

  useEffect(() => {
    if (!sequence || !sequence.candles.length) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        setPlaying((prev) => {
          if (!prev && cursor >= sequence.candles.length - 1) {
            setCursor(0)
          }
          return !prev
        })
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setPlaying(false)
        setCursor((c) => Math.min(sequence.candles.length - 1, c + 1))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setPlaying(false)
        setCursor((c) => Math.max(0, c - 1))
      } else if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        setPlaying(false)
        setCursor(sequence.entryIndex)
      } else if (event.key.toLowerCase() === 'x') {
        event.preventDefault()
        setPlaying(false)
        setCursor(sequence.exitIndex)
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        setPlaying(false)
        setCursor(0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sequence, cursor])

  const excursion = useMemo(
    () => computeReplayExcursion(sequence, cursor),
    [sequence, cursor],
  )

  if (!activeAccount) {
    return (
      <div className="page replay-page">
        <EmptyState
          icon={<Layers size={22} />}
          title="Select or create an account first"
          description="Start a challenge or pick an existing account to replay its trades on real candlestick charts."
          actions={
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Start a challenge
            </Button>
          }
        />
      </div>
    )
  }

  if (!accountTrades.length || !selectedTrade) {
    return (
      <div className="page replay-page">
        <EmptyState
          icon={<TrendingUp size={22} />}
          eyebrow={titleFor(activeAccount)}
          title="No trades on this account yet"
          description="Log a trade or import your broker statement to replay its entry and exit bar by bar."
          actions={
            <>
              <Button
                variant="primary"
                iconLeft={<Plus size={14} />}
                onClick={() => openTradeEditor()}
              >
                Log trade
              </Button>
              {alternateAccount ? (
                <Button
                  variant="secondary"
                  onClick={() => setActiveAccount(alternateAccount.id)}
                >
                  Switch to {titleFor(alternateAccount)}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => navigate('/firms')}>
                  Manage accounts
                </Button>
              )}
            </>
          }
        />
      </div>
    )
  }

  const lastIndex = sequence ? Math.max(0, sequence.candles.length - 1) : 0
  const currentBar = sequence?.candles[Math.min(cursor, lastIndex)]
  const entryReached = sequence ? cursor >= sequence.entryIndex : false
  const exitReached = sequence ? cursor >= sequence.exitIndex : false
  const progressPct = lastIndex > 0 ? (cursor / lastIndex) * 100 : 100
  const entryPct = sequence && lastIndex > 0 ? (sequence.entryIndex / lastIndex) * 100 : 0
  const exitPct = sequence && lastIndex > 0 ? (sequence.exitIndex / lastIndex) * 100 : 0

  const togglePlay = () => {
    if (!sequence) return
    setPlaying((prev) => {
      if (!prev && cursor >= lastIndex) {
        setCursor(0)
      }
      return !prev
    })
  }

  const jumpTo = (index: number) => {
    setPlaying(false)
    setCursor(Math.max(0, Math.min(lastIndex, index)))
  }

  const seekFromClientX = (clientX: number) => {
    const el = timelineRef.current
    if (!el || lastIndex <= 0) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))
    jumpTo(Math.round(ratio * lastIndex))
  }

  const onTimelinePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    seekFromClientX(event.clientX)
  }

  const onTimelinePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    seekFromClientX(event.clientX)
  }

  const onTimelinePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) {
      draggingRef.current = false
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }
  }

  const formatPrice = (value: number | null | undefined) => {
    if (!value || value <= 0) return '—'
    const digits = sequence?.priceDigits ?? 2
    return formatReplayPrice(value, digits)
  }

  const livePhaseLabel = !sequence
    ? 'Ready'
    : !entryReached
      ? 'Pre-entry'
      : !exitReached
        ? `In position · bar ${cursor - sequence.entryIndex + 1}`
        : 'Closed'

  const transportFooter =
    sequence && sequence.candles.length > 0 ? (
      <div className="replay-transport">
        <div className="replay-bar-controls">
          <button
            type="button"
            className="replay-play-btn"
            onClick={togglePlay}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            title={playing ? 'Pause (Space)' : 'Play replay (Space)'}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            className="replay-ctrl-btn"
            title="Reset to start (R)"
            aria-label="Reset replay"
            onClick={() => jumpTo(0)}
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className="replay-ctrl-btn"
            title="Previous candle (←)"
            aria-label="Previous candle"
            disabled={cursor <= 0}
            onClick={() => jumpTo(cursor - 1)}
          >
            <SkipBack size={13} />
          </button>
          <button
            type="button"
            className="replay-ctrl-btn"
            title="Next candle (→)"
            aria-label="Next candle"
            disabled={cursor >= lastIndex}
            onClick={() => jumpTo(cursor + 1)}
          >
            <SkipForward size={13} />
          </button>
          <button
            type="button"
            className={cn(
              'replay-ctrl-btn',
              cursor === sequence.entryIndex && 'is-entry-active',
            )}
            onClick={() => jumpTo(sequence.entryIndex)}
            aria-label="Jump to Entry candle"
            title="Jump to Entry (E)"
          >
            <LogIn size={13} />
          </button>
          <button
            type="button"
            className={cn(
              'replay-ctrl-btn',
              cursor === sequence.exitIndex && 'is-exit-active',
            )}
            onClick={() => jumpTo(sequence.exitIndex)}
            aria-label="Jump to Exit candle"
            title="Jump to Exit (X)"
          >
            <LogOut size={13} />
          </button>
        </div>

        <div className="replay-bar-scrubber">
          <span className="replay-bar-time num">
            {currentBar ? `${currentBar.timeLabel} UTC` : sequence.openTimeLabel}
          </span>
          <div
            ref={timelineRef}
            className="replay-timeline"
            role="slider"
            tabIndex={0}
            aria-label="Candle replay timeline"
            aria-valuemin={0}
            aria-valuemax={lastIndex}
            aria-valuenow={cursor}
            onPointerDown={onTimelinePointerDown}
            onPointerMove={onTimelinePointerMove}
            onPointerUp={onTimelinePointerUp}
            onPointerCancel={onTimelinePointerUp}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                jumpTo(cursor + 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                jumpTo(cursor - 1)
              }
            }}
          >
            <div className="replay-timeline-track">
              <div
                className="replay-timeline-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span
              className="replay-timeline-pin is-entry"
              style={{ left: `${entryPct}%` }}
              title={`Entry (${sequence.openTimeLabel})`}
            />
            <span
              className={cn(
                'replay-timeline-pin is-exit',
                selectedTrade.pnl < 0 && 'is-loss',
              )}
              style={{ left: `${exitPct}%` }}
              title={`Exit (${sequence.closeTimeLabel})`}
            />
            <span
              className="replay-timeline-thumb"
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <span className="replay-bar-time num">
            {cursor + 1}/{sequence.candles.length}
          </span>
        </div>

        <div className="replay-speed-group" role="group" aria-label="Playback speed">
          {SPEED_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={cn('replay-speed-btn num', speed === value && 'is-active')}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    ) : null

  return (
    <div className="page replay-page">
      <div className="replay-studio">
        <div className="replay-studio-main">
          <ReplayChart
            sequence={sequence}
            timeframe={timeframe}
            onChangeTimeframe={setTimeframe}
            loading={feedLoading}
            error={feedError}
            cursor={cursor}
            onSelectCandle={jumpTo}
            onRetry={() => setReloadNonce((n) => n + 1)}
            footer={transportFooter}
          />
        </div>

        <aside className="replay-side" aria-label="Account, trades, and execution details">
          <header className="replay-panel-top">
            <div className="replay-acct-wrap" ref={accountMenuRef}>
              {accounts.length > 1 ? (
                <button
                  type="button"
                  className={cn('replay-acct-btn', accountSwitcherOpen && 'is-open')}
                  onClick={() => setAccountSwitcherOpen((v) => !v)}
                  aria-expanded={accountSwitcherOpen}
                  aria-haspopup="listbox"
                  title={`${titleFor(activeAccount)} · ${accountStageLabel(activeAccount)}`}
                >
                  <span className="replay-acct-btn-name">{titleFor(activeAccount)}</span>
                  <span className="replay-acct-btn-stage">{accountStageLabel(activeAccount)}</span>
                  <ChevronDown size={13} className="replay-acct-chev" />
                </button>
              ) : (
                <div
                  className="replay-acct-btn is-static"
                  title={`${titleFor(activeAccount)} · ${accountStageLabel(activeAccount)}`}
                >
                  <span className="replay-acct-btn-name">{titleFor(activeAccount)}</span>
                  <span className="replay-acct-btn-stage">{accountStageLabel(activeAccount)}</span>
                </div>
              )}

              {accountSwitcherOpen && accounts.length > 1 && (
                <div className="replay-acct-popover" role="listbox" aria-label="Switch account">
                  {accounts.map((acc) => {
                    const isCurrent = acc.id === activeAccount.id
                    const count = getTradesForAccount(acc).length
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        className={cn('replay-acct-option', isCurrent && 'is-active')}
                        onClick={() => handleSelectAccount(acc.id)}
                      >
                        <span className="replay-acct-option-main">
                          <b>{titleFor(acc)}</b>
                          <span className="num">
                            {accountStageLabel(acc)} · {count} {count === 1 ? 'trade' : 'trades'}
                          </span>
                        </span>
                        {isCurrent && <Check size={14} className="replay-acct-check" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              className={cn('replay-trades-toggle', sideTab === 'trades' && 'is-active')}
              onClick={() => setSideTab((prev) => (prev === 'trades' ? 'details' : 'trades'))}
              aria-pressed={sideTab === 'trades'}
            >
              {sideTab === 'trades' ? (
                <>
                  <ChevronLeft size={12} aria-hidden="true" />
                  <span>Details</span>
                </>
              ) : (
                <>
                  <span className="num">{accountTrades.length}</span>
                  <span>{accountTrades.length === 1 ? 'trade' : 'trades'}</span>
                  <ChevronRight size={12} aria-hidden="true" />
                </>
              )}
            </button>
          </header>

          {sideTab === 'trades' ? (
            <div className="replay-trades-view">
              <div className="replay-trades-toolbar">
                <label className="replay-search-field">
                  <Search size={13} aria-hidden="true" />
                  <input
                    type="search"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search symbol or date…"
                    aria-label="Search trades"
                  />
                </label>
                <Segmented
                  size="sm"
                  value={pickerFilter}
                  options={PICKER_FILTERS}
                  onChange={setPickerFilter}
                  label="Filter trades"
                />
              </div>

              <div className="replay-trades-list" role="listbox" aria-label="Account trades">
                {filteredPickerTrades.length === 0 ? (
                  <div className="replay-picker-empty">No matching trades</div>
                ) : (
                  filteredPickerTrades.map((trade) => {
                    const active = trade.id === selectedTrade.id
                    return (
                      <button
                        key={trade.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn('replay-trade-item', active && 'is-active')}
                        onClick={() => selectTrade(trade.id)}
                      >
                        <span className="replay-trade-item-left">
                          <span className="replay-trade-item-top">
                            <b>{trade.ticker}</b>
                            <span
                              className={cn(
                                'replay-trade-item-side',
                                trade.side === 'LONG' ? 'is-long' : 'is-short',
                              )}
                            >
                              {trade.side === 'LONG' ? 'Buy' : 'Sell'}
                            </span>
                          </span>
                          <span className="replay-trade-item-date num">
                            {formatShortDate(trade.date)}
                            {trade.openTime ? ` · ${formatTime(trade.openTime)}` : ''}
                          </span>
                        </span>
                        <span className="replay-trade-item-right num">
                          <span
                            className={cn(
                              'replay-trade-item-pnl',
                              trade.pnl > 0 ? 'is-pos' : trade.pnl < 0 ? 'is-neg' : '',
                            )}
                          >
                            {signedMoney(trade.pnl)}
                          </span>
                          {trade.rMultiple ? (
                            <span className="replay-trade-item-r">
                              {formatR(trade.rMultiple)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            (() => {
              const isLiveOpen =
                Boolean(sequence && currentBar && currentBar.phase === 'in' && cursor < sequence.exitIndex)
              const heroPnl = isLiveOpen && currentBar ? currentBar.unrealizedPnl : selectedTrade.pnl
              const heroR =
                isLiveOpen && currentBar ? currentBar.unrealizedR : selectedTrade.rMultiple
              const totalTradeBars = sequence
                ? Math.max(1, sequence.exitIndex - sequence.entryIndex + 1)
                : 1
              const inTradeProgress = !sequence || cursor < sequence.entryIndex
                ? 0
                : cursor >= sequence.exitIndex
                  ? 100
                  : Math.round(((cursor - sequence.entryIndex + 1) / totalTradeBars) * 100)
              const mfeMax = excursion ? Math.max(excursion.mfePct, excursion.maePct, 0.01) : 1
              const mfeFill = excursion ? Math.max(8, Math.round((excursion.mfePct / mfeMax) * 100)) : 0
              const maeFill = excursion ? Math.max(8, Math.round((excursion.maePct / mfeMax) * 100)) : 0

              const showStmtClock = Boolean(
                sequence &&
                  sequence.tzOffsetHours !== 0 &&
                  sequence.statementOpenTime &&
                  sequence.statementOpenTime !== 'Open',
              )

              return (
                <div className="replay-details-body">
                  <section className="replay-summary">
                    <div className="replay-summary-top">
                      <div className="replay-summary-meta">
                        <strong className="replay-summary-ticker">{selectedTrade.ticker}</strong>
                        <span aria-hidden="true">·</span>
                        <span>{selectedTrade.side === 'LONG' ? 'Long' : 'Short'}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {selectedTrade.openDate && selectedTrade.openDate !== selectedTrade.date
                            ? `${formatShortDate(selectedTrade.openDate)} → ${formatShortDate(selectedTrade.date)}`
                            : formatShortDate(selectedTrade.date)}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'replay-summary-phase num',
                          isLiveOpen && 'is-live',
                        )}
                      >
                        {livePhaseLabel}
                      </span>
                    </div>

                    <div className="replay-summary-pnl-row">
                      <div
                        className={cn(
                          'replay-summary-pnl num',
                          heroPnl > 0 ? 'is-pos' : heroPnl < 0 ? 'is-neg' : '',
                        )}
                      >
                        {signedMoney(heroPnl)}
                      </div>
                      {isLiveOpen ? (
                        <span className="replay-summary-final num">
                          Final {signedMoney(selectedTrade.pnl)}
                        </span>
                      ) : null}
                    </div>

                    <div className="replay-summary-sub num">
                      <span>
                        {isLiveOpen
                          ? 'Open P&L'
                          : selectedTrade.pnl > 0
                            ? 'Win'
                            : selectedTrade.pnl < 0
                              ? 'Loss'
                              : 'Breakeven'}
                      </span>
                      {heroR ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{formatR(heroR)}</span>
                        </>
                      ) : null}
                      {sequence?.holdLabel && sequence.holdLabel !== '—' ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{sequence.holdLabel} hold</span>
                        </>
                      ) : null}
                    </div>

                    {sequence ? (
                      <div className="replay-hold-meter" aria-hidden="true">
                        <div
                          className={cn(
                            'replay-hold-meter-fill',
                            heroPnl > 0 ? 'is-pos' : heroPnl < 0 ? 'is-neg' : '',
                          )}
                          style={{ width: `${inTradeProgress}%` }}
                        />
                      </div>
                    ) : null}
                  </section>

                  {sequence && sequence.priceAlignment === 'mismatch' && (
                    <div className="replay-feed-notice is-warn" role="status">
                      <AlertTriangle size={13} aria-hidden="true" />
                      <span>
                        Trade prices ({formatPrice(selectedTrade.entry)} → {formatPrice(selectedTrade.exit)}) fall outside {sequence.marketSymbol} candles at {sequence.openTimeLabel}. Check the broker timezone below.
                      </span>
                    </div>
                  )}

                  {sequence && sequence.candles.length > 0 && (
                    <section className="replay-block">
                      <div className="replay-block-head">
                        <h3 className="replay-block-title">Executions</h3>
                        <span className="replay-block-hint">Click to jump</span>
                      </div>
                      <div className="replay-exec-timeline">
                        <span
                          className={cn(
                            'replay-exec-rail',
                            exitReached && 'is-complete',
                          )}
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          className={cn(
                            'replay-exec-node',
                            entryReached && 'is-reached',
                            cursor === sequence.entryIndex && 'is-current',
                          )}
                          onClick={() => jumpTo(sequence.entryIndex)}
                        >
                          <span className="replay-exec-left">
                            <span
                              className={cn(
                                'replay-exec-dot is-entry',
                                entryReached && 'is-filled',
                              )}
                              aria-hidden="true"
                            />
                            <span
                              className={cn(
                                'replay-exec-tag',
                                selectedTrade.side === 'LONG' ? 'is-long' : 'is-short',
                              )}
                            >
                              {selectedTrade.side === 'LONG' ? 'Buy' : 'Sell'}
                            </span>
                            <span className="replay-exec-time num">
                              {sequence.openTimeLabel}
                              {showStmtClock ? ` (${sequence.statementOpenTime})` : ''}
                            </span>
                          </span>
                          <span className="replay-exec-price num">
                            {formatPrice(selectedTrade.entry)}
                          </span>
                        </button>

                        <button
                          type="button"
                          className={cn(
                            'replay-exec-node',
                            exitReached && 'is-reached',
                            cursor === sequence.exitIndex && 'is-current',
                          )}
                          onClick={() => jumpTo(sequence.exitIndex)}
                        >
                          <span className="replay-exec-left">
                            <span
                              className={cn(
                                'replay-exec-dot is-exit',
                                selectedTrade.pnl < 0 && 'is-loss',
                                exitReached && 'is-filled',
                              )}
                              aria-hidden="true"
                            />
                            <span
                              className={cn(
                                'replay-exec-tag',
                                selectedTrade.pnl >= 0 ? 'is-pos' : 'is-neg',
                              )}
                            >
                              Exit
                            </span>
                            <span className="replay-exec-time num">
                              {sequence.closeTimeLabel}
                              {showStmtClock ? ` (${sequence.statementCloseTime})` : ''}
                            </span>
                          </span>
                          <span className="replay-exec-price num">
                            {formatPrice(selectedTrade.exit)}
                          </span>
                        </button>
                      </div>
                    </section>
                  )}

                  <section className="replay-block">
                    <div className="replay-block-head">
                      <h3 className="replay-block-title">Price excursion</h3>
                      <span className="replay-block-hint num">
                        {excursion
                          ? `${excursion.barsInTrade} ${excursion.barsInTrade === 1 ? 'bar' : 'bars'} (${sequence?.resolvedInterval ?? timeframe})`
                          : 'Pre-entry'}
                      </span>
                    </div>
                    <div className="replay-excursion-gauge num">
                      <div className="replay-excursion-col">
                        <div className="replay-excursion-top">
                          <span className="replay-excursion-k">Peak (MFE)</span>
                          <strong className={excursion ? 'is-pos' : 'is-idle'}>
                            {excursion ? `+${excursion.mfePct.toFixed(2)}%` : '—'}
                          </strong>
                        </div>
                        <div className="replay-excursion-bar">
                          <span
                            className="replay-excursion-bar-fill is-pos"
                            style={{ width: `${mfeFill}%` }}
                          />
                        </div>
                        <span className="replay-excursion-at">
                          {excursion
                            ? `${signedMoney(excursion.mfeUsd)} @ ${formatPrice(excursion.mfePrice)}`
                            : 'Waiting for entry'}
                        </span>
                      </div>

                      <div className="replay-excursion-col">
                        <div className="replay-excursion-top">
                          <span className="replay-excursion-k">Drawdown (MAE)</span>
                          <strong className={excursion ? 'is-neg' : 'is-idle'}>
                            {excursion ? `-${excursion.maePct.toFixed(2)}%` : '—'}
                          </strong>
                        </div>
                        <div className="replay-excursion-bar">
                          <span
                            className="replay-excursion-bar-fill is-neg"
                            style={{ width: `${maeFill}%` }}
                          />
                        </div>
                        <span className="replay-excursion-at">
                          {excursion
                            ? `${signedMoney(-excursion.maeUsd)} @ ${formatPrice(excursion.maePrice)}`
                            : 'Waiting for entry'}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="replay-block replay-block-grow">
                    <div className="replay-block-head">
                      <h3 className="replay-block-title">Trade &amp; feed details</h3>
                    </div>
                    <dl className="replay-stats-rows num">
                      <div className="replay-stats-row">
                        <dt>Size</dt>
                        <dd>{selectedTrade.volume || 1}</dd>
                      </div>
                      <div className="replay-stats-row">
                        <dt>Entry price</dt>
                        <dd>{formatPrice(selectedTrade.entry)}</dd>
                      </div>
                      <div className="replay-stats-row">
                        <dt>Exit price</dt>
                        <dd>{formatPrice(selectedTrade.exit)}</dd>
                      </div>
                      {selectedTrade.stopLoss ? (
                        <div className="replay-stats-row">
                          <dt>Stop loss</dt>
                          <dd className="is-neg">{formatPrice(selectedTrade.stopLoss)}</dd>
                        </div>
                      ) : null}
                      {selectedTrade.takeProfit ? (
                        <div className="replay-stats-row">
                          <dt>Take profit</dt>
                          <dd className="is-pos">{formatPrice(selectedTrade.takeProfit)}</dd>
                        </div>
                      ) : null}
                      <div className="replay-stats-row">
                        <dt>Gross P&L</dt>
                        <dd
                          className={
                            selectedTrade.gross > 0
                              ? 'is-pos'
                              : selectedTrade.gross < 0
                                ? 'is-neg'
                                : undefined
                          }
                        >
                          {signedMoney(selectedTrade.gross)}
                        </dd>
                      </div>
                      <div className="replay-stats-row">
                        <dt>Commissions & fees</dt>
                        <dd>{formatUsd2(selectedTrade.fees || 0)}</dd>
                      </div>
                      {sequence?.plannedRR ? (
                        <div className="replay-stats-row">
                          <dt>Planned R:R</dt>
                          <dd>1 : {sequence.plannedRR.toFixed(2)}</dd>
                        </div>
                      ) : excursion?.capturePct !== null && excursion?.capturePct !== undefined ? (
                        <div className="replay-stats-row">
                          <dt>Move captured</dt>
                          <dd className="is-pos">{excursion.capturePct}%</dd>
                        </div>
                      ) : null}
                      <div className="replay-stats-row">
                        <dt>
                          <label htmlFor="replay-tz-select">Broker timezone</label>
                        </dt>
                        <dd>
                          <select
                            id="replay-tz-select"
                            className="replay-tz-select num"
                            value={String(tzPreference)}
                            onChange={(e) => handleTzChange(e.target.value)}
                          >
                            {tzOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </dd>
                      </div>
                      {sequence && (
                        <div className="replay-stats-row">
                          <dt>Market feed</dt>
                          <dd>
                            {sequence.source} · {sequence.marketSymbol}
                            {sequence.tzMode === 'auto' && sequence.tzOffsetHours !== 0
                              ? ` (${formatUtcOffset(sequence.tzOffsetHours)})`
                              : ''}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </section>

                  {selectedTrade.note?.trim() ? (
                    <section className="replay-block">
                      <div className="replay-block-head">
                        <h3 className="replay-block-title">Notes</h3>
                      </div>
                      <p className="replay-note-clean">{selectedTrade.note}</p>
                    </section>
                  ) : null}
                </div>
              )
            })()
          )}
        </aside>
      </div>
    </div>
  )
}
