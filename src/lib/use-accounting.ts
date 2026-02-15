'use client'

import useSWR from 'swr'

type Fetcher<T> = (url: string) => Promise<T>

// Helper function to sanitize data for React state
function sanitizeData(data: any, path: string = 'root'): any {
  try {
    if (data === null || data === undefined) {
      return data
    }
    
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data
    }
    
    if (Array.isArray(data)) {
      console.log(`[use-accounting] Sanitizing array at ${path}, length: ${data.length}`)
      return data.map((item, index) => {
        try {
          return sanitizeData(item, `${path}[${index}]`)
        } catch (e) {
          console.warn(`[use-accounting] Error sanitizing array item at ${path}[${index}]:`, e)
          return null
        }
      }).filter(item => item !== null)
    }
    
    if (typeof data === 'object') {
      // Check for circular references by attempting JSON.stringify
      try {
        JSON.stringify(data)
      } catch (e) {
        console.error(`[use-accounting] Circular reference detected at ${path}:`, e)
        return {}
      }
      
      // Create a clean object with only serializable values
      const clean: any = {}
      for (const [key, value] of Object.entries(data)) {
        try {
          // Skip functions and symbols
          if (typeof value === 'function' || typeof value === 'symbol') {
            console.warn(`[use-accounting] Skipping non-serializable ${typeof value} at ${path}.${key}`)
            continue
          }
          
          // Recursively sanitize nested objects
          clean[key] = sanitizeData(value, `${path}.${key}`)
        } catch (e) {
          console.warn(`[use-accounting] Error sanitizing ${path}.${key}:`, e)
        }
      }
      return clean
    }
    
    return data
  } catch (e) {
    console.error(`[use-accounting] Error in sanitizeData at ${path}:`, e)
    return null
  }
}

const fetcher: Fetcher<any> = async (url: string) => {
  try {
    console.log(`[use-accounting] Fetching: ${url}`)
    const res = await fetch(url)
    
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[use-accounting] Request failed for ${url}:`, res.status, text)
      throw new Error(text || `Request failed: ${res.status}`)
    }
    
    const data = await res.json()
    console.log(`[use-accounting] Data received for ${url}:`, {
      type: typeof data,
      isArray: Array.isArray(data),
      keys: typeof data === 'object' && data !== null ? Object.keys(data) : null,
      size: Array.isArray(data) ? data.length : (typeof data === 'object' && data !== null ? Object.keys(data).length : 0)
    })
    
    // Sanitize the data before returning
    const sanitized = sanitizeData(data, url)
    console.log(`[use-accounting] Data sanitized for ${url}`)
    
    return sanitized
  } catch (error) {
    console.error(`[use-accounting] Fetcher error for ${url}:`, error)
    throw error
  }
}

export function buildQuery(params: Record<string, any>): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.set(k, String(v))
  })
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export function useAccountingGet<T = any>(path: string, params: Record<string, any>) {
  const key = `${path}${buildQuery(params)}`
  const { data, error, isLoading, mutate } = useSWR<T>(key, fetcher)
  return { data, error, isLoading, mutate }
}

