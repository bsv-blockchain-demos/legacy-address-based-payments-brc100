import { useState, useEffect, useRef } from 'react'
import { getProgressCounts } from './batchDb'
import { ProgressCounts } from './batchTypes'

const DEFAULT_COUNTS: ProgressCounts = {
  discovered: 0,
  beefFetching: 0,
  beefFetched: 0,
  internalizing: 0,
  internalized: 0,
  error: 0,
  totalSatoshis: 0,
  internalizedSatoshis: 0,
}

export function useBatchProgress(active: boolean, pollIntervalMs = 2000): ProgressCounts {
  const [counts, setCounts] = useState<ProgressCounts>(DEFAULT_COUNTS)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Always do an immediate fetch on mount or when active changes
    getProgressCounts().then(setCounts).catch(console.error)

    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      getProgressCounts().then(setCounts).catch(console.error)
    }, pollIntervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [active, pollIntervalMs])

  return counts
}
