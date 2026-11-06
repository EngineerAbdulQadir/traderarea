import { motion } from 'motion/react'
import { compactSignedMoney, signedMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface BarListItem {
  label: string
  value: number
  sub?: string
  tone?: 'pos' | 'neg' | 'neutral' | 'auto'
}

interface BarListProps {
  items: BarListItem[]
  maxItems?: number
  className?: string
}

export function BarList({ items, maxItems, className }: BarListProps) {
  const rows = maxItems ? items.slice(0, maxItems) : items
  if (!rows.length) return <div className="chart-empty">No data in this range</div>
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.value)))

  return (
    <div className={cn('bar-list', className)}>
      {rows.map((row, index) => {
        const ratio = Math.abs(row.value) / maxAbs
        const tone = row.tone && row.tone !== 'auto' ? row.tone : row.value > 0 ? 'pos' : row.value < 0 ? 'neg' : 'neutral'
        const width = row.value ? Math.max(1.5, ratio * 50) : 0
        return (
          <div
            className="bar-row"
            key={`${row.label}-${index}`}
            title={`${row.label} · ${signedMoney(row.value)}${row.sub ? ` · ${row.sub}` : ''}`}
          >
            <div className="bar-row-copy">
              <b>{row.label}</b>
              {row.sub && <span>{row.sub}</span>}
            </div>
            <div className="bar-row-track">
              <i className="axis" aria-hidden="true" />
              <motion.i
                className={`bar ${tone}`}
                style={row.value >= 0 ? { left: '50%' } : { right: '50%' }}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.6, delay: Math.min(index * 0.035, 0.3), ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className={cn('bar-row-value num', row.value > 0 && 'is-pos', row.value < 0 && 'is-neg')}>
              {row.value ? compactSignedMoney(row.value) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
