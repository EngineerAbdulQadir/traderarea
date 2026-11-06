import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useElementSize } from '@/hooks/useElementSize'
import { clampChart, smoothPath } from './chartUtils'
import { signedMoney } from '@/lib/format'

export interface IntradayPoint {
  time: string
  value: number
}

interface IntradayCurveProps {
  points: IntradayPoint[]
  height?: number
}

export function IntradayCurve({ points, height = 148 }: IntradayCurveProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const geometry = useMemo(() => {
    if (!width || points.length < 1) return null
    const left = 4
    const right = width - 4
    const top = 14
    const bottom = height - 14
    const values = points.map((point) => point.value)
    const min = Math.min(0, ...values)
    const max = Math.max(0, ...values)
    const span = max - min || 1
    const lo = min - span * 0.12
    const hi = max + span * 0.12
    const yFor = (value: number) => top + ((hi - value) / (hi - lo)) * (bottom - top)
    const xFor = (index: number) => left + (index / Math.max(1, points.length - 1)) * (right - left)
    const pts = points.map((point, index) => ({ x: xFor(index), y: yFor(point.value) }))
    const zeroY = yFor(0)
    const line = smoothPath(pts)
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${zeroY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${zeroY.toFixed(2)} Z`
    return { pts, line, area, zeroY, xFor, yFor, left, right }
  }, [width, points, height])

  const final = points[points.length - 1]?.value ?? 0
  const color = final >= 0 ? 'var(--chart-positive)' : 'var(--chart-negative)'
  const hoverPoint = hover !== null ? points[hover] : null

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const ratio = clampChart((localX - geometry.left) / (geometry.right - geometry.left), 0, 1)
    setHover(Math.round(ratio * (points.length - 1)))
  }

  return (
    <div ref={wrapRef} className="intraday-curve" style={{ height }}>
      {geometry && width > 0 && (
        <div
          className="intraday-curve-canvas"
          style={{ height }}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg width={width} height={height} className="chart-svg" role="img" aria-label="Intraday cumulative P&L curve">
            <defs>
              <linearGradient id="intraday-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <line
              x1={geometry.left}
              x2={geometry.right}
              y1={geometry.zeroY}
              y2={geometry.zeroY}
              stroke="var(--chart-grid)"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
            <motion.path
              d={geometry.area}
              fill="url(#intraday-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <motion.path
              d={geometry.line}
              fill="none"
              stroke={color}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            {geometry.pts.map((point, index) =>
              points.length <= 12 ? (
                <circle key={index} cx={point.x} cy={point.y} r={2.2} fill={color} stroke="var(--panel)" strokeWidth={1.2} />
              ) : null,
            )}
            {hover !== null && geometry.pts[hover] && (
              <>
                <line
                  x1={geometry.pts[hover].x}
                  x2={geometry.pts[hover].x}
                  y1={14}
                  y2={height - 14}
                  stroke="var(--chart-grid)"
                  strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={geometry.pts[hover].x} cy={geometry.pts[hover].y} r={3.4} fill={color} stroke="var(--panel)" strokeWidth={2} />
              </>
            )}
          </svg>
          {hoverPoint && geometry && (
            <div
              className="chart-tooltip"
              style={{
                left: clampChart(geometry.pts[hover as number].x, 58, width - 58),
                top: clampChart(geometry.pts[hover as number].y - 12, 36, height - 18),
              }}
            >
              <b className={hoverPoint.value >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(hoverPoint.value)}</b>
              <span>{hoverPoint.time || 'Session open'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
