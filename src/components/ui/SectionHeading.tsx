import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  label: string
  hint?: string
  action?: ReactNode
  className?: string
}

export function SectionHeading({ label, hint, action, className }: SectionHeadingProps) {
  return (
    <div className={cn('section-head', className)}>
      <div className="section-head-copy">
        <span className="section-label">{label}</span>
        {hint && <span className="section-hint">{hint}</span>}
      </div>
      {action}
    </div>
  )
}
