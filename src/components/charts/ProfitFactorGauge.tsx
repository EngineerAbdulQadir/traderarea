import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

interface ProfitFactorGaugeProps {
  value: number
  hasProfit: boolean
  hasLoss: boolean
  className?: string
}

export function ProfitFactorGauge({ value, hasProfit, hasLoss, className }: ProfitFactorGaugeProps) {
  const rawScore = hasLoss ? value : hasProfit ? 3 : 0
  const pct = Math.min(100, Math.max(0, (rawScore / 3) * 100))
  const color =
    !hasProfit && !hasLoss
      ? 'var(--chart-neutral)'
      : value >= 2
        ? 'var(--chart-blue)'
        : value >= 1.5
          ? 'var(--chart-blue-soft)'
          : value >= 1
            ? 'var(--chart-blue-muted)'
            : 'var(--chart-neutral)'

  return (
    <div className={cn('pf-gauge', className)}>
      <svg viewBox="0 0 120 72" role="img" aria-label="Profit factor gauge">
        <path
          d="M 12 64 A 48 48 0 0 1 108 64"
          fill="none"
          stroke="var(--line)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 12 64 A 48 48 0 0 1 108 64"
          fill="none"
          stroke="var(--line-soft)"
          strokeWidth="1"
          strokeDasharray="1 5"
          strokeLinecap="round"
        />
        <motion.path
          d="M 12 64 A 48 48 0 0 1 108 64"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100 100"
          initial={{ strokeDashoffset: 100 }}
          animate={{ strokeDashoffset: 100 - pct }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <circle cx="12" cy="64" r="2" fill="var(--chart-axis)" />
        <circle cx="108" cy="64" r="2" fill="var(--chart-axis)" />
        <text x="60" y="56" textAnchor="middle" fill={color} fontSize="17" fontWeight="600" className="num">
          {hasLoss ? value.toFixed(2) : hasProfit ? '∞' : '—'}
        </text>
        <text x="60" y="66" textAnchor="middle" fill="var(--chart-axis)" fontSize="6.5" letterSpacing="1.6">
          PROFIT FACTOR
        </text>
      </svg>
    </div>
  )
}
