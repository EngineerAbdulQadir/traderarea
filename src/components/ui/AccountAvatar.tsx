import { useId, type CSSProperties } from 'react'
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
  const uid = useId().replace(/:/g, '')

  return (
    <span
      className={cn('account-avatar', sizes[size], className)}
      style={{ '--avatar-fill': gradient } as CSSProperties}
      aria-hidden="true"
    >
      <svg className="account-avatar-tech" viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id={`ez-base-${uid}`} x1="2" y1="0" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e5eff" />
            <stop offset="52%" stopColor="#0e38a8" />
            <stop offset="100%" stopColor="#071a52" />
          </linearGradient>
          <radialGradient id={`ez-aura-${uid}`} cx="78%" cy="82%" r="72%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.48" />
            <stop offset="48%" stopColor="#2563eb" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#040d29" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`ez-sheen-${uid}`} x1="18" y1="0" x2="18" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`ez-rim-${uid}`} x1="4" y1="0" x2="32" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.62" />
            <stop offset="45%" stopColor="#60a5fa" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {/* Deep cobalt-sapphire base */}
        <rect width="36" height="36" rx="10" fill={`url(#ez-base-${uid})`} />

        {/* Cool electric-azure ambient glow */}
        <rect width="36" height="36" rx="10" fill={`url(#ez-aura-${uid})`} />

        {/* Subtle convex top glass reflection */}
        <path
          d="M0 10C0 4.477 4.477 0 10 0H26C31.523 0 36 4.477 36 10V15.5C29 18.2 23.5 19.2 18 19.2C12.5 19.2 7 18.2 0 15.5V10Z"
          fill={`url(#ez-sheen-${uid})`}
        />

        {/* Minimal precision optic ring */}
        <circle
          cx="18"
          cy="18"
          r="12.5"
          stroke="#93c5fd"
          strokeOpacity="0.16"
          strokeWidth="0.65"
        />

        {/* Crisp glass inner edge */}
        <rect
          x="0.8"
          y="0.8"
          width="34.4"
          height="34.4"
          rx="9.2"
          stroke={`url(#ez-rim-${uid})`}
          strokeWidth="0.85"
        />
      </svg>

      <span className="account-avatar-glyph">{badge}</span>
    </span>
  )
}
