import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'pos' | 'neg' | 'neutral' | 'warn' | 'accent'

export function KpiTile({
  label,
  value,
  sub,
  tone = 'neutral',
  children,
  className,
}: {
  label: string
  value: string | number
  sub?: ReactNode
  tone?: Tone
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('kpi-tile', className)}>
      <div className="kpi-top">
        <span className={cn('kpi-dot', `kpi-dot-${tone}`)} aria-hidden="true" />
        <span className="kpi-label">{label}</span>
      </div>
      <strong className={cn('kpi-value num', tone === 'pos' && 'is-pos', tone === 'neg' && 'is-neg')}>
        {value}
      </strong>
      {children}
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}
