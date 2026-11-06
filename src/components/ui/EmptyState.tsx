import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: ReactNode
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
  className?: string
}

export function EmptyState({ icon, eyebrow, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="empty-icon">{icon}</div>
      {eyebrow && <span className="empty-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      <p>{description}</p>
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  )
}
