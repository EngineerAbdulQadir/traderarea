import { useId } from 'react'
import { motion } from 'motion/react'
import type { ScoreComponent } from '@/lib/types'
import { cn } from '@/lib/cn'

interface RadarChartProps {
  components: ScoreComponent[]
  hasData: boolean
  size?: number
  className?: string
}

export function RadarChart({ components, hasData, size = 268, className }: RadarChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const cx = size / 2
  const cy = size / 2 + 2
  const radius = size * 0.3
  const count = components.length
  const angle = (index: number) => -Math.PI / 2 + (index / count) * Math.PI * 2
  const point = (index: number, r: number): [number, number] => [
    cx + Math.cos(angle(index)) * r,
    cy + Math.sin(angle(index)) * r,
  ]
  const ring = (fraction: number) =>
    components
      .map((_, index) => point(index, radius * fraction).map((value) => value.toFixed(1)).join(','))
      .join(' ')
  const shape = components
    .map((component, index) => point(index, radius * Math.max(0.04, component.score / 100)).map((value) => value.toFixed(1)).join(','))
    .join(' ')

  return (
    <div className={cn('radar-wrap', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Edge score radar">
        <defs>
          <linearGradient id={`radar-fill-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--chart-positive)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <polygon
            key={fraction}
            points={ring(fraction)}
            fill="none"
            stroke="var(--chart-grid)"
            strokeOpacity={fraction === 1 ? 1 : 0.6}
            strokeWidth={1}
          />
        ))}
        {components.map((_, index) => {
          const [x, y] = point(index, radius)
          return (
            <line
              key={index}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--line-soft)"
              strokeWidth={1}
            />
          )
        })}
        {hasData && (
          <>
            <motion.polygon
              points={shape}
              fill={`url(#radar-fill-${gradientId})`}
              stroke="var(--chart-line)"
              strokeWidth={1.6}
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            {components.map((component, index) => {
              const [x, y] = point(index, radius * Math.max(0.04, component.score / 100))
              return (
                <circle
                  key={component.label}
                  cx={x}
                  cy={y}
                  r={2.8}
                  fill="var(--chart-line)"
                  stroke="var(--panel)"
                  strokeWidth={1.4}
                />
              )
            })}
          </>
        )}
        {components.map((component, index) => {
          const [x, y] = point(index, radius + 24)
          const cos = Math.cos(angle(index))
          const anchor = Math.abs(cos) < 0.22 ? 'middle' : cos > 0 ? 'start' : 'end'
          return (
            <text
              key={component.label}
              x={x}
              y={y + 3}
              textAnchor={anchor}
              fill="var(--chart-axis)"
              fontSize={9}
              fontWeight={540}
              fontFamily="InterVariable, sans-serif"
              letterSpacing="0.015em"
            >
              {component.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
