import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutProps {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
  className?: string
  ariaLabel?: string
}

export function Donut({
  segments,
  size = 112,
  thickness = 9,
  centerLabel,
  centerSub,
  className,
  ariaLabel = 'Distribution chart',
}: DonutProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  const radius = (size - thickness) / 2
  const center = size / 2
  let offset = 0
  const gap = total > 0 ? 0.7 : 0

  return (
    <div className={cn('donut', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={ariaLabel}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--line-soft)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((segment, index) => {
            const value = Math.max(0, segment.value)
            const pct = (value / total) * 100
            const dash = Math.max(0, pct - gap)
            const rotation = (offset / total) * 360 - 90
            offset += value
            if (value <= 0) return null
            return (
              <motion.circle
                key={`${segment.label}-${index}`}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${dash} 100`}
                transform={`rotate(${rotation} ${center} ${center})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              />
            )
          })}
      </svg>
      <div className="donut-center">
        {centerLabel && <b className="num">{centerLabel}</b>}
        {centerSub && <span>{centerSub}</span>}
      </div>
    </div>
  )
}
