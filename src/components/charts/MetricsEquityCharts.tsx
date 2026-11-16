import { useId, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useElementSize } from '@/hooks/useElementSize'
import { formatShortDate } from '@/lib/dates'
import { formatMoney, formatUsd2, signedMoney } from '@/lib/format'
import { axisMoney, clampChart, smoothPath, type ChartPoint } from './chartUtils'

export interface EquityCurvePoint {
  date: string
  baseline?: boolean
  dayPnl: number
  net: number
  balance: number
  peakBalance: number
  peakNet: number
  drawdown: number
  drawdownPct: number
}

interface SharedChartProps {
  series: EquityCurvePoint[]
  height?: number
  hoverIndex: number | null
  onHoverChange: (index: number | null) => void
}

interface MetricsBalanceChartProps extends SharedChartProps {
  mode: 'balance' | 'equity'
}

interface MetricsDrawdownChartProps extends SharedChartProps {
  unit: 'pct' | 'usd'
}

function formatAxisSignedMoney(value: number): string {
  if (Math.abs(value) < 0.5) return '$0'
  return value > 0 ? `+${axisMoney(value)}` : axisMoney(value)
}

export function MetricsBalanceChart({
  series,
  mode,
  height = 216,
  hoverIndex,
  onHoverChange,
}: MetricsBalanceChartProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [localHover, setLocalHover] = useState(false)
  const gradId = useId().replace(/:/g, '')

  const endingNet = series.length ? series[series.length - 1].net : 0
  const isNegative = endingNet < 0

  const geometry = useMemo(() => {
    if (!width || series.length < 2) return null

    const left = 56
    const right = width - 10
    const top = 14
    const bottom = height - 14
    const plotW = Math.max(1, right - left)
    const plotH = Math.max(1, bottom - top)

    const values = series.map((pt) => (mode === 'balance' ? pt.balance : pt.net))
    const peaks = series.map((pt) => (mode === 'balance' ? pt.peakBalance : pt.peakNet))
    const baseVal = mode === 'balance' ? series[0].balance : 0

    let rawMin = Math.min(baseVal, ...values)
    let rawMax = Math.max(baseVal, ...peaks, ...values)
    if (Math.abs(rawMax - rawMin) < 1) {
      const padFallback = mode === 'balance' ? Math.max(200, Math.abs(baseVal) * 0.02) : 200
      rawMin -= padFallback
      rawMax += padFallback
    }
    const span = rawMax - rawMin
    const lo = rawMin - span * 0.1
    const hi = rawMax + span * 0.1

    const yFor = (val: number) => top + ((hi - val) / (hi - lo)) * plotH
    const xFor = (idx: number) => left + (idx / Math.max(1, series.length - 1)) * plotW

    const mainPts: ChartPoint[] = series.map((_, idx) => ({
      x: xFor(idx),
      y: yFor(values[idx]),
    }))
    const peakPts: ChartPoint[] = series.map((_, idx) => ({
      x: xFor(idx),
      y: yFor(peaks[idx]),
    }))

    const linePath = smoothPath(mainPts, 0.16)
    const peakPath = smoothPath(peakPts, 0.16)
    const baseY = clampChart(yFor(baseVal), top, bottom)
    const areaPath = `${linePath} L ${mainPts[mainPts.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} L ${mainPts[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`

    const hasPullback = series.some((pt) => pt.drawdown < -0.5)

    const ticks = [0, 1, 2, 3].map((step) => {
      const val = lo + ((hi - lo) * step) / 3
      return {
        y: yFor(val),
        label: mode === 'balance' ? axisMoney(val) : formatAxisSignedMoney(val),
      }
    })

    return {
      left,
      right,
      top,
      bottom,
      plotW,
      mainPts,
      linePath,
      peakPath,
      areaPath,
      baseY,
      hasPullback,
      ticks,
      xFor,
      yFor,
      values,
    }
  }, [width, series, mode, height])

  if (!series.length) {
    return <div className="chart-empty">No closed trades in this range</div>
  }

  const activeIdx =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < series.length ? hoverIndex : null
  const activePt = activeIdx !== null ? series[activeIdx] : null
  const activeGeom = activeIdx !== null && geometry ? geometry.mainPts[activeIdx] : null

  const strokeColor = isNegative ? 'var(--chart-negative)' : 'var(--chart-blue)'

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry || series.length < 2) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const ratio = clampChart((localX - geometry.left) / geometry.plotW, 0, 1)
    setLocalHover(true)
    onHoverChange(Math.round(ratio * (series.length - 1)))
  }

  const handlePointerLeave = () => {
    setLocalHover(false)
    onHoverChange(null)
  }

  const sessionCount = Math.max(0, series.length - 1)
  const lastDate = series[series.length - 1]?.date

  return (
    <div className="metrics-chart-wrap">
      <div
        ref={wrapRef}
        className="metrics-chart-canvas"
        style={{ height }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {geometry && width > 0 && (
          <svg
            width={width}
            height={height}
            className="chart-svg"
            role="img"
            aria-label={mode === 'balance' ? 'Account balance curve' : 'Cumulative equity P&L curve'}
          >
            <defs>
              <linearGradient id={`metrics-eq-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {geometry.ticks.map((tick, idx) => (
              <g key={`eq-tick-${idx}`}>
                <line
                  x1={geometry.left}
                  x2={geometry.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={geometry.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  fill="var(--chart-axis)"
                  fontSize={9.5}
                  className="num"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            <line
              x1={geometry.left}
              x2={geometry.right}
              y1={geometry.baseY}
              y2={geometry.baseY}
              stroke="var(--line-strong)"
              strokeDasharray="3 4"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />

            {geometry.hasPullback && (
              <path
                d={geometry.peakPath}
                fill="none"
                stroke="var(--chart-axis)"
                strokeDasharray="3 3"
                strokeWidth={1.1}
                opacity={0.45}
              />
            )}

            <motion.path
              key={`eq-area-${mode}-${series.length}`}
              d={geometry.areaPath}
              fill={`url(#metrics-eq-fill-${gradId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />

            <motion.path
              key={`eq-line-${mode}-${series.length}`}
              d={geometry.linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            />

            {geometry.mainPts.length > 0 && activeIdx === null && (
              <circle
                cx={geometry.mainPts[geometry.mainPts.length - 1].x}
                cy={geometry.mainPts[geometry.mainPts.length - 1].y}
                r={3.5}
                fill={strokeColor}
                stroke="var(--panel)"
                strokeWidth={2}
              />
            )}

            {activeIdx !== null && activeGeom && (
              <g>
                <line
                  x1={activeGeom.x}
                  x2={activeGeom.x}
                  y1={geometry.top}
                  y2={geometry.bottom}
                  stroke="var(--line-strong)"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activeGeom.x}
                  cy={activeGeom.y}
                  r={4.5}
                  fill={strokeColor}
                  stroke="var(--panel)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}

        {localHover && activePt && activeGeom && geometry && width > 0 && (
          <div
            className="chart-tooltip"
            style={{
              left: clampChart(activeGeom.x, 86, Math.max(86, width - 86)),
              top: activeGeom.y < 64 ? activeGeom.y + 14 : activeGeom.y - 12,
              transform: activeGeom.y < 64 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
          >
            <b>
              {activePt.baseline ? 'Start' : formatShortDate(activePt.date)} ·{' '}
              {mode === 'balance' ? formatUsd2(activePt.balance) : signedMoney(activePt.net)}
            </b>
            <span>
              {activePt.baseline
                ? `Starting ${formatMoney(activePt.balance)}`
                : `Session ${signedMoney(activePt.dayPnl)} · Net ${signedMoney(activePt.net)}`}
            </span>
          </div>
        )}
      </div>

      <div className="chart-axis">
        <span>Start</span>
        <span>
          {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
        </span>
        <span>{lastDate ? formatShortDate(lastDate) : '—'}</span>
      </div>
    </div>
  )
}

export function MetricsDrawdownChart({
  series,
  unit,
  height = 216,
  hoverIndex,
  onHoverChange,
}: MetricsDrawdownChartProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [localHover, setLocalHover] = useState(false)
  const gradId = useId().replace(/:/g, '')

  const geometry = useMemo(() => {
    if (!width || series.length < 2) return null

    const left = 56
    const right = width - 10
    const top = 14
    const bottom = height - 14
    const plotW = Math.max(1, right - left)
    const plotH = Math.max(1, bottom - top)

    const values = series.map((pt) => (unit === 'pct' ? pt.drawdownPct : pt.drawdown))
    const minVal = Math.min(0, ...values)
    const hasDrawdown = minVal < -0.0001

    const minDepth = hasDrawdown
      ? Math.abs(minVal)
      : unit === 'pct'
        ? 1
        : Math.max(100, Math.round(series[0].balance * 0.01))

    const lo = -(minDepth * 1.15)
    const hi = minDepth * 0.06

    const yFor = (val: number) => top + ((hi - val) / (hi - lo)) * plotH
    const xFor = (idx: number) => left + (idx / Math.max(1, series.length - 1)) * plotW

    const mainPts: ChartPoint[] = series.map((_, idx) => ({
      x: xFor(idx),
      y: yFor(values[idx]),
    }))

    const linePath = smoothPath(mainPts, 0.16)
    const zeroY = clampChart(yFor(0), top, bottom)
    const areaPath = `${linePath} L ${mainPts[mainPts.length - 1].x.toFixed(2)} ${zeroY.toFixed(2)} L ${mainPts[0].x.toFixed(2)} ${zeroY.toFixed(2)} Z`

    let troughIdx = -1
    if (hasDrawdown) {
      let worst = 0
      values.forEach((v, idx) => {
        if (v < worst) {
          worst = v
          troughIdx = idx
        }
      })
    }

    const tickSpan = minDepth * 1.05
    const ticks = [0, 1, 2, 3].map((step) => {
      const val = -(tickSpan * step) / 3
      const label =
        Math.abs(val) < 0.005
          ? unit === 'pct'
            ? '0%'
            : '$0'
          : unit === 'pct'
            ? `−${Math.abs(val).toFixed(Math.abs(val) < 1 ? 2 : 1)}%`
            : axisMoney(val)
      return { y: yFor(val), label, isZero: step === 0 }
    })

    return {
      left,
      right,
      top,
      bottom,
      plotW,
      mainPts,
      linePath,
      areaPath,
      zeroY,
      ticks,
      troughIdx,
      hasDrawdown,
      xFor,
      yFor,
    }
  }, [width, series, unit, height])

  if (!series.length) {
    return <div className="chart-empty">No closed trades in this range</div>
  }

  const activeIdx =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < series.length ? hoverIndex : null
  const activePt = activeIdx !== null ? series[activeIdx] : null
  const activeGeom = activeIdx !== null && geometry ? geometry.mainPts[activeIdx] : null

  const ddColor = 'var(--chart-negative)'

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry || series.length < 2) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const ratio = clampChart((localX - geometry.left) / geometry.plotW, 0, 1)
    setLocalHover(true)
    onHoverChange(Math.round(ratio * (series.length - 1)))
  }

  const handlePointerLeave = () => {
    setLocalHover(false)
    onHoverChange(null)
  }

  const lastPt = series[series.length - 1]
  const currentDdText =
    lastPt && lastPt.drawdown < -0.5
      ? `Current −${formatMoney(Math.abs(lastPt.drawdown))} (${Math.abs(lastPt.drawdownPct).toFixed(2)}%)`
      : 'At equity peak'

  return (
    <div className="metrics-chart-wrap">
      <div
        ref={wrapRef}
        className="metrics-chart-canvas"
        style={{ height }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {geometry && width > 0 && (
          <svg
            width={width}
            height={height}
            className="chart-svg"
            role="img"
            aria-label="Account drawdown curve"
          >
            <defs>
              <linearGradient id={`metrics-dd-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ddColor} stopOpacity="0.04" />
                <stop offset="100%" stopColor={ddColor} stopOpacity="0.28" />
              </linearGradient>
            </defs>

            {geometry.ticks.map((tick, idx) => (
              <g key={`dd-tick-${idx}`}>
                <line
                  x1={geometry.left}
                  x2={geometry.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={tick.isZero ? 'var(--line-strong)' : 'var(--chart-grid)'}
                  strokeDasharray={tick.isZero ? '3 4' : undefined}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={geometry.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  fill="var(--chart-axis)"
                  fontSize={9.5}
                  className="num"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            <motion.path
              key={`dd-area-${unit}-${series.length}`}
              d={geometry.areaPath}
              fill={`url(#metrics-dd-fill-${gradId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />

            <motion.path
              key={`dd-line-${unit}-${series.length}`}
              d={geometry.linePath}
              fill="none"
              stroke={ddColor}
              strokeWidth={2.1}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            />

            {geometry.troughIdx >= 0 && geometry.mainPts[geometry.troughIdx] && activeIdx === null && (
              <circle
                cx={geometry.mainPts[geometry.troughIdx].x}
                cy={geometry.mainPts[geometry.troughIdx].y}
                r={3.5}
                fill={ddColor}
                stroke="var(--panel)"
                strokeWidth={2}
              />
            )}

            {activeIdx !== null && activeGeom && (
              <g>
                <line
                  x1={activeGeom.x}
                  x2={activeGeom.x}
                  y1={geometry.top}
                  y2={geometry.bottom}
                  stroke="var(--line-strong)"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activeGeom.x}
                  cy={activeGeom.y}
                  r={4.5}
                  fill={ddColor}
                  stroke="var(--panel)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}

        {localHover && activePt && activeGeom && geometry && width > 0 && (
          <div
            className="chart-tooltip"
            style={{
              left: clampChart(activeGeom.x, 86, Math.max(86, width - 86)),
              top: activeGeom.y > height - 64 ? activeGeom.y - 12 : activeGeom.y + 14,
              transform: activeGeom.y > height - 64 ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
          >
            <b>
              {activePt.baseline ? 'Start' : formatShortDate(activePt.date)} ·{' '}
              {activePt.drawdown < -0.5
                ? `−${formatMoney(Math.abs(activePt.drawdown))} (−${Math.abs(activePt.drawdownPct).toFixed(2)}%)`
                : 'At peak (0%)'}
            </b>
            <span>
              Peak {formatMoney(activePt.peakBalance)} · Balance {formatMoney(activePt.balance)}
            </span>
          </div>
        )}
      </div>

      <div className="chart-axis">
        <span>Start</span>
        <span>{currentDdText}</span>
        <span>{lastPt?.date ? formatShortDate(lastPt.date) : '—'}</span>
      </div>
    </div>
  )
}
