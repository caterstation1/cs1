'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface ShopifySyncContextType {
  lastSyncTime: Date | null
  isSyncing: boolean
  error: string | null
  errorDetails: string | null
  syncStatus: string
  syncOrders: () => Promise<void>
}

const ShopifySyncContext = createContext<ShopifySyncContextType | undefined>(undefined)

export function useShopifySync() {
  const context = useContext(ShopifySyncContext)
  if (!context) {
    throw new Error('useShopifySync must be used within a ShopifySyncProvider')
  }
  return context
}

export function ShopifySyncProvider({ children }: { children: React.ReactNode }) {
  const sessionData = useSession()
  const session = sessionData?.data
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string>('Ready')

  // Client-safe retry wrapper (do not import server Prisma utilities in client components)
  async function withRetryClient<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null
    let attempt = 0
    while (attempt < maxRetries) {
      try {
        return await operation()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error')
        // Only retry transient/network-like errors
        const msg = lastError.message.toLowerCase()
        const isTransient = msg.includes('network') || msg.includes('timeout') || msg.includes('failed to fetch')
        attempt++
        if (!isTransient || attempt >= maxRetries) break
        await new Promise(resolve => setTimeout(resolve, delayMs))
        delayMs = Math.min(delayMs * 2, 10000)
      }
    }
    throw lastError ?? new Error('Unknown error')
  }

  const syncOrders = async (opts?: { force?: boolean }) => {
    if (isSyncing) return
    // Throttle: skip if we synced very recently (10 minutes) unless forced
    try {
      const last = typeof window !== 'undefined' ? localStorage.getItem('orders-sync-last') : null
      if (!opts?.force && last) {
        const lastMs = Number(last)
        if (!Number.isNaN(lastMs) && Date.now() - lastMs < 10 * 60 * 1000) {
          setSyncStatus('Recently synced')
          return
        }
      }
    } catch {}

    try {
      setIsSyncing(true)
      setError(null)
      setErrorDetails(null)
      setSyncStatus('Syncing...')

      // Use a client-safe retry wrapper
      const result = await withRetryClient(async () => {
        // Use the same endpoint the Orders page uses so behavior is consistent
        const response = await fetch('/api/orders/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        return response.json()
      })

      setLastSyncTime(new Date())
      setSyncStatus('Last sync: ' + new Date().toLocaleTimeString())
      console.log('✅ Shopify sync completed successfully:', result)
      try { localStorage.setItem('orders-sync-last', String(Date.now())) } catch {}
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      let errorStack = err instanceof Error ? err.stack : null
      
      // Handle database connection errors gracefully
      if (errorMessage.includes('Can\'t reach database server') || 
          errorMessage.includes('mainline.proxy.rlwy.net') ||
          errorMessage.includes('connection')) {
        errorMessage = 'Database connection temporarily unavailable'
        setSyncStatus('Connection issue - will retry')
      } else if (errorMessage.includes('Unexpected end of JSON input')) {
        errorMessage = 'Shopify sync failed: Invalid or empty response from server.'
        setSyncStatus('Sync failed')
      } else {
        setSyncStatus('Sync failed')
      }
      
      setError(errorMessage)
      setErrorDetails(errorStack || 'No additional details available')
      console.error('Error syncing Shopify orders:', {
        error: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Set up interval for automatic syncing and initial sync - only when authenticated
  useEffect(() => {
    // Don't start sync if user is not authenticated
    if (!session?.user) {
      setSyncStatus('Waiting for authentication...')
      return
    }

    // Don't sync on login page to avoid refresh loops
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      return
    }

    // Initial sync when component mounts - wrapped in try-catch to prevent crashes.
    // Throttled by syncOrders logic (skips if run within last 10 minutes).
    const initialSync = async () => {
      try {
        await syncOrders()
      } catch (err) {
        console.error('Initial sync failed, but continuing:', err)
      }
    }
    
    initialSync()

    // Set up interval for subsequent syncs (every 15 minutes)
    const interval = setInterval(() => {
      syncOrders().catch(err => {
        console.error('Periodic sync failed, but continuing:', err)
      })
    }, 900000) // 15 minutes
    
    return () => {
      console.log('Cleaning up sync interval')
      clearInterval(interval)
    }
  }, [session?.user])

  // Add a retry mechanism for failed syncs - only when authenticated
  useEffect(() => {
    // Don't retry if user is not authenticated
    if (!session?.user) {
      return
    }

    let retryTimeout: NodeJS.Timeout

    if (error && error.includes('Database connection temporarily unavailable')) {
      console.log('Database connection issue detected, scheduling retry in 30 seconds...')
      retryTimeout = setTimeout(() => {
        console.log('Retrying failed sync...')
        syncOrders()
      }, 30000) // Retry after 30 seconds
    }

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
    }
  }, [error, session?.user])

  return (
    <ShopifySyncContext.Provider value={{ 
      lastSyncTime, 
      isSyncing, 
      error, 
      errorDetails,
      syncStatus,
      syncOrders 
    }}>
      {children}
    </ShopifySyncContext.Provider>
  )
} 