import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useElementSize } from '@/hooks/useElementSize'
import { formatShortDate } from '@/lib/dates'
import { signedMoney, plainPercent } from '@/lib/format'
import type { DayRow } from '@/lib/types'
import { axisMoney, clampChart, smoothPath } from './chartUtils'

interface DailyPnlProps {
  days: DayRow[]
  type: 'daily' | 'cumulative'
  height?: number
  className?: string
  showStats?: boolean
}

export function DailyPnl({ days, type, height = 260, className, showStats = false }: DailyPnlProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  // Computed summary stats and series
  const stats = useMemo(() => {
    if (!days.length) {
      return {
        totalNet: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxDd: 0,
        bestDay: null as DayRow | null,
        worstDay: null as DayRow | null,
        avgDaily: 0,
        cumulativePoints: [] as { date: string; pnl: number; cumulative: number }[],
      }
    }

    let totalNet = 0
    let grossProfit = 0
    let grossLoss = 0
    let greenCount = 0
    let winSum = 0
    let winCount = 0
    let lossSum = 0
    let lossCount = 0

    let peak = 0
    let maxDd = 0

    let best: DayRow | null = null
    let worst: DayRow | null = null

    let running = 0
    const cumulativePoints = days.map((day) => {
      totalNet += day.pnl
      running += day.pnl
      if (running > peak) peak = running
      const dd = running - peak
      if (dd < maxDd) maxDd = dd

      if (day.pnl > 0) {
        greenCount++
        winSum += day.pnl
        winCount++
        grossProfit += day.pnl
      } else if (day.pnl < 0) {
        lossSum += day.pnl
        lossCount++
        grossLoss += Math.abs(day.pnl)
      }

      if (!best || day.pnl > best.pnl) best = day
      if (!worst || day.pnl < worst.pnl) worst = day

      return { date: day.date, pnl: day.pnl, cumulative: running }
    })

    const winRate = (greenCount / days.length) * 100
    const avgWin = winCount ? winSum / winCount : 0
    const avgLoss = lossCount ? Math.abs(lossSum / lossCount) : 0
    const profitFactor = grossLoss !== 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0
    const avgDaily = totalNet / days.length

    return {
      totalNet,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      maxDd,
      bestDay: best,
      worstDay: worst,
      avgDaily,
      cumulativePoints,
    }
  }, [days])

  // Geometry calculations
  const geometry = useMemo(() => {
    if (!width || !days.length) return null
    const left = 56
    const right = width - 16
    const top = 16
    const bottom = height - 28
    const plotW = right - left
    const plotH = bottom - top

    const values = type === 'daily' ? days.map((d) => d.pnl) : stats.cumulativePoints.map((p) => p.cumulative)
    const rawMin = Math.min(0, ...values)
    const rawMax = Math.max(0, ...values)

    const dataSpan = rawMax - rawMin
    const roughStep = dataSpan / 4 || 100
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const normalized = roughStep / magnitude
    let niceMultiplier = 1
    if (normalized > 2) niceMultiplier = 5
    if (normalized > 5) niceMultiplier = 10
    const step = niceMultiplier * magnitude

    const lo = Math.floor(rawMin / step) * step
    const hi = Math.ceil(rawMax / step) * step
    const range = hi - lo || step * 4

    const zeroY = top + ((hi - 0) / range) * plotH
    const slot = plotW / Math.max(1, days.length)
    const barWidth = Math.max(4, Math.min(24, slot * 0.6))
    const yFor = (value: number) => top + ((hi - value) / range) * plotH

    const bars = days.map((day, index) => {
      const x = left + index * slot + (slot - barWidth) / 2
      const valueY = yFor(day.pnl)
      const barY = day.pnl >= 0 ? valueY : zeroY
      const barH = Math.max(2, Math.abs(zeroY - valueY))
      return { day, index, x, y: barY, height: barH, width: barWidth, centerX: x + barWidth / 2 }
    })

    const cumPoints = stats.cumulativePoints.map((pt, index) => ({
      x: left + index * slot + slot / 2,
      y: yFor(pt.cumulative),
      ...pt,
    }))

    const cumPath = smoothPath(cumPoints.map((p) => ({ x: p.x, y: p.y })))
    const firstX = cumPoints[0]?.x ?? left
    const lastX = cumPoints[cumPoints.length - 1]?.x ?? right
    const cumAreaPath = `${cumPath} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`

    const ticks: { value: number; y: number }[] = []
    for (let v = lo; v <= hi; v += step) {
      ticks.push({ value: v, y: yFor(v) })
    }

    const interval = Math.max(1, Math.min(6, Math.floor(days.length / 4)))
    const xLabels = days.map((day, index) => ({
      date: formatShortDate(day.date),
      x: left + index * slot + slot / 2,
      show: index % interval === 0 || index === days.length - 1,
    }))

    return {
      left, right, top, bottom, plotW, plotH, zeroY, bars, cumPoints, cumPath, cumAreaPath, ticks, xLabels,
      xFor: (index: number) => left + index * slot + slot / 2,
    }
  }, [width, days, height, type, stats.cumulativePoints])

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const slot = geometry.plotW / Math.max(1, days.length)
    const index = Math.round((localX - geometry.left - slot / 2) / slot)
    setHover(clampChart(index, 0, days.length - 1))
  }

  const hovered = hover !== null ? days[hover] : null
  const hoveredCum = hover !== null && geometry ? geometry.cumPoints[hover]?.cumulative : null

  if (!days.length) return <div className="chart-empty" style={{ minHeight: height }}>No trading sessions</div>

  return (
    <div ref={wrapRef} className={`daily-pnl ${className ?? ''}`} style={{ height: 'auto' }}>
      <div className="daily-pnl-canvas" style={{ height }} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
        {geometry && width > 0 && (
          <svg width={width} height={height} className="chart-svg" role="img" aria-label={`${type} chart`}>
            <defs>
              <linearGradient id="pnl-pos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-positive)" stopOpacity="0.95" /><stop offset="100%" stopColor="var(--chart-positive)" stopOpacity="0.6" /></linearGradient>
              <linearGradient id="pnl-neg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-negative)" stopOpacity="0.6" /><stop offset="100%" stopColor="var(--chart-negative)" stopOpacity="0.95" /></linearGradient>
              <linearGradient id="cum-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-blue)" stopOpacity="0.3" /><stop offset="100%" stopColor="var(--chart-blue)" stopOpacity="0.0" /></linearGradient>
            </defs>
            {geometry.ticks.map((tick, index) => (
              <g key={index}>
                <line x1={geometry.left} x2={geometry.right} y1={tick.y} y2={tick.y} stroke="var(--chart-grid)" strokeDasharray={tick.value === 0 ? '0' : '2 6'} strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
                <text x={geometry.left - 8} y={tick.y + 3.5} textAnchor="end" fill="var(--chart-axis)" fontSize={9} fontFamily="InterVariable, sans-serif" className="num">{tick.value === 0 ? '$0' : axisMoney(tick.value)}</text>
              </g>
            ))}
            <line x1={geometry.left} x2={geometry.right} y1={geometry.zeroY} y2={geometry.zeroY} stroke="var(--line-strong)" strokeWidth={1.8} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" />
            
            {type === 'daily' && geometry.bars.map((bar, index) => (
              <motion.rect key={bar.day.date} x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={Math.min(3, bar.width / 2.5)} fill={bar.day.pnl >= 0 ? 'url(#pnl-pos)' : 'url(#pnl-neg)'} opacity={hover === null || hover === index ? 1 : 0.4} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.4, delay: Math.min(index * 0.015, 0.3) }} style={{ transformOrigin: `${bar.centerX}px ${geometry.zeroY}px` }} />
            ))}
            
            {type === 'cumulative' && (
              <>
                <motion.path d={geometry.cumAreaPath} fill="url(#cum-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
                <motion.path d={geometry.cumPath} fill="none" stroke="var(--chart-blue)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />
              </>
            )}
            
            {hover !== null && (
              <line x1={type === 'daily' ? geometry.bars[hover].centerX : geometry.cumPoints[hover].x} x2={type === 'daily' ? geometry.bars[hover].centerX : geometry.cumPoints[hover].x} y1={geometry.top} y2={geometry.bottom} stroke="var(--chart-axis)" strokeOpacity={0.6} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        )}
        {hovered && geometry && (
          <div className="chart-tooltip" style={{ left: clampChart(type === 'daily' ? geometry.bars[hover as number].centerX : geometry.cumPoints[hover as number].x, 80, width - 80), top: clampChart((type === 'daily' ? geometry.bars[hover as number].y : geometry.cumPoints[hover as number].y) - 16, 36, height - 35) }}>
            <div className="tooltip-date">{formatShortDate(hovered.date)}</div>
            <div className="tooltip-row"><span>Daily P&amp;L:</span><b className={hovered.pnl >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(hovered.pnl)}</b></div>
            {hoveredCum !== null && <div className="tooltip-row"><span>Cumulative:</span><b className={hoveredCum >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(hoveredCum)}</b></div>}
          </div>
        )}
      </div>

      {geometry && (
        <div className="chart-axis" style={{ paddingLeft: 56, paddingRight: 16, display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--faint)', marginTop: 6, position: 'relative', height: 16 }}>
          {geometry.xLabels.map((xl, i) => xl.show && <span key={i} style={{ position: 'absolute', transform: 'translateX(-50%)', left: xl.x, whiteSpace: 'nowrap' }}>{xl.date}</span>)}
        </div>
      )}

      {showStats && (
        <div className="chart-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
          {[{l:'Win rate',v:plainPercent(stats.winRate, 0)+'%'},{l:'Avg win/loss',v:<><span className="is-pos">{signedMoney(stats.avgWin)}</span>/<span className="is-neg">{signedMoney(stats.avgLoss)}</span></>},{l:'Profit factor',v:stats.profitFactor >= 99 ? '∞' : stats.profitFactor.toFixed(2)},{l:'Max drawdown',v:<span className="is-neg">{signedMoney(stats.maxDd)}</span>},{l:'Best/Worst',v:<><span className="is-pos">{stats.bestDay ? signedMoney(stats.bestDay.pnl) : '—'}</span>/<span className="is-neg">{stats.worstDay ? signedMoney(stats.worstDay.pnl) : '—'}</span></>}].map((s,i)=>(
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: '10px', color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{s.l}</span>
              <b className="num" style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.v}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
