import { useState, useEffect, useCallback } from 'react'

interface CacheOptions {
  ttl?: number // Time to live in milliseconds (default: 2 minutes)
  key: string // Unique cache key
}

interface CachedData<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  lastFetch: Date | null
}

/**
 * Custom hook for cached API fetching with stale-while-revalidate pattern
 * Shows cached data immediately while fetching fresh data in the background
 */
export function useCachedFetch<T>(
  url: string | null,
  options: CacheOptions = { key: '', ttl: 120000 } // Default 2 minutes
): CachedData<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const cacheKey = `cache_${options.key || url}`
  const timestampKey = `cache_ts_${options.key || url}`
  const ttl = options.ttl || 120000 // 2 minutes default

  // Load from cache on mount
  useEffect(() => {
    if (!url) return

    try {
      const cached = localStorage.getItem(cacheKey)
      const cachedTimestamp = localStorage.getItem(timestampKey)
      
      if (cached && cachedTimestamp) {
        const timestamp = new Date(cachedTimestamp)
        const age = Date.now() - timestamp.getTime()
        
        // If cache is still valid, use it immediately
        if (age < ttl) {
          setData(JSON.parse(cached))
          setLastFetch(timestamp)
        }
      }
    } catch (e) {
      console.error('Error loading cache:', e)
    }
  }, [url, cacheKey, timestampKey, ttl])

  const fetchData = useCallback(async (showLoading = false) => {
    if (!url) return

    if (showLoading) setLoading(true)
    
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch data')
      const result = await response.json()
      
      // Update cache with error handling for quota exceeded
      try {
        const dataString = JSON.stringify(result)
        const dataSizeMB = dataString.length / 1024 / 1024
        
        // Check if data is too large (localStorage limit is usually 5-10MB)
        if (dataSizeMB > 4) { // 4MB threshold
          console.warn(`Data too large to cache (${dataSizeMB.toFixed(2)}MB), skipping cache for ${cacheKey}`)
          setLastFetch(new Date())
          setData(result)
          setError(null)
          return
        }
        
        localStorage.setItem(cacheKey, dataString)
        const now = new Date()
        localStorage.setItem(timestampKey, now.toISOString())
        setLastFetch(now)
      } catch (e: any) {
        if (e?.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
          console.warn(`Storage quota exceeded for ${cacheKey}, clearing old cache entries...`)
          
          // Clear old cache entries to make room
          try {
            const keysToRemove: string[] = []
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && (key.startsWith('cache_') || key.startsWith('cache_ts_')) && !key.includes(cacheKey)) {
                keysToRemove.push(key)
              }
            }
            
            // Remove oldest entries first (by checking timestamps)
            const entriesWithAge: Array<{ key: string; age: number }> = []
            keysToRemove.forEach(key => {
              if (key.startsWith('cache_ts_')) {
                const timestamp = localStorage.getItem(key)
                if (timestamp) {
                  const age = Date.now() - new Date(timestamp).getTime()
                  const dataKey = key.replace('cache_ts_', 'cache_')
                  entriesWithAge.push({ key: dataKey, age })
                }
              }
            })
            
            // Sort by age (oldest first) and remove top 50%
            entriesWithAge.sort((a, b) => b.age - a.age) // Oldest first
            const toRemove = entriesWithAge.slice(0, Math.ceil(entriesWithAge.length * 0.5))
            
            toRemove.forEach(({ key }) => {
              localStorage.removeItem(key)
              localStorage.removeItem(`cache_ts_${key.replace('cache_', '')}`)
            })
            
            // Try again after cleanup
            try {
              const dataString = JSON.stringify(result)
              if (dataString.length < 4 * 1024 * 1024) { // Only if under 4MB
                localStorage.setItem(cacheKey, dataString)
                const now = new Date()
                localStorage.setItem(timestampKey, now.toISOString())
                setLastFetch(now)
              } else {
                console.warn(`Data still too large after cleanup, not caching ${cacheKey}`)
                setLastFetch(new Date())
              }
            } catch (e2: any) {
              console.warn('Still failed to cache after cleanup:', e2)
              setLastFetch(new Date())
            }
          } catch (cleanupError) {
            console.warn('Failed to cleanup cache:', cleanupError)
            setLastFetch(new Date())
          }
        } else {
          console.warn('Failed to cache data:', e)
          setLastFetch(new Date())
        }
      }
      
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
      // Don't clear data on error - keep cached data
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [url, cacheKey, timestampKey])

  // Initial fetch - check if we need to refresh
  useEffect(() => {
    if (!url) return

    const cached = localStorage.getItem(cacheKey)
    const cachedTimestamp = localStorage.getItem(timestampKey)
    
    if (!cached || !cachedTimestamp) {
      // No cache, fetch immediately
      fetchData(false)
    } else {
      const timestamp = new Date(cachedTimestamp)
      const age = Date.now() - timestamp.getTime()
      
      if (age >= ttl) {
        // Cache expired, fetch in background
        fetchData(false)
      }
    }
  }, [url, cacheKey, timestampKey, ttl, fetchData])

  return {
    data,
    loading,
    error,
    refresh: () => fetchData(true),
    lastFetch
  }
}
