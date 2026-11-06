import { motion } from 'motion/react'
import { compactSignedMoney, signedMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface ColumnItem {
  label: string
  value: number
  sub?: string
}

interface ColumnChartProps {
  items: ColumnItem[]
  height?: number
  className?: string
  emptyText?: string
}

export function ColumnChart({
  items,
  height = 168,
  className,
  emptyText = 'No data in this range',
}: ColumnChartProps) {
  if (!items.length) return <div className="chart-empty">{emptyText}</div>
  const maxAbs = Math.max(1, ...items.map((item) => Math.abs(item.value)))

  return (
    <div className={cn('column-chart', className)}>
      <div className="column-chart-plot" style={{ height }}>
        <div className="column-chart-grid" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
        <span className="column-chart-zero" aria-hidden="true" />
        <div className="column-chart-cols">
          {items.map((item, index) => {
            const ratio = Math.abs(item.value) / maxAbs
            const size = item.value ? Math.max(1.5, ratio * 47) : 0
            const positive = item.value >= 0
            return (
              <div
                className="column-col"
                key={`${item.label}-${index}`}
                title={`${item.label} · ${signedMoney(item.value)}${item.sub ? ` · ${item.sub}` : ''}`}
              >
                <div className="column-col-plot">
                  {item.value !== 0 && (
                    <motion.i
                      className={positive ? 'pos' : 'neg'}
                      style={{
                        ...(positive ? { bottom: '50%' } : { top: '50%' }),
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${size}%` }}
                      transition={{ duration: 0.6, delay: Math.min(index * 0.03, 0.28), ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </div>
                <span className="column-col-label">{item.label}</span>
                <span className={cn('column-col-value num', item.value > 0 && 'is-pos', item.value < 0 && 'is-neg')}>
                  {item.value ? compactSignedMoney(item.value) : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
