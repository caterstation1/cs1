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
      
      // Update cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result))
        const now = new Date()
        localStorage.setItem(timestampKey, now.toISOString())
        setLastFetch(now)
      } catch (e) {
        console.warn('Failed to cache data:', e)
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
