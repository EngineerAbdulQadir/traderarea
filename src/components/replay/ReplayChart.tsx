import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type WhitespaceData,
} from 'lightweight-charts'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/hooks/useTheme'
import { formatR, signedMoney } from '@/lib/format'
import {
  formatReplayPrice,
  type ReplayCandle,
  type ReplaySequence,
} from '@/lib/replay'
import { cn } from '@/lib/cn'

interface ReplayChartProps {
  sequence: ReplaySequence | null
  loading: boolean
  error: string | null
  cursor: number
  onSelectCandle?: (index: number) => void
  onRetry: () => void
  footer?: ReactNode
}

export function ReplayChart({
  sequence,
  loading,
  error,
  cursor,
  onSelectCandle,
  onRetry,
  footer,
}: ReplayChartProps) {
  const { isDark } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const anchorSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const onSelectCandleRef = useRef(onSelectCandle)
  onSelectCandleRef.current = onSelectCandle
  const needsFitRef = useRef(true)
  const prevCursorRef = useRef(cursor)

  const [hoveredCandle, setHoveredCandle] = useState<ReplayCandle | null>(null)

  const visibleCandles = useMemo(
    () => (sequence ? sequence.candles.slice(0, Math.max(0, cursor + 1)) : []),
    [sequence, cursor],
  )

  const candleByTime = useMemo(() => {
    const map = new Map<number, ReplayCandle>()
    sequence?.candles.forEach((c) => {
      map.set(c.utcTime as number, c)
    })
    return map
  }, [sequence])

  useEffect(() => {
    if (!sequence || !sequence.candles.length || !containerRef.current) return

    const container = containerRef.current
    const chart = createChart(container, {
      width: container.clientWidth || 900,
      height: container.clientHeight || 500,
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? '#131722' : '#ffffff',
        },
        textColor: isDark ? '#b2b5be' : '#434651',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(42, 46, 57, 0.055)',
        },
        horzLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(42, 46, 57, 0.055)',
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? 'rgba(178, 181, 190, 0.4)' : 'rgba(67, 70, 81, 0.35)',
          style: LineStyle.Dashed,
          labelBackgroundColor: isDark ? '#2a2e39' : '#131722',
        },
        horzLine: {
          color: isDark ? 'rgba(178, 181, 190, 0.4)' : 'rgba(67, 70, 81, 0.35)',
          style: LineStyle.Dashed,
          labelBackgroundColor: isDark ? '#2a2e39' : '#131722',
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(42, 46, 57, 0.1)',
        scaleMargins: { top: 0.14, bottom: 0.12 },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(42, 46, 57, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 14,
        shiftVisibleRangeOnNewBar: false,
        allowShiftVisibleRangeOnWhitespaceReplacement: false,
      },
    })

    const anchorSeries = chart.addSeries(LineSeries, {
      visible: false,
      priceScaleId: 'replay-anchor',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    })
    anchorSeries.setData(
      sequence.candles.map((c) => ({ time: c.utcTime, value: c.close })),
    )

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      priceFormat: {
        type: 'price',
        precision: sequence.priceDigits,
        minMove: Math.pow(10, -sequence.priceDigits),
      },
    })

    const markersPlugin = createSeriesMarkers(candleSeries, [])

    chartRef.current = chart
    anchorSeriesRef.current = anchorSeries
    candleSeriesRef.current = candleSeries
    markersPluginRef.current = markersPlugin
    needsFitRef.current = true

    const onCrosshairMove = (param: { time?: Time }) => {
      if (!param.time || typeof param.time !== 'number') {
        setHoveredCandle(null)
        return
      }
      setHoveredCandle(candleByTime.get(param.time) ?? null)
    }
    chart.subscribeCrosshairMove(onCrosshairMove)

    const onChartClick = (param: { time?: Time }) => {
      if (!param.time || typeof param.time !== 'number') return
      const clicked = candleByTime.get(param.time)
      if (clicked) onSelectCandleRef.current?.(clicked.index)
    }
    chart.subscribeClick(onChartClick)

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        chart.applyOptions({ width: Math.floor(width), height: Math.floor(height) })
      }
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      chart.unsubscribeClick(onChartClick)
      chart.remove()
      chartRef.current = null
      anchorSeriesRef.current = null
      candleSeriesRef.current = null
      markersPluginRef.current = null
      priceLinesRef.current = []
    }
  }, [sequence, candleByTime, isDark])

  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candleSeriesRef.current
    const markersPlugin = markersPluginRef.current
    if (!sequence || !chart || !candleSeries || !markersPlugin) {
      return
    }

    const seriesData: (CandlestickData<Time> | WhitespaceData<Time>)[] =
      sequence.candles.map((c, i) =>
        i <= cursor
          ? {
              time: c.utcTime,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }
          : { time: c.utcTime },
      )

    candleSeries.setData(seriesData)

    priceLinesRef.current.forEach((line) => candleSeries.removePriceLine(line))
    priceLinesRef.current = []

    const entryReached = cursor >= sequence.entryIndex
    const exitReached = cursor >= sequence.exitIndex
    const entryBar = sequence.candles[sequence.entryIndex]
    const exitBar = sequence.candles[sequence.exitIndex]

    const isNearBar = (price: number, bar: ReplayCandle | undefined) => {
      if (!bar || !(price > 0)) return false
      const tol = Math.max((bar.high - bar.low) * 1.5, bar.close * 0.0025)
      return price >= bar.low - tol && price <= bar.high + tol
    }

    const chartEntryPrice =
      sequence.hasPrices && isNearBar(sequence.entryPrice, entryBar)
        ? sequence.entryPrice
        : (entryBar?.close ?? sequence.entryPrice)

    const chartExitPrice =
      sequence.hasPrices && isNearBar(sequence.exitPrice, exitBar)
        ? sequence.exitPrice
        : (exitBar?.close ?? sequence.exitPrice)

    const minPriceStep = Math.max(0.0001, Math.pow(10, -sequence.priceDigits) * 2)
    const sameChartLevel =
      chartEntryPrice > 0 &&
      chartExitPrice > 0 &&
      Math.abs(chartExitPrice - chartEntryPrice) <= minPriceStep

    if (sequence.hasPrices) {
      if (sequence.stopLossPrice !== null) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: sequence.stopLossPrice,
            color: '#f23645',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'SL',
          }),
        )
      }

      if (sequence.takeProfitPrice !== null) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: sequence.takeProfitPrice,
            color: '#089981',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'TP',
          }),
        )
      }
    }

    if (entryReached && chartEntryPrice > 0) {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: chartEntryPrice,
          color: sameChartLevel && exitReached
            ? sequence.trade.pnl >= 0
              ? '#089981'
              : '#f23645'
            : '#2962ff',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: sameChartLevel && exitReached ? 'ENTRY / EXIT' : 'ENTRY',
        }),
      )
    }

    if (exitReached && chartExitPrice > 0 && !sameChartLevel) {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: chartExitPrice,
          color: sequence.trade.pnl >= 0 ? '#089981' : '#f23645',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'EXIT',
        }),
      )
    }

    const markers: SeriesMarker<Time>[] = []
    const isLong = sequence.trade.side === 'LONG'

    if (entryReached && sequence.candles[sequence.entryIndex]) {
      const entryBar = sequence.candles[sequence.entryIndex]
      markers.push({
        time: entryBar.utcTime,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: '#2962ff',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        size: 1.5,
      })
    }

    if (exitReached && sequence.candles[sequence.exitIndex]) {
      const exitBar = sequence.candles[sequence.exitIndex]
      const isWin = sequence.trade.pnl >= 0
      markers.push({
        time: exitBar.utcTime,
        position: isLong ? 'aboveBar' : 'belowBar',
        color: isWin ? '#089981' : '#f23645',
        shape: isLong ? 'arrowDown' : 'arrowUp',
        size: 1.5,
      })
    }

    markersPlugin.setMarkers(markers)

    const totalBars = sequence.candles.length
    const prevCursor = prevCursorRef.current
    prevCursorRef.current = cursor

    const applyCenterStartRange = (targetIndex: number) => {
      const span = Math.min(Math.max(totalBars + 4, 24), 40)
      const leftPad = Math.floor(span * 0.45)
      chart.timeScale().setVisibleLogicalRange({
        from: targetIndex - leftPad,
        to: targetIndex + (span - leftPad),
      })
    }

    let rafId: number | null = null
    if (needsFitRef.current) {
      needsFitRef.current = false
      if (cursor === 0 && totalBars > 1) {
        applyCenterStartRange(0)
        rafId = window.requestAnimationFrame(() => applyCenterStartRange(0))
      } else {
        chart.timeScale().fitContent()
        rafId = window.requestAnimationFrame(() => {
          chartRef.current?.timeScale().fitContent()
        })
      }
    } else if (cursor === 0 && prevCursor !== 0 && totalBars > 1) {
      applyCenterStartRange(0)
    } else {
      const visibleRange = chart.timeScale().getVisibleLogicalRange()
      if (visibleRange) {
        const span = Math.max(12, visibleRange.to - visibleRange.from)
        if (cursor > visibleRange.to - 4) {
          const nextTo = cursor + 4
          chart.timeScale().setVisibleLogicalRange({
            from: nextTo - span,
            to: nextTo,
          })
        } else if (cursor < visibleRange.from + 1) {
          const leftPad = Math.floor(span * 0.45)
          chart.timeScale().setVisibleLogicalRange({
            from: cursor - leftPad,
            to: cursor + (span - leftPad),
          })
        }
      }
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [sequence, cursor, isDark])

  if (loading && !sequence) {
    return (
      <div className="replay-chart-card is-empty">
        <div className="replay-no-prices">
          <div className="replay-spinner" aria-hidden="true" />
          <b>Loading market candles…</b>
          <p>Fetching historical OHLC bars for this trade.</p>
        </div>
      </div>
    )
  }

  if (error && !sequence) {
    return (
      <div className="replay-chart-card is-empty">
        <div className="replay-no-prices">
          <AlertCircle size={22} className="is-neg" />
          <b>Chart feed unavailable for this symbol</b>
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<RefreshCw size={13} />}
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!sequence || !sequence.candles.length) {
    return null
  }

  const currentBar =
    visibleCandles[visibleCandles.length - 1] ?? sequence.candles[0]
  const hudBar = hoveredCandle ?? currentBar
  const isLong = sequence.trade.side === 'LONG'
  const fmt = (price: number) => formatReplayPrice(price, sequence.priceDigits)

  return (
    <div className="replay-chart-card">
      <div className="replay-hud num">
        <div className="replay-hud-left">
          <span className="replay-hud-sym">{sequence.trade.ticker}</span>
          <span className={cn('replay-hud-side', isLong ? 'is-long' : 'is-short')}>
            {isLong ? 'Buy' : 'Sell'}
          </span>
          <span className="replay-hud-tf">{sequence.resolvedInterval}</span>
          {hudBar && (
            <>
              <span className="replay-hud-sep" aria-hidden="true">·</span>
              <span className="replay-hud-time">{hudBar.timeLabel} UTC</span>
              <span className="replay-hud-lvl">
                O <b>{fmt(hudBar.open)}</b>
              </span>
              <span className="replay-hud-lvl">
                H <b>{fmt(hudBar.high)}</b>
              </span>
              <span className="replay-hud-lvl">
                L <b>{fmt(hudBar.low)}</b>
              </span>
              <span
                className={cn(
                  'replay-hud-lvl',
                  hudBar.close >= hudBar.open ? 'is-pos' : 'is-neg',
                )}
              >
                C <b>{fmt(hudBar.close)}</b>
              </span>
            </>
          )}
        </div>

        <div className="replay-hud-right">
          {hudBar && hudBar.phase !== 'pre' ? (
            <span
              className={cn(
                'replay-hud-pnl',
                hudBar.unrealizedPnl > 0 && 'is-pos',
                hudBar.unrealizedPnl < 0 && 'is-neg',
              )}
            >
              {hudBar.isExit || hudBar.phase === 'post' ? 'Realized ' : 'Open '}
              {signedMoney(hudBar.unrealizedPnl)}
              {hudBar.unrealizedR ? ` (${formatR(hudBar.unrealizedR)})` : ''}
            </span>
          ) : (
            <span className="replay-hud-time">Pre-entry</span>
          )}
        </div>
      </div>

      <div ref={containerRef} className="replay-tv-canvas" />

      {footer}
    </div>
  )
}
