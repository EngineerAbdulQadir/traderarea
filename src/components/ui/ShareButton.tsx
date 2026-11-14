import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { ShareCardModal } from '@/components/modals/ShareCardModal'
import type { Trade } from '@/lib/types'

export function CertificateIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="3"
        width="14"
        height="10.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 6.75H9.25M5 9.5H7.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="12.25"
        cy="9"
        r="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M11.25 10.75V15L12.25 14.1L13.25 15V10.75"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
        iconLeft={icon ?? <CertificateIcon size={15} />}
        onClick={() => setOpen(true)}
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