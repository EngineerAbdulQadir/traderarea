import { useId, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useElementSize } from '@/hooks/useElementSize'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import type { CumulativePoint } from '@/lib/stats'
import { axisMoney, clampChart, smoothPath, type ChartPoint } from './chartUtils'

interface EquityChartProps {
  points: CumulativePoint[]
  mode: 'equity' | 'drawdown'
  height?: number
  className?: string
}

interface BaselinePoint extends CumulativePoint {
  baseline?: boolean
}

export function EquityChart({ points, mode, height = 236, className }: EquityChartProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gradientId = useId().replace(/:/g, '')

  const series = useMemo<BaselinePoint[]>(() => {
    if (!points.length) return []
    return [
      { date: '', value: 0, peak: 0, drawdown: 0, baseline: true },
      ...points,
    ]
  }, [points])

  const geometry = useMemo(() => {
    if (!width || !series.length) return null
    const left = 2
    const right = Math.max(118, width - 58)
    const top = 12
    const bottom = height - 12
    const plotW = right - left
    const plotH = bottom - top
    const values = series.map((point) => (mode === 'equity' ? point.value : point.drawdown))
    let lo = Math.min(0, ...values)
    let hi = Math.max(0, ...values)
    const span = hi - lo || 1
    lo -= span * 0.12
    hi += span * 0.12
    const yFor = (value: number) => top + ((hi - value) / (hi - lo)) * plotH
    const xFor = (index: number) => left + (index / Math.max(1, series.length - 1)) * plotW
    const pts: ChartPoint[] = series.map((point, index) => ({
      x: xFor(index),
      y: yFor(mode === 'equity' ? point.value : point.drawdown),
    }))
    const line = smoothPath(pts)
    const zeroY = clampChart(yFor(0), top, bottom)
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${zeroY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${zeroY.toFixed(2)} Z`
    const ticks = Array.from({ length: 4 }, (_, index) => {
      const value = hi - ((hi - lo) * index) / 3
      return { value, y: yFor(value) }
    })
    return { left, right, top, bottom, plotW, plotH, yFor, xFor, pts, line, area, zeroY, ticks }
  }, [width, series, mode, height])

  const last = series[series.length - 1]
  const finalValue = last ? (mode === 'equity' ? last.value : last.drawdown) : 0
  const color = mode === 'drawdown' ? 'var(--chart-negative)' : 'var(--chart-line)'
  const hoverPoint = geometry && hover !== null ? series[hover] : null
  const hoverValue = hoverPoint ? (mode === 'equity' ? hoverPoint.value : hoverPoint.drawdown) : 0

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry || !series.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const ratio = clampChart((localX - geometry.left) / geometry.plotW, 0, 1)
    setHover(Math.round(ratio * (series.length - 1)))
  }

  return (
    <div className={cn('chart-frame equity-chart', className)}>
      {!points.length ? (
        <div className="chart-empty" style={{ minHeight: height }}>
          No closed trades in this range yet
        </div>
      ) : (
        <div
          ref={wrapRef}
          className="equity-chart-canvas"
          style={{ height }}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          {geometry && width > 0 && (
            <svg width={width} height={height} className="chart-svg" role="img" aria-label={`${mode} chart`}>
              <defs>
                <linearGradient id={`eq-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                  <stop offset="70%" stopColor={color} stopOpacity={0.035} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`eq-stroke-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                  <stop offset="55%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={1} />
                </linearGradient>
              </defs>

              {geometry.ticks.map((tick, index) => (
                <g key={index}>
                  <line
                    x1={geometry.left}
                    x2={geometry.right}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="var(--chart-grid)"
                    strokeDasharray={index === 0 ? '0' : '2 5'}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={width - 4}
                    y={tick.y + 3}
                    textAnchor="end"
                    fill="var(--chart-axis)"
                    fontSize={8.5}
                    fontFamily="InterVariable, sans-serif"
                    className="num"
                  >
                    {axisMoney(tick.value)}
                  </text>
                </g>
              ))}

              <line
                x1={geometry.left}
                x2={geometry.right}
                y1={geometry.zeroY}
                y2={geometry.zeroY}
                stroke="var(--line-strong)"
                vectorEffect="non-scaling-stroke"
              />

              <motion.path
                key={`area-${mode}-${points.length}-${Math.round(finalValue)}`}
                d={geometry.area}
                fill={`url(#eq-fill-${gradientId})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />

              <motion.path
                key={`line-${mode}-${points.length}-${Math.round(finalValue)}`}
                d={geometry.line}
                fill="none"
                stroke={`url(#eq-stroke-${gradientId})`}
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />

              {geometry.pts.length > 1 && (
                <g>
                  <circle
                    cx={geometry.pts[geometry.pts.length - 1].x}
                    cy={geometry.pts[geometry.pts.length - 1].y}
                    r={7}
                    fill={color}
                    opacity={0.14}
                  />
                  <circle
                    cx={geometry.pts[geometry.pts.length - 1].x}
                    cy={geometry.pts[geometry.pts.length - 1].y}
                    r={2.8}
                    fill={color}
                    stroke="var(--panel)"
                    strokeWidth={1.4}
                  />
                </g>
              )}

              {hover !== null && hoverPoint && (
                <g>
                  <line
                    x1={geometry.xFor(hover)}
                    x2={geometry.xFor(hover)}
                    y1={geometry.top}
                    y2={geometry.bottom}
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={geometry.xFor(hover)}
                    cy={geometry.yFor(hoverValue)}
                    r={3.4}
                    fill={color}
                    stroke="var(--panel)"
                    strokeWidth={2}
                  />
                </g>
              )}
            </svg>
          )}

          {hover !== null && hoverPoint && geometry && width > 0 && (
            <div
              className="chart-tooltip"
              style={{
                left: clampChart(geometry.xFor(hover), 64, width - 64),
                top: clampChart(geometry.yFor(hoverValue) - 16, 40, height - 20),
              }}
            >
              <b className={hoverValue >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(hoverValue)}</b>
              <span>
                {hoverPoint.baseline ? 'Session start' : formatShortDate(hoverPoint.date)}{' '}
                <em>{mode === 'equity' ? 'equity' : 'drawdown'}</em>
              </span>
            </div>
          )}
        </div>
      )}
      {points.length > 0 && (
        <div className="chart-axis">
          <span>{formatShortDate(points[0].date)}</span>
          <span>{points.length > 2 ? formatShortDate(points[Math.floor(points.length / 2)].date) : ''}</span>
          <span>{formatShortDate(points[points.length - 1].date)}</span>
        </div>
      )}
    </div>
  )
}
