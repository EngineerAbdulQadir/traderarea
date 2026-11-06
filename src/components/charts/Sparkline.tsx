import { useId } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

interface SparklineProps {
  data: number[]
  positive?: boolean
  height?: number
  className?: string
  strokeWidth?: number
  fill?: boolean
  animate?: boolean
  /** Override the auto green/red stroke, e.g. the brand blue for an equity curve. */
  color?: string
  /** Draw subtle horizontal guide lines behind the curve. */
  showGrid?: boolean
  /** Add a soft halo to the stroke for hero-sized charts. */
  glow?: boolean
}

function buildPath(
  values: number[],
  width: number,
  height: number,
  padding: number,
  verticalPadding = padding,
): { line: string; area: string } {
  if (!values.length) {
    return { line: `M ${padding} ${height / 2} L ${width - padding} ${height / 2}`, area: '' }
  }
  if (values.length === 1) {
    const y = height / 2
    return {
      line: `M ${padding} ${y} L ${width - padding} ${y}`,
      area: `M ${padding} ${y} L ${width - padding} ${y} L ${width - padding} ${height} L ${padding} ${height} Z`,
    }
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0
  const points = values.map((value, index) => ({
    x: padding + index * step,
    y: verticalPadding + ((max - value) / span) * (height - verticalPadding * 2),
  }))
  const line = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
      const prev = points[index - 1]
      const midX = (prev.x + point.x) / 2
      return `C ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    })
    .join(' ')
  const area = `${line} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`
  return { line, area }
}

export function Sparkline({
  data,
  positive = true,
  height = 52,
  className,
  strokeWidth = 1.6,
  fill = true,
  animate = true,
  color,
  showGrid = false,
  glow = false,
}: SparklineProps) {
  const gradientId = useId().replace(/:/g, '')
  const strokeGradientId = `${gradientId}-stroke`
  const width = 220
  const padding = 2
  const verticalPadding = Math.max(4, height * 0.08)
  const { line, area } = buildPath(data, width, height, padding, verticalPadding)
  const tone = color ?? (positive ? 'var(--chart-positive)' : 'var(--chart-negative)')
  const last = data.length ? data[data.length - 1] : 0
  const min = data.length ? Math.min(...data) : 0
  const max = data.length ? Math.max(...data) : 0
  const span = max - min || 1
  const lastX = width - padding
  const lastY =
    data.length === 1
      ? height / 2
      : verticalPadding + ((max - last) / span) * (height - verticalPadding * 2)

  return (
    <svg
      className={cn('sparkline', glow && 'sparkline-glow', className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Performance sparkline"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity={0.34} />
          <stop offset="62%" stopColor={tone} stopOpacity={0.08} />
          <stop offset="100%" stopColor={tone} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={tone} stopOpacity={0.45} />
          <stop offset="42%" stopColor={tone} stopOpacity={0.9} />
          <stop offset="100%" stopColor={tone} stopOpacity={1} />
        </linearGradient>
      </defs>
      {showGrid && (
        <g className="sparkline-grid" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={padding}
              x2={width - padding}
              y1={height * ratio}
              y2={height * ratio}
              stroke="var(--chart-grid)"
              strokeDasharray="2 7"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      )}
      {fill && area && <path d={area} fill={`url(#${gradientId})`} />}
      {animate ? (
        <motion.path
          className="sparkline-stroke"
          d={line}
          fill="none"
          stroke={`url(#${strokeGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : (
        <path
          className="sparkline-stroke"
          d={line}
          fill="none"
          stroke={`url(#${strokeGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {data.length > 0 && (
        <g>
          <circle cx={lastX} cy={lastY} r={7} fill={tone} opacity={0.12} />
          <circle cx={lastX} cy={lastY} r={2.6} fill={tone} />
        </g>
      )}
    </svg>
  )
}
