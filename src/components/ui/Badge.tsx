import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'pos' | 'neg' | 'warn' | 'neutral' | 'accent' | 'violet'

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  className?: string
}) {
  return (
    <span className={cn('badge', `badge-${tone}`, className)}>
      {dot && <i className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}
