'use client'

import { useEffect, useState } from 'react'
import { useShopifySync } from './shopify-sync-provider'
import { format } from 'date-fns'

export function SyncMonitor() {
  const { lastSyncTime, isSyncing, error, errorDetails, syncStatus } = useShopifySync()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white rounded-lg shadow-lg border border-gray-200 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">Shopify Sync Status</h3>
        <div className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : error ? 'bg-red-500' : 'bg-green-500'}`} />
      </div>
      
      <div className="space-y-2 text-sm">
        <p className="text-gray-600">
          Last Sync: {lastSyncTime ? format(new Date(lastSyncTime), 'MMM d, yyyy HH:mm:ss') : 'Never'}
        </p>
        
        <p className="text-gray-600">
          Status: <span className={error ? 'text-red-600' : 'text-gray-900'}>{syncStatus}</span>
        </p>
        
        {error && (
          <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 font-medium">{error}</p>
            {errorDetails && (
              <pre className="mt-1 text-xs text-red-500 whitespace-pre-wrap">
                {errorDetails}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 