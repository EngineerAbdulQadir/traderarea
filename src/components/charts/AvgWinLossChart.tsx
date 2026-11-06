import { motion } from 'motion/react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

interface AvgWinLossChartProps {
  avgWin: number
  avgLoss: number
  avgWl: number
  count: number
  className?: string
}

export function AvgWinLossChart({
  avgWin,
  avgLoss,
  avgWl,
  count,
  className,
}: AvgWinLossChartProps) {
  const hasWin = avgWin > 0 && count > 0
  const hasLoss = avgLoss > 0 && count > 0

  const maxVal = Math.max(avgWin, avgLoss, 1)
  const winWidth = hasWin ? Math.max(6, (avgWin / maxVal) * 100) : 0
  const lossWidth = hasLoss ? Math.max(6, (avgLoss / maxVal) * 100) : 0

  const ratioText = !count ? '—' : hasLoss ? `${avgWl.toFixed(2)}×` : hasWin ? '∞' : '0.00×'

  return (
    <div
      className={cn('avg-wl-bars', className)}
      role="img"
      aria-label={`Avg win ${formatMoney(avgWin)}, avg loss ${formatMoney(avgLoss)}, payoff ratio ${ratioText}`}
    >
      <div className="avg-wl-row">
        <div className="avg-wl-meta">
          <span className="avg-wl-tag">Avg win</span>
          <strong className="avg-wl-val num is-pos">{hasWin ? formatMoney(avgWin) : '—'}</strong>
        </div>
        <div className="avg-wl-track">
          <motion.i
            className="avg-wl-fill is-pos"
            initial={{ width: 0 }}
            animate={{ width: `${winWidth}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="avg-wl-row">
        <div className="avg-wl-meta">
          <span className="avg-wl-tag">Avg loss</span>
          <strong className="avg-wl-val num is-neg">
            {hasLoss ? `−${formatMoney(avgLoss)}` : '—'}
          </strong>
        </div>
        <div className="avg-wl-track">
          <motion.i
            className="avg-wl-fill is-neg"
            initial={{ width: 0 }}
            animate={{ width: `${lossWidth}%` }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="avg-wl-foot">
        <span className="avg-wl-tag">Payoff multiple</span>
        <b className="num">{ratioText}</b>
      </div>
    </div>
  )
}
