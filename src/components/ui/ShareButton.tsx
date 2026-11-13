import { useState } from 'react'
import { Share2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { shareCard } from '@/lib/shareCard'
import type { Stats } from '@/lib/types'

interface ShareButtonProps {
  stats: Stats
  accountName?: string
  rangeLabel?: string
  className?: string
}

export function ShareButton({ stats, accountName, rangeLabel, className }: ShareButtonProps) {
  const [busy, setBusy] = useState(false)
  const onClick = async () => {
    setBusy(true)
    try {
      await shareCard(stats, { accountName, rangeLabel })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="primary"
      size="sm"
      className={className}
      iconLeft={busy ? <Loader2 size={14} className="btn-spinner" /> : <Share2 size={14} />}
      onClick={onClick}
      disabled={busy || !stats || stats.count === 0}
    >
      Share stats
    </Button>
  )
}