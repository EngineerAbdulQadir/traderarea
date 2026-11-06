import { useEffect, useRef, useState } from 'react'

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useCountUp(value: number, decimals = 0, duration = 700): number {
  const [display, setDisplay] = useState(value)
  const previous = useRef(value)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const from = previous.current
    const to = Number(value) || 0
    previous.current = to

    if (reducedMotion() || Math.abs(to - from) < Math.pow(10, -decimals) / 2) {
      setDisplay(to)
      return
    }

    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }

    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [value, decimals, duration])

  return display
}
