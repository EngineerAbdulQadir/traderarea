import { useMemo } from 'react'
import type { Trade } from '@/lib/types'
import { groupStats, hourLabel, tradeDow } from '@/lib/stats'
import { tradeHour } from '@/lib/trades'
import { WD_SHORT } from '@/lib/stats'
import { compactSignedMoney, plainPercent, signedMoney } from '@/lib/format'

interface HeatmapProps {
  trades: Trade[]
}

export function Heatmap({ trades }: HeatmapProps) {
  const data = useMemo(() => {
    const map = groupStats(trades, (trade) => {
      const hour = tradeHour(trade)
      return hour === null ? null : `${tradeDow(trade)}|${hour}`
    })
    const hoursSet = new Set<number>()
    trades.forEach((trade) => {
      const hour = tradeHour(trade)
      if (hour !== null) hoursSet.add(hour)
    })
    const hours = Array.from(hoursSet).sort((a, b) => a - b)
    const lo = hours.length ? hours[0] : 9
    const hi = hours.length ? hours[hours.length - 1] : 16
    const hourList: number[] = []
    for (let hour = lo; hour <= hi; hour++) hourList.push(hour)
    const weekdaysSet = new Set(trades.map((trade) => tradeDow(trade)))
    const days = [1, 2, 3, 4, 5, ...(weekdaysSet.has(6) ? [6] : []), ...(weekdaysSet.has(0) ? [0] : [])]
    const maxAbs = Math.max(1, ...Array.from(map.values()).map((group) => Math.abs(group.net)))
    return { map, hourList, days, maxAbs }
  }, [trades])

  if (!trades.length) return <div className="chart-empty">No trades in this range</div>
  if (!data.hourList.length) return <div className="chart-empty">No entry times recorded for these trades</div>

  return (
    <div className="heatmap-scroll">
      <div
        className="heatmap"
        style={{ gridTemplateColumns: `42px repeat(${data.hourList.length}, minmax(38px, 1fr))` }}
      >
        <span className="heatmap-corner" />
        {data.hourList.map((hour) => (
          <span className="heatmap-hour" key={`h-${hour}`}>{hourLabel(hour).slice(0, 2)}</span>
        ))}
        {data.days.map((day) => (
          <div className="heatmap-row-contents" key={`d-${day}`} style={{ display: 'contents' }}>
            <span className="heatmap-day">{WD_SHORT[day]}</span>
            {data.hourList.map((hour) => {
              const group = data.map.get(`${day}|${hour}`)
              if (!group) {
                return <span className="heatmap-cell is-empty" key={`${day}-${hour}`}>·</span>
              }
              const ratio = Math.abs(group.net) / data.maxAbs
              const positive = group.net >= 0
              return (
                <span
                  className={`heatmap-cell ${positive ? 'is-win' : 'is-loss'}`}
                  key={`${day}-${hour}`}
                  style={{
                    background: positive
                      ? `rgb(var(--pos-rgb) / ${(0.09 + ratio * 0.46).toFixed(2)})`
                      : `rgb(var(--neg-rgb) / ${(0.09 + ratio * 0.46).toFixed(2)})`,
                    borderColor: positive
                      ? `rgb(var(--pos-rgb) / ${(0.12 + ratio * 0.24).toFixed(2)})`
                      : `rgb(var(--neg-rgb) / ${(0.12 + ratio * 0.24).toFixed(2)})`,
                  }}
                  title={`${WD_SHORT[day]} ${hourLabel(hour)} · ${signedMoney(group.net)} · ${group.count} trades · ${plainPercent(group.winRate, 0)}% win`}
                >
                  {compactSignedMoney(group.net)}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Loss</span>
        <i className="neg" />
        <i className="flat" />
        <i className="pos" />
        <span>Profit</span>
        <span className="heatmap-legend-hint">Entry hour × weekday</span>
      </div>
    </div>
  )
}
