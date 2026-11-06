import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

const sizes = {
  xs: 'account-avatar-xs',
  sm: 'account-avatar-sm',
  md: 'account-avatar-md',
  lg: 'account-avatar-lg',
} as const

export function AccountAvatar({
  badge,
  gradient,
  size = 'md',
  className,
}: {
  badge: string
  gradient: string
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      className={cn('account-avatar', sizes[size], className)}
      style={{ background: gradient } as CSSProperties}
      aria-hidden="true"
    >
      <span>{badge}</span>
    </span>
  )
}
