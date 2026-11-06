import { ChevronRight } from 'lucide-react'
import type { Account } from '@/lib/types'
import { accountBadge, accountGradient, accountMeta, titleFor } from '@/lib/accounts'
import { AccountAvatar } from './AccountAvatar'

export function AccountPill({
  account,
  onClick,
  compact = false,
  className,
}: {
  account: Account
  onClick?: () => void
  compact?: boolean
  className?: string
}) {
  return (
    <button className={`account-pill ${compact ? 'is-compact' : ''} ${className ?? ''}`} type="button" onClick={onClick}>
      <AccountAvatar badge={accountBadge(account)} gradient={accountGradient(account)} size="sm" />
      <span className="account-pill-copy">
        <b>{titleFor(account)}</b>
        <span>{accountMeta(account)}</span>
      </span>
      <ChevronRight size={14} className="account-pill-chevron" />
    </button>
  )
}
