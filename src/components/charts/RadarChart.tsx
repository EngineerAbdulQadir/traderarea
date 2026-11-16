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

  const vertices = components.map((component, index) =>
    point(index, radius * Math.max(0.06, component.score / 100)),
  )

  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ]

  return (
    <div className={cn('radar-wrap', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Edge score radar">
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
        {hasData && count > 0 && (
          <motion.g
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            {components.map((component, index) => {
              const prev = vertices[(index - 1 + count) % count]
              const curr = vertices[index]
              const next = vertices[(index + 1) % count]
              const mPrev = mid(prev, curr)
              const mNext = mid(curr, next)
              const isPositive = component.score >= 50
              const fill = isPositive
                ? 'rgb(var(--chart-blue-rgb) / 0.22)'
                : 'rgb(var(--chart-negative-rgb) / 0.22)'
              const stroke = isPositive ? 'var(--chart-blue)' : 'var(--chart-negative)'
              const sectorPath = `M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${mPrev[0].toFixed(1)} ${mPrev[1].toFixed(1)} L ${curr[0].toFixed(1)} ${curr[1].toFixed(1)} L ${mNext[0].toFixed(1)} ${mNext[1].toFixed(1)} Z`
              const edgePath = `M ${mPrev[0].toFixed(1)} ${mPrev[1].toFixed(1)} L ${curr[0].toFixed(1)} ${curr[1].toFixed(1)} L ${mNext[0].toFixed(1)} ${mNext[1].toFixed(1)}`
              return (
                <g key={component.label}>
                  <path d={sectorPath} fill={fill} />
                  <path
                    d={edgePath}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )
            })}
            {components.map((component, index) => {
              const [x, y] = vertices[index]
              return (
                <circle
                  key={component.label}
                  cx={x}
                  cy={y}
                  r={3.2}
                  fill={component.score >= 50 ? 'var(--chart-blue)' : 'var(--chart-negative)'}
                  stroke="var(--panel)"
                  strokeWidth={1.4}
                />
              )
            })}
          </motion.g>
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
