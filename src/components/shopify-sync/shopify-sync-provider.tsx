'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface ShopifySyncContextType {
  lastSyncTime: Date | null
  isSyncing: boolean
  error: string | null
  errorDetails: string | null
  syncStatus: string
  syncOrders: () => Promise<void>
}

const ShopifySyncContext = createContext<ShopifySyncContextType | undefined>(undefined)

export function ShopifySyncProvider({ children }: { children: React.ReactNode }) {
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string>('Ready')

  const syncOrders = async () => {
    if (isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setErrorDetails(null);
    setSyncStatus('Starting sync...');
    
    try {
      console.log('Starting Shopify sync at:', new Date().toISOString());
      setSyncStatus('Checking Shopify credentials...');
      
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync Shopify orders');
      }

      const data = await response.json();
      setLastSyncTime(new Date());
      setSyncStatus(`Last sync successful: ${data.synced} synced, ${data.skipped} skipped, ${data.errors} errors`);
      console.log('Shopify sync completed successfully:', {
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      const errorStack = err instanceof Error ? err.stack : null;
      
      setError(errorMessage);
      setErrorDetails(errorStack || 'No additional details available');
      setSyncStatus('Sync failed');
      
      console.error('Error syncing Shopify orders:', {
        error: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSyncing(false);
    }
  }

  // Set up interval for automatic syncing and initial sync
  useEffect(() => {
    // Initial sync when component mounts
    syncOrders();

    // Set up interval for subsequent syncs
    const interval = setInterval(syncOrders, 60000); // Sync every minute
    
    return () => {
      console.log('Cleaning up sync interval');
      clearInterval(interval);
    }
  }, []); // Empty dependency array since syncOrders is stable

  // Add a retry mechanism for failed syncs
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;

    if (error) {
      console.log('Sync failed, scheduling retry in 30 seconds...');
      retryTimeout = setTimeout(() => {
        console.log('Retrying failed sync...');
        syncOrders();
      }, 30000); // Retry after 30 seconds
    }

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [error]);

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

export function useShopifySync() {
  const context = useContext(ShopifySyncContext)
  if (context === undefined) {
    throw new Error('useShopifySync must be used within a ShopifySyncProvider')
  }
  return context
} 