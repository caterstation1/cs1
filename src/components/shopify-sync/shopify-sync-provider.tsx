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
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setLastSyncTime(new Date());
        setSyncStatus(`Last sync successful: ${data.synced} synced, ${data.skipped} skipped, ${data.errors} errors`);
        console.log('Shopify sync completed successfully:', {
          ...data,
          timestamp: new Date().toISOString()
        });
      } else {
        const text = await response.text();
        throw new Error(text || 'Unexpected response');
      }
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      let errorStack = err instanceof Error ? err.stack : null;
      
      // Handle database connection errors gracefully
      if (errorMessage.includes('Can\'t reach database server') || errorMessage.includes('mainline.proxy.rlwy.net')) {
        errorMessage = 'Database connection failed';
        setSyncStatus('Database unavailable');
      } else if (errorMessage.includes('Unexpected end of JSON input')) {
        errorMessage = 'Shopify sync failed: Invalid or empty response from server.';
        setSyncStatus('Sync failed');
      } else {
        setSyncStatus('Sync failed');
      }
      
      setError(errorMessage);
      setErrorDetails(errorStack || 'No additional details available');
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
    // Check if we're in production and database is unavailable
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Initial sync when component mounts - wrapped in try-catch to prevent crashes
    const initialSync = async () => {
      try {
        await syncOrders();
      } catch (err) {
        console.error('Initial sync failed, but continuing:', err);
        // If we're in production and get database errors, disable auto-sync
        if (isProduction && err instanceof Error && err.message.includes('database')) {
          console.log('Database unavailable in production, disabling auto-sync');
          return;
        }
      }
    };
    
    initialSync();

    // Set up interval for subsequent syncs (only if not in production with DB issues)
    const interval = setInterval(() => {
      syncOrders().catch(err => {
        console.error('Periodic sync failed, but continuing:', err);
        // Stop retrying if database is consistently unavailable
        if (isProduction && err instanceof Error && err.message.includes('database')) {
          console.log('Stopping sync retries due to database issues');
          clearInterval(interval);
        }
      });
    }, 60000); // Sync every minute
    
    return () => {
      console.log('Cleaning up sync interval');
      clearInterval(interval);
    }
  }, []); // Empty dependency array since syncOrders is stable

  // Add a retry mechanism for failed syncs
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;

    if (error && !error.includes('Database connection failed')) {
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