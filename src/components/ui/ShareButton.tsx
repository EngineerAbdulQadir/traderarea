import { useState, type ReactNode } from 'react'
import { Award } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ShareCardModal } from '@/components/modals/ShareCardModal'
import type { Trade } from '@/lib/types'

interface ShareButtonProps {
  trades: Trade[]
  startingBalance: number
  accountName?: string
  firmName?: string
  accountMeta?: string
  currency?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  icon?: ReactNode
  className?: string
}

export function ShareButton({
  trades,
  startingBalance,
  accountName,
  firmName,
  accountMeta,
  currency,
  label = 'Certificate',
  variant = 'primary',
  icon,
  className,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        className={className}
        iconLeft={icon ?? <Award size={14} />}
        onClick={() => setOpen(true)}
        disabled={!trades || trades.length === 0}
      >
        {label}
      </Button>

      <ShareCardModal
        open={open}
        onClose={() => setOpen(false)}
        trades={trades}
        startingBalance={startingBalance}
        accountName={accountName}
        firmName={firmName}
        accountMeta={accountMeta}
        currency={currency}
      />
    </>
  )
}