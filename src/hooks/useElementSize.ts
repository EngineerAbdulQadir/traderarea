import { useCallback, useEffect, useState } from 'react'

export function useElementSize<T extends HTMLElement>(): [
  (node: T | null) => void,
  { width: number; height: number },
] {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const ref = useCallback((node: T | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element) {
      setSize({ width: 0, height: 0 })
      return
    }

    const rect = element.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) {
      setSize({ width: rect.width, height: rect.height })
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [ref, size]
}
