import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useElementSize } from '@/hooks/useElementSize'
import { formatShortDate } from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import type { DayRow } from '@/lib/types'
import { clampChart } from './chartUtils'

interface DailyPnlProps {
  days: DayRow[]
  height?: number
  className?: string
}

export function DailyPnl({ days, height = 224, className }: DailyPnlProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const geometry = useMemo(() => {
    if (!width || !days.length) return null
    const left = 44
    const right = width - 12
    const top = 14
    const bottom = height - 20
    const plotW = right - left
    const plotH = bottom - top
    const maxAbs = Math.max(1, ...days.map((day) => Math.abs(day.pnl)))
    const hi = maxAbs * 1.18
    const lo = -maxAbs * 1.18
    const zeroY = top + ((hi - 0) / (hi - lo)) * plotH
    const slot = plotW / Math.max(1, days.length)
    const barWidth = Math.max(3, Math.min(26, slot * 0.56))
    const yFor = (value: number) => top + ((hi - value) / (hi - lo)) * plotH
    const bars = days.map((day, index) => {
      const x = left + index * slot + (slot - barWidth) / 2
      const valueY = yFor(day.pnl)
      const barY = day.pnl >= 0 ? valueY : zeroY
      const barH = Math.max(1.5, Math.abs(zeroY - valueY))
      return { day, index, x, y: barY, height: barH, width: barWidth }
    })
    const avg = days.reduce((sum, day) => sum + day.pnl, 0) / days.length
    const avgY = yFor(avg)
    const ticks = Array.from({ length: 5 }, (_, index) => {
      const value = hi - ((hi - lo) * index) / 4
      return { value, y: yFor(value) }
    })
    return { left, right, top, bottom, plotW, plotH, zeroY, bars, avgY, ticks, xFor: (index: number) => left + index * slot + slot / 2 }
  }, [width, days, height])

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const slot = geometry.plotW / Math.max(1, days.length)
    const index = Math.round((localX - geometry.left - slot / 2) / slot)
    setHover(clampChart(index, 0, days.length - 1))
  }

  const hovered = hover !== null ? days[hover] : null

  if (!days.length) {
    return <div className="chart-empty" style={{ minHeight: height }}>No sessions in this range</div>
  }

  return (
    <div ref={wrapRef} className={`daily-pnl ${className ?? ''}`} style={{ height }}>
      <div
        className="daily-pnl-canvas"
        style={{ height }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        {geometry && width > 0 && (
          <svg width={width} height={height} className="chart-svg" role="img" aria-label="Daily profit and loss chart">
            <defs>
              <linearGradient id="daily-pos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-positive)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--chart-positive)" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="daily-neg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-negative)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--chart-negative)" stopOpacity="0.95" />
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
                  strokeDasharray={index === 4 ? '0' : '2 5'}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={geometry.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  fill="var(--chart-axis)"
                  fontSize={8}
                  fontFamily="InterVariable, sans-serif"
                  className="num"
                >
                  {Math.abs(tick.value) < 1 ? '$0' : `${tick.value < 0 ? '−' : ''}$${Math.abs(tick.value) >= 1000 ? `${(Math.abs(tick.value) / 1000).toFixed(1).replace('.0', '')}K` : Math.round(Math.abs(tick.value))}`}
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

            <line
              x1={geometry.left}
              x2={geometry.right}
              y1={geometry.avgY}
              y2={geometry.avgY}
              stroke="var(--chart-line)"
              strokeOpacity={0.5}
              strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
            <text x={geometry.right - 2} y={geometry.avgY - 4} textAnchor="end" fill="var(--chart-axis)" fontSize={7}>
              avg
            </text>

            {geometry.bars.map((bar, index) => (
              <motion.rect
                key={bar.day.date}
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx={Math.min(2.5, bar.width / 3)}
                fill={bar.day.pnl >= 0 ? 'url(#daily-pos)' : 'url(#daily-neg)'}
                opacity={hover === null || hover === index ? 1 : 0.45}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.55, delay: Math.min(index * 0.022, 0.4), ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: `${bar.x + bar.width / 2}px ${geometry.zeroY}px` }}
              />
            ))}

            {hover !== null && geometry.bars[hover] && (
              <line
                x1={geometry.xFor(hover)}
                x2={geometry.xFor(hover)}
                y1={geometry.top}
                y2={geometry.bottom}
                stroke="var(--chart-grid)"
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}

        {hovered && geometry && width > 0 && (
          <div
            className="chart-tooltip"
            style={{
              left: clampChart(geometry.xFor(hover as number), 64, width - 64),
              top: clampChart(geometry.bars[hover as number].y - 10, 38, height - 20),
            }}
          >
            <b className={hovered.pnl >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(hovered.pnl)}</b>
            <span>
              {formatShortDate(hovered.date)} <em>{hovered.count} trades</em>
            </span>
          </div>
        )}
      </div>

      {geometry && (
        <div className="chart-axis" style={{ paddingLeft: 44, paddingRight: 12 }}>
          <span>{formatShortDate(days[0].date)}</span>
          <span>{days.length > 2 ? formatShortDate(days[Math.floor(days.length / 2)].date) : ''}</span>
          <span>{formatShortDate(days[days.length - 1].date)}</span>
        </div>
      )}
    </div>
  )
}
