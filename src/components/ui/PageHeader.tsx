import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  kicker?: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ kicker, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('page-head', className)}>
      <div className="page-head-copy">
        {kicker && <span className="page-kicker">{kicker}</span>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
