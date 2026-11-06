import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useElementSize } from '@/hooks/useElementSize'
import { clampChart, smoothPath } from './chartUtils'
import { signedMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface IntradayPoint {
  time: string
  value: number
  tradeId?: string
  ticker?: string
  pnl?: number
  side?: string
  playbook?: string
}

interface IntradayCurveProps {
  points: IntradayPoint[]
  height?: number
  highlightTradeId?: string | null
  onHoverTrade?: (tradeId: string | null) => void
}

export function IntradayCurve({
  points,
  height = 168,
  highlightTradeId = null,
  onHoverTrade,
}: IntradayCurveProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const geometry = useMemo(() => {
    if (!width || points.length < 1) return null
    const left = 8
    const right = width - 8
    const top = 18
    const bottom = height - 18
    const values = points.map((point) => point.value)
    const min = Math.min(0, ...values)
    const max = Math.max(0, ...values)
    const span = max - min || 1
    const lo = min - span * 0.14
    const hi = max + span * 0.14
    const yFor = (value: number) => top + ((hi - value) / (hi - lo)) * (bottom - top)
    const xFor = (index: number) => left + (index / Math.max(1, points.length - 1)) * (right - left)
    const pts = points.map((point, index) => ({
      x: xFor(index),
      y: yFor(point.value),
      point,
      index,
    }))
    const zeroY = yFor(0)
    const line = smoothPath(pts)
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${zeroY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${zeroY.toFixed(2)} Z`
    return { pts, line, area, zeroY, xFor, yFor, left, right }
  }, [width, points, height])

  // Check if a trade is highlighted from outside (e.g. hovered in ledger table)
  const externalHighlightIndex = useMemo(() => {
    if (!highlightTradeId) return null
    const idx = points.findIndex((p) => p.tradeId === highlightTradeId)
    return idx >= 0 ? idx : null
  }, [highlightTradeId, points])

  const activeIndex = hoverIndex !== null ? hoverIndex : externalHighlightIndex
  const activePoint = activeIndex !== null && points[activeIndex] ? points[activeIndex] : null

  const final = points[points.length - 1]?.value ?? 0
  const color = final >= 0 ? 'var(--chart-positive)' : 'var(--chart-negative)'

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry || points.length <= 1) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const ratio = clampChart((localX - geometry.left) / (geometry.right - geometry.left), 0, 1)
    const nearest = Math.round(ratio * (points.length - 1))
    setHoverIndex(nearest)
    const p = points[nearest]
    onHoverTrade?.(p?.tradeId || null)
  }

  const onPointerLeave = () => {
    setHoverIndex(null)
    onHoverTrade?.(null)
  }

  return (
    <div ref={wrapRef} className="intraday-curve" style={{ height }}>
      {geometry && width > 0 && (
        <div
          className="intraday-curve-canvas"
          style={{ height }}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <svg width={width} height={height} className="chart-svg" role="img" aria-label="Intraday cumulative P&L curve">
            <defs>
              <linearGradient id="intraday-fill-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Zero break-even baseline */}
            <line
              x1={geometry.left}
              x2={geometry.right}
              y1={geometry.zeroY}
              y2={geometry.zeroY}
              stroke="var(--chart-grid)"
              strokeDasharray="3 4"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />

            {/* Area fill */}
            <motion.path
              d={geometry.area}
              fill="url(#intraday-fill-grad)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />

            {/* Main curve line */}
            <motion.path
              d={geometry.line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Individual trade execution dots */}
            {geometry.pts.map((pt, index) => {
              const trade = pt.point
              if (!trade.tradeId) {
                // Session start point
                return (
                  <circle
                    key={`pt-${index}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={2}
                    fill="var(--faint)"
                    opacity={0.6}
                  />
                )
              }
              const isWin = (trade.pnl ?? 0) > 0
              const isLoss = (trade.pnl ?? 0) < 0
              const dotColor = isWin ? 'var(--chart-positive)' : isLoss ? 'var(--chart-negative)' : 'var(--muted)'
              const isTargeted = activeIndex === index

              return (
                <g key={`pt-${trade.tradeId}-${index}`}>
                  {isTargeted && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={9}
                      fill={dotColor}
                      opacity={0.25}
                      className="animate-ping"
                      style={{ animationDuration: '1.6s' }}
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isTargeted ? 5.2 : 3.4}
                    fill={dotColor}
                    stroke="var(--panel, #121316)"
                    strokeWidth={isTargeted ? 2 : 1.4}
                    style={{ transition: 'all 0.16s ease' }}
                  />
                </g>
              )
            })}

            {/* Crosshair guide line for active point */}
            {activeIndex !== null && geometry.pts[activeIndex] && (
              <line
                x1={geometry.pts[activeIndex].x}
                x2={geometry.pts[activeIndex].x}
                y1={12}
                y2={height - 12}
                stroke="var(--border-strong, var(--text-2))"
                strokeDasharray="2 3"
                strokeWidth={1}
                opacity={0.6}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Interactive floating tooltip */}
          {activePoint && geometry && activeIndex !== null && geometry.pts[activeIndex] && (
            <div
              className="chart-tooltip intraday-tooltip"
              style={{
                left: clampChart(geometry.pts[activeIndex].x, 70, width - 70),
                top: clampChart(geometry.pts[activeIndex].y - 36, 10, height - 52),
              }}
            >
              <div className="intraday-tooltip-cum">
                <span className="intraday-tooltip-label">Cum. P&amp;L</span>
                <b className={activePoint.value >= 0 ? 'is-pos' : 'is-neg'}>
                  {signedMoney(activePoint.value)}
                </b>
              </div>
              {activePoint.ticker ? (
                <div className="intraday-tooltip-trade">
                  <span className="intraday-tooltip-sym">
                    {activePoint.ticker} {activePoint.side}
                  </span>
                  <span className={cn('intraday-tooltip-pnl', (activePoint.pnl ?? 0) >= 0 ? 'is-pos' : 'is-neg')}>
                    {signedMoney(activePoint.pnl ?? 0)}
                  </span>
                  <time className="intraday-tooltip-time">{activePoint.time}</time>
                </div>
              ) : (
                <div className="intraday-tooltip-sub">
                  <span>{activePoint.time || 'Session open'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
