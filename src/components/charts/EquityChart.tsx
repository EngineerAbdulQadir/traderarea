import { useId, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  Activity,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react'
import { useElementSize } from '@/hooks/useElementSize'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/dates'
import { formatMoney, plainPercent, signedMoney, signedPercent } from '@/lib/format'
import type { CumulativePoint } from '@/lib/stats'
import {
  axisMoney,
  calculateEMA,
  clampChart,
  smoothPath,
  stepPath,
  type ChartPoint,
} from './chartUtils'

export type ChartMode = 'pnl' | 'balance' | 'return' | 'drawdown'
export type CurveType = 'spline' | 'step'

interface EquityChartProps {
  points: CumulativePoint[]
  startingBalance?: number
  targetPct?: number
  maxDrawdownPct?: number
  height?: number
  className?: string
  title?: string
}

interface ExtendedPoint extends CumulativePoint {
  baseline?: boolean
  index: number
  returnPct: number
  drawdownPct: number
  pnlDelta: number
  emaValue?: number
}

export function EquityChart({
  points,
  startingBalance = 100000,
  targetPct = 10,
  maxDrawdownPct = 8,
  height = 320,
  className,
}: EquityChartProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [mode, setMode] = useState<ChartMode>('pnl')
  const [curveType, setCurveType] = useState<CurveType>('spline')

  // Overlay Feature Toggles
  const [showTarget, setShowTarget] = useState(true)
  const [showMaxDd, setShowMaxDd] = useState(true)
  const [showWatermark, setShowWatermark] = useState(true)
  const [showEma, setShowEma] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)

  const gradientId = useId().replace(/:/g, '')

  // Target values in dollars
  const targetVal = (startingBalance * targetPct) / 100
  const maxDdVal = -((startingBalance * maxDrawdownPct) / 100)

  // Construct series data
  const series = useMemo<ExtendedPoint[]>(() => {
    const raw: ExtendedPoint[] = []

    if (!points.length) {
      raw.push({
        date: '',
        value: 0,
        peak: 0,
        drawdown: 0,
        baseline: true,
        index: 0,
        returnPct: 0,
        drawdownPct: 0,
        pnlDelta: 0,
      })
    } else {
      // Add baseline $0 starting point
      raw.push({
        date: points[0]?.date ? points[0].date : '',
        value: 0,
        peak: 0,
        drawdown: 0,
        baseline: true,
        index: 0,
        returnPct: 0,
        drawdownPct: 0,
        pnlDelta: 0,
      })

      let currentPeak = 0
      points.forEach((pt, idx) => {
        const net = pt.value
        currentPeak = Math.max(currentPeak, net)
        const ddDollars = net - currentPeak
        const returnPct = startingBalance ? (net / startingBalance) * 100 : 0
        const ddPct = startingBalance ? (ddDollars / startingBalance) * 100 : 0
        const prevNet = idx > 0 ? points[idx - 1].value : 0
        const pnlDelta = net - prevNet

        raw.push({
          ...pt,
          index: idx + 1,
          peak: currentPeak,
          drawdown: ddDollars,
          returnPct,
          drawdownPct: ddPct,
          pnlDelta,
        })
      })
    }

    // Calculate EMA on primary values
    const primaryVals = raw.map((p) => p.value)
    const emaVals = calculateEMA(primaryVals, 5)
    return raw.map((p, i) => ({
      ...p,
      emaValue: emaVals[i],
    }))
  }, [points, startingBalance])

  // Key Milestones (Peak, Best session, Max DD session)
  const milestones = useMemo(() => {
    if (series.length <= 1) return { peakIdx: -1, bestIdx: -1, worstIdx: -1 }
    let maxVal = -Infinity
    let peakIdx = -1
    let maxWin = -Infinity
    let bestIdx = -1
    let maxLoss = Infinity
    let worstIdx = -1

    series.forEach((pt, idx) => {
      if (pt.baseline) return
      if (pt.value > maxVal) {
        maxVal = pt.value
        peakIdx = idx
      }
      if (pt.pnlDelta > maxWin) {
        maxWin = pt.pnlDelta
        bestIdx = idx
      }
      if (pt.pnlDelta < maxLoss) {
        maxLoss = pt.pnlDelta
        worstIdx = idx
      }
    })

    return { peakIdx, bestIdx, worstIdx }
  }, [series])

  // Current State Stats
  const lastPoint = series[series.length - 1]
  const currentNet = lastPoint ? lastPoint.value : 0

  // Map metric values based on mode
  const getValue = (pt: ExtendedPoint) => {
    switch (mode) {
      case 'balance':
        return startingBalance + pt.value
      case 'return':
        return pt.returnPct
      case 'drawdown':
        return pt.drawdownPct
      case 'pnl':
      default:
        return pt.value
    }
  }

  // Calculate Geometry & Paths
  const geometry = useMemo(() => {
    if (!width || !series.length) return null
    const left = 62 // Left margin for Y-axis numbers
    const right = width - 18 // Right margin
    const top = 26
    const bottom = height - 32
    const plotW = right - left
    const plotH = bottom - top

    const displayValues = series.map(getValue)
    const emaDisplayValues = series.map((p) => {
      const emaVal = p.emaValue ?? p.value
      if (mode === 'balance') return startingBalance + emaVal
      if (mode === 'return') return startingBalance ? (emaVal / startingBalance) * 100 : 0
      if (mode === 'drawdown') return 0
      return emaVal
    })

    // Mode specific target / dd values
    let modeTarget = targetVal
    let modeMaxDd = maxDdVal
    let modeZero = 0

    if (mode === 'balance') {
      modeTarget = startingBalance + targetVal
      modeMaxDd = startingBalance + maxDdVal
      modeZero = startingBalance
    } else if (mode === 'return') {
      modeTarget = targetPct
      modeMaxDd = -maxDrawdownPct
      modeZero = 0
    } else if (mode === 'drawdown') {
      modeTarget = 0
      modeMaxDd = -maxDrawdownPct
      modeZero = 0
    }

    let lo = Math.min(modeMaxDd * 1.12, ...displayValues)
    let hi = Math.max(modeTarget * 1.12, ...displayValues)

    if (mode === 'drawdown') {
      lo = Math.min(-maxDrawdownPct * 1.25, ...displayValues)
      hi = 0.5
    }

    const span = hi - lo || 1
    lo -= span * 0.04
    hi += span * 0.04

    const yFor = (val: number) => top + ((hi - val) / (hi - lo)) * plotH
    const xFor = (index: number) => left + (index / Math.max(1, series.length - 1)) * plotW

    const mainPts: ChartPoint[] = series.map((pt, idx) => ({
      x: xFor(idx),
      y: yFor(getValue(pt)),
    }))

    const emaPts: ChartPoint[] = series.map((_, idx) => ({
      x: xFor(idx),
      y: yFor(emaDisplayValues[idx]),
    }))

    const linePath = curveType === 'spline' ? smoothPath(mainPts) : stepPath(mainPts)
    const emaPath = smoothPath(emaPts)

    const targetY = clampChart(yFor(modeTarget), top, bottom)
    const zeroY = clampChart(yFor(modeZero), top, bottom)
    const maxDdY = clampChart(yFor(modeMaxDd), top, bottom)

    const areaPath = `${linePath} L ${mainPts[mainPts.length - 1].x.toFixed(2)} ${zeroY.toFixed(2)} L ${mainPts[0].x.toFixed(2)} ${zeroY.toFixed(2)} Z`

    // High Watermark Drawdown Shade Area (Zone between peak line & equity curve)
    const watermarkPts: ChartPoint[] = series.map((pt, idx) => {
      let val = pt.peak
      if (mode === 'balance') val = startingBalance + pt.peak
      if (mode === 'return') val = startingBalance ? (pt.peak / startingBalance) * 100 : 0
      if (mode === 'drawdown') val = 0
      return { x: xFor(idx), y: yFor(val) }
    })
    const watermarkTopLine = smoothPath(watermarkPts)

    // Generate 5 Ticks
    const formatTick = (v: number) => {
      if (mode === 'balance') return axisMoney(v)
      if (mode === 'return' || mode === 'drawdown') return `${plainPercent(v, 1)}%`
      return signedMoney(v)
    }

    const rawTicks = [
      { val: modeTarget, isTarget: true, label: `Target (${formatTick(modeTarget)})` },
      { val: modeZero + (modeTarget - modeZero) * 0.5, isMid: true, label: formatTick(modeZero + (modeTarget - modeZero) * 0.5) },
      { val: modeZero, isBase: true, label: mode === 'balance' ? formatMoney(startingBalance) : '$0' },
      { val: modeZero + (modeMaxDd - modeZero) * 0.5, isMid: true, label: formatTick(modeZero + (modeMaxDd - modeZero) * 0.5) },
      { val: modeMaxDd, isMaxDd: true, label: `Max DD (${formatTick(modeMaxDd)})` },
    ]

    const ticks = rawTicks.map((t) => ({
      ...t,
      y: yFor(t.val),
    }))

    return {
      left,
      right,
      top,
      bottom,
      plotW,
      plotH,
      yFor,
      xFor,
      mainPts,
      linePath,
      emaPath,
      areaPath,
      watermarkTopLine,
      targetY,
      zeroY,
      maxDdY,
      ticks,
      lo,
      hi,
      modeTarget,
      modeMaxDd,
      modeZero,
    }
  }, [width, series, mode, curveType, startingBalance, targetVal, maxDdVal, targetPct, maxDrawdownPct, height])

  const hoverPt = geometry && hoverIndex !== null ? series[hoverIndex] : null
  const hoverNet = hoverPt ? hoverPt.value : 0
  const hoverBalance = startingBalance + hoverNet
  const hoverReturnPct = startingBalance ? (hoverNet / startingBalance) * 100 : 0
  const hoverDdDollars = hoverPt ? hoverPt.drawdown : 0
  const hoverDdPct = hoverPt ? hoverPt.drawdownPct : 0

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry || !series.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const ratio = clampChart((localX - geometry.left) / geometry.plotW, 0, 1)
    setHoverIndex(Math.round(ratio * (series.length - 1)))
  }

  return (
    <div className={cn('space-y-3 w-full', className)}>
      {/* ---------- Chart Controls Bar ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        {/* Metric Mode Segmented Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-medium text-slate-400">
          <button
            onClick={() => setMode('pnl')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all whitespace-nowrap',
              mode === 'pnl' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:text-slate-200 hover:bg-slate-800/60',
            )}
          >
            Net P&amp;L ($)
          </button>
          <button
            onClick={() => setMode('balance')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all whitespace-nowrap',
              mode === 'balance' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:text-slate-200 hover:bg-slate-800/60',
            )}
          >
            Balance ($)
          </button>
          <button
            onClick={() => setMode('return')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all whitespace-nowrap',
              mode === 'return' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:text-slate-200 hover:bg-slate-800/60',
            )}
          >
            Return (%)
          </button>
          <button
            onClick={() => setMode('drawdown')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all whitespace-nowrap',
              mode === 'drawdown' ? 'bg-rose-600 text-white font-semibold shadow-sm' : 'hover:text-slate-200 hover:bg-slate-800/60',
            )}
          >
            Drawdown (%)
          </button>
        </div>

        {/* Spline vs Step Curve & Overlays */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-lg text-[11px]">
            <button
              onClick={() => setCurveType('spline')}
              className={cn('px-2 py-0.5 rounded transition-all', curveType === 'spline' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200')}
            >
              Spline
            </button>
            <button
              onClick={() => setCurveType('step')}
              className={cn('px-2 py-0.5 rounded transition-all', curveType === 'step' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200')}
            >
              Step
            </button>
          </div>

          {/* Feature Layer Toggles */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              onClick={() => setShowTarget(!showTarget)}
              className={cn('px-2 py-1 rounded border transition-all flex items-center gap-1', showTarget ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'border-slate-800 text-slate-500 hover:text-slate-300')}
            >
              <Target size={11} /> Target
            </button>
            <button
              onClick={() => setShowMaxDd(!showMaxDd)}
              className={cn('px-2 py-1 rounded border transition-all flex items-center gap-1', showMaxDd ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'border-slate-800 text-slate-500 hover:text-slate-300')}
            >
              <ShieldAlert size={11} /> Max DD
            </button>
            <button
              onClick={() => setShowWatermark(!showWatermark)}
              className={cn('px-2 py-1 rounded border transition-all flex items-center gap-1', showWatermark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-slate-800 text-slate-500 hover:text-slate-300')}
            >
              <Sparkles size={11} /> ATH Peak
            </button>
            <button
              onClick={() => setShowEma(!showEma)}
              className={cn('px-2 py-1 rounded border transition-all flex items-center gap-1', showEma ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'border-slate-800 text-slate-500 hover:text-slate-300')}
            >
              <Activity size={11} /> 5-EMA
            </button>
            <button
              onClick={() => setShowMarkers(!showMarkers)}
              className={cn('px-2 py-1 rounded border transition-all flex items-center gap-1', showMarkers ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'border-slate-800 text-slate-500 hover:text-slate-300')}
            >
              Key Events
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Main Interactive Chart Area ---------- */}
      <div
        ref={wrapRef}
        className="relative w-full rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-2xl p-1 overflow-hidden cursor-crosshair group"
        style={{ height }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {geometry && width > 0 && (
          <svg width={width} height={height} className="w-full h-full overflow-visible" role="img" aria-label="Performance Analytics Chart">
            <defs>
              {/* Electric Cobalt Blue Gradient */}
              <linearGradient id={`btc-blue-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.32} />
                <stop offset="50%" stopColor="#2563eb" stopOpacity={0.10} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
              </linearGradient>

              {/* Drawdown Underwater Crimson Gradient */}
              <linearGradient id={`btc-danger-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.05} />
                <stop offset="60%" stopColor="#e11d48" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#9f1239" stopOpacity={0.4} />
              </linearGradient>

              {/* High Watermark Drawdown Zone Fill */}
              <linearGradient id={`btc-drawdown-shade-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>

              {/* Line Stroke Gradient */}
              <linearGradient id={`btc-line-stroke-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#3b82f6" opacity={1} />
                <stop offset="100%" stopColor="#2563eb" opacity={1} />
              </linearGradient>

              {/* Glowing Blur Filter */}
              <filter id={`btc-glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Target Area Shading Band */}
            {showTarget && mode !== 'drawdown' && (
              <rect
                x={geometry.left}
                y={geometry.top}
                width={geometry.plotW}
                height={Math.max(0, geometry.targetY - geometry.top)}
                fill="#06b6d4"
                opacity={0.03}
              />
            )}

            {/* Max DD Danger Area Shading Band */}
            {showMaxDd && (
              <rect
                x={geometry.left}
                y={geometry.maxDdY}
                width={geometry.plotW}
                height={Math.max(0, geometry.bottom - geometry.maxDdY)}
                fill="#f43f5e"
                opacity={0.05}
              />
            )}

            {/* Gridlines & Left Y-Axis Values */}
            {geometry.ticks.map((tick, idx) => {
              if (tick.isTarget && !showTarget) return null
              if (tick.isMaxDd && !showMaxDd) return null
              return (
                <g key={`y-grid-${idx}`}>
                  <line
                    x1={geometry.left}
                    x2={geometry.right}
                    y1={tick.y}
                    y2={tick.y}
                    stroke={
                      tick.isTarget
                        ? '#06b6d4'
                        : tick.isMaxDd
                          ? '#f43f5e'
                          : tick.isBase
                            ? '#64748b'
                            : 'rgba(255, 255, 255, 0.05)'
                    }
                    strokeDasharray={tick.isTarget || tick.isMaxDd ? '4 4' : tick.isBase ? '2 2' : 'none'}
                    strokeWidth={tick.isTarget || tick.isMaxDd ? 1.2 : tick.isBase ? 1.2 : 0.8}
                    opacity={tick.isTarget || tick.isMaxDd ? 0.75 : tick.isBase ? 0.6 : 0.4}
                  />
                  <text
                    x={geometry.left - 10}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    fill={
                      tick.isTarget
                        ? '#22d3ee'
                        : tick.isMaxDd
                          ? '#fb7185'
                          : tick.isBase
                            ? '#94a3b8'
                            : '#64748b'
                    }
                    fontSize={10}
                    fontWeight={tick.isTarget || tick.isMaxDd || tick.isBase ? 600 : 400}
                    fontFamily="monospace"
                    className="tabular-nums select-none"
                  >
                    {tick.label}
                  </text>
                </g>
              )
            })}

            {/* High Watermark Peak Line (ATH) */}
            {showWatermark && mode !== 'drawdown' && (
              <g>
                <path
                  d={geometry.watermarkTopLine}
                  fill="none"
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  strokeWidth={1.2}
                  opacity={0.5}
                />
              </g>
            )}

            {/* Area Fill Under Equity Path */}
            <motion.path
              key={`area-${mode}-${points.length}`}
              d={geometry.areaPath}
              fill={`url(#btc-${mode === 'drawdown' || currentNet < 0 ? 'danger' : 'blue'}-fill-${gradientId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />

            {/* 5-Session EMA Overlay Path */}
            {showEma && (
              <motion.path
                d={geometry.emaPath}
                fill="none"
                stroke="#c084fc"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                opacity={0.7}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
              />
            )}

            {/* Main Primary Performance Line Path */}
            <motion.path
              key={`line-${mode}-${curveType}-${points.length}`}
              d={geometry.linePath}
              fill="none"
              stroke={mode === 'drawdown' ? '#f43f5e' : `url(#btc-line-stroke-${gradientId})`}
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#btc-glow-${gradientId})`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Key Milestone Markers */}
            {showMarkers && geometry.mainPts.map((pt, idx) => {
              const isPeak = idx === milestones.peakIdx && mode !== 'drawdown'
              const isBest = idx === milestones.bestIdx
              const isWorst = idx === milestones.worstIdx

              if (!isPeak && !isBest && !isWorst) return null

              return (
                <g key={`marker-${idx}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={6}
                    fill={isPeak ? '#f59e0b' : isBest ? '#10b981' : '#ef4444'}
                    opacity={0.25}
                    className="animate-ping"
                    style={{ animationDuration: '3s' }}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill={isPeak ? '#f59e0b' : isBest ? '#10b981' : '#ef4444'}
                    stroke="#090d16"
                    strokeWidth={2}
                  />
                </g>
              )
            })}

            {/* Active Position End-Point Marker */}
            {geometry.mainPts.length > 0 && (
              <g>
                <circle
                  cx={geometry.mainPts[geometry.mainPts.length - 1].x}
                  cy={geometry.mainPts[geometry.mainPts.length - 1].y}
                  r={8}
                  fill={currentNet >= 0 ? '#3b82f6' : '#f43f5e'}
                  opacity={0.3}
                  className="animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                <circle
                  cx={geometry.mainPts[geometry.mainPts.length - 1].x}
                  cy={geometry.mainPts[geometry.mainPts.length - 1].y}
                  r={4.5}
                  fill={currentNet >= 0 ? '#60a5fa' : '#fb7185'}
                  stroke="#020617"
                  strokeWidth={2.5}
                />
              </g>
            )}

            {/* Hover Laser Crosshair & Axis Guide Pills */}
            {hoverIndex !== null && hoverPt && (
              <g>
                {/* Vertical Cursor Line */}
                <line
                  x1={geometry.xFor(hoverIndex)}
                  x2={geometry.xFor(hoverIndex)}
                  y1={geometry.top}
                  y2={geometry.bottom}
                  stroke="#38bdf8"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  opacity={0.7}
                />

                {/* Horizontal Cursor Line */}
                <line
                  x1={geometry.left}
                  x2={geometry.right}
                  y1={geometry.yFor(getValue(hoverPt))}
                  y2={geometry.yFor(getValue(hoverPt))}
                  stroke="#38bdf8"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  opacity={0.5}
                />

                {/* Y-Axis Value Badge Pill */}
                <g transform={`translate(${geometry.left - 4}, ${geometry.yFor(getValue(hoverPt))})`}>
                  <rect
                    x={-56}
                    y={-10}
                    width={52}
                    height={20}
                    rx={4}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth={1}
                  />
                  <text
                    x={-30}
                    y={3.5}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize={9.5}
                    fontWeight={600}
                    fontFamily="monospace"
                  >
                    {mode === 'balance'
                      ? axisMoney(startingBalance + hoverNet)
                      : mode === 'return' || mode === 'drawdown'
                        ? `${plainPercent(mode === 'drawdown' ? hoverDdPct : hoverReturnPct, 1)}%`
                        : signedMoney(hoverNet)}
                  </text>
                </g>

                {/* Center Hover Point Circle */}
                <circle
                  cx={geometry.xFor(hoverIndex)}
                  cy={geometry.yFor(getValue(hoverPt))}
                  r={5.5}
                  fill={hoverNet >= 0 ? '#38bdf8' : '#fb7185'}
                  stroke="#020617"
                  strokeWidth={2.5}
                />
              </g>
            )}
          </svg>
        )}

        {/* Floating High-Contrast Glass Analytics Tooltip */}
        {hoverIndex !== null && hoverPt && geometry && width > 0 && (
          <div
            className="absolute z-30 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: clampChart(geometry.xFor(hoverIndex), 110, width - 110),
              top: clampChart(geometry.yFor(getValue(hoverPt)) - 65, 20, height - 120),
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[210px] space-y-2 text-xs">
              {/* Header: Date + Session Index */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                <span>{hoverPt.baseline ? 'Baseline Start' : formatShortDate(hoverPt.date)}</span>
                <span className="text-slate-500 font-semibold">#{hoverPt.index}</span>
              </div>

              {/* Primary Value */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-400 font-medium">Net P&amp;L</span>
                <b className={cn('font-mono font-bold text-sm', hoverNet >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {signedMoney(hoverNet)}
                </b>
              </div>

              {/* Details List */}
              <div className="space-y-1 text-[11px] font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Account Balance</span>
                  <span className="font-semibold">{formatMoney(hoverBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Return</span>
                  <span className={hoverReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {signedPercent(hoverReturnPct)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Gap</span>
                  <span className="text-cyan-400">{signedMoney(hoverNet - targetVal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">DD Safety Buffer</span>
                  <span className="text-emerald-400">{formatMoney(hoverNet - maxDdVal)}</span>
                </div>
                {hoverDdDollars < 0 && (
                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Drawdown from Peak</span>
                    <span className="text-rose-400 font-semibold">
                      {formatMoney(hoverDdDollars)} ({hoverDdPct.toFixed(2)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Date Axis Legend Footer ---------- */}
      {points.length > 0 && (
        <div className="flex justify-between items-center px-2 text-[11px] font-mono text-slate-400 pt-0.5">
          <span>{formatShortDate(points[0].date)}</span>
          <span className="text-slate-400 text-[10px]">
            {points.length} sessions tracked · Base ${formatMoney(startingBalance)}
          </span>
          <span>{formatShortDate(points[points.length - 1].date)}</span>
        </div>
      )}
    </div>
  )
}
