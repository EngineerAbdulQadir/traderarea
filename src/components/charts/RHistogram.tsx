import { motion } from 'motion/react'
import { avgOf } from '@/lib/stats'
import { formatR, plainPercent } from '@/lib/format'
import { cn } from '@/lib/cn'

const BUCKETS = [
  { label: '<−2R', short: '<−2', lo: -Infinity, hi: -2 },
  { label: '−2 to −1', short: '−2/−1', lo: -2, hi: -1 },
  { label: '−1 to −0.5', short: '−1/−.5', lo: -1, hi: -0.5 },
  { label: '−0.5 to 0', short: '−.5/0', lo: -0.5, hi: 0 },
  { label: '0 to 0.5', short: '0/.5', lo: 0, hi: 0.5 },
  { label: '0.5 to 1', short: '.5/1', lo: 0.5, hi: 1 },
  { label: '1 to 2', short: '1/2', lo: 1, hi: 2 },
  { label: '>2R', short: '>2', lo: 2, hi: Infinity },
]

interface RHistogramProps {
  values: number[]
  className?: string
}

export function RHistogram({ values, className }: RHistogramProps) {
  if (!values.length) return <div className="chart-empty">No trades in this range</div>
  const counts = BUCKETS.map((bucket) => values.filter((value) => value >= bucket.lo && value < bucket.hi).length)
  const max = Math.max(1, ...counts)
  const average = avgOf(values)
  const best = Math.max(...values)
  const worst = Math.min(...values)
  const bigShare = values.filter((value) => value >= 1).length / values.length

  return (
    <div className={cn('r-histogram', className)}>
      <div className="r-histogram-plot">
        {BUCKETS.map((bucket, index) => (
          <div
            className="r-histogram-col"
            key={bucket.label}
            title={`${bucket.label}: ${counts[index]} trades`}
          >
            <span className="r-histogram-count num">{counts[index]}</span>
            <div className="r-histogram-track">
              <motion.i
                className={bucket.hi <= 0 ? 'neg' : 'pos'}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(counts[index] ? 4 : 0, (counts[index] / max) * 100)}%` }}
                transition={{ duration: 0.55, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="r-histogram-label">{bucket.short}</span>
          </div>
        ))}
      </div>
      <div className="r-histogram-foot">
        <span className="st-chip">Average <b className="num">{formatR(average)}</b></span>
        <span className="st-chip">Best <b className="num is-pos">{formatR(best)}</b></span>
        <span className="st-chip">Worst <b className="num is-neg">{formatR(worst)}</b></span>
        <span className="st-chip">≥ 1R <b className="num">{plainPercent(bigShare * 100, 0)}%</b></span>
      </div>
    </div>
  )
}
