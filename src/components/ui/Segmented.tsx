import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface SegmentedProps<T extends string> {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
  size?: 'sm' | 'md'
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = 'md',
}: SegmentedProps<T>) {
  const layoutId = useId()
  return (
    <div className={cn('seg', size === 'sm' && 'seg-sm', className)} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={cn('seg-item', active && 'is-active')}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="seg-thumb"
                transition={{ type: 'spring', stiffness: 460, damping: 38 }}
              />
            )}
            <span className="seg-content">
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
