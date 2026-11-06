import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  interactive?: boolean
  glow?: boolean
}

export function Card({ children, className, interactive = false, glow = false, ...props }: CardProps) {
  return (
    <div className={cn('card', interactive && 'card-interactive', glow && 'card-glow', className)} {...props}>
      {children}
    </div>
  )
}
