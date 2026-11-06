import { useEffect, useState } from 'react'
import { readStorage, writeStorage } from '@/lib/storage'

export function usePersistentState(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => readStorage(key, fallback))

  useEffect(() => {
    writeStorage(key, value)
  }, [key, value])

  return [value, setValue]
}
