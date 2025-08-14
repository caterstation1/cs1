'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import OrderCardList from './order-card-list'
import { Order } from '@/types/order'
import { parseLocalDate, getTodayLocal, formatLocalDate } from '@/lib/date-utils'
import { StockPanel } from '@/components/StockPanel'
import { deduplicateOrderUpdate, requestDeduplicator } from '@/lib/request-deduplication'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Wifi, WifiOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MAX_CONCURRENT_UPDATES = 1000 // Increased from 5 to 1000 for testing
let currentUpdates = 0
const updateQueue: (() => void)[] = []

const queueUpdate = (fn: () => void) => {
  if (currentUpdates < MAX_CONCURRENT_UPDATES) {
    currentUpdates++
    fn()
  } else {
    updateQueue.push(fn)
  }
}

const releaseNext = () => {
  currentUpdates--
  if (updateQueue.length > 0) {
    const next = updateQueue.shift()
    if (next) {
      currentUpdates++
      next()
    }
  }
}

export default function RealtimeOrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected')
  const [updateCount, setUpdateCount] = useState(0)
  const [showUpdateIndicator, setShowUpdateIndicator] = useState(false)

  // Create a stable reference to today's date to prevent infinite re-renders
  const today = useMemo(() => getTodayLocal(), [])

  // Helper: extract delivery date from order (prefer deliveryDate field)
  function getOrderDeliveryDate(order: Order): Date | null {
    // 1. Use deliveryDate field if present
    if (order.deliveryDate) {
      const localDate = parseLocalDate(order.deliveryDate);
      if (localDate) return localDate;
    }
    // 2. Try to extract from note_attributes (e.g. "July 17, 2025")
    if ((order as any).note_attributes && Array.isArray((order as any).note_attributes)) {
      const dateAttr = (order as any).note_attributes.find((a: any) => a.name === 'Delivery Date');
      if (dateAttr && dateAttr.value) {
        const localDate = parseLocalDate(dateAttr.value);
        if (localDate) return localDate;
      }
    }
    // 3. Try to extract from tags (e.g. "Thu Jul 17 2025")
    if (order.tags) {
      const tagMatch = order.tags.match(/\b\w{3,9} \d{1,2} \d{4}\b/);
      if (tagMatch) {
        const localDate = parseLocalDate(tagMatch[0]);
        if (localDate) return localDate;
      }
    }
    // 4. Fallback to createdAt
    if (order.createdAt) {
      const localDate = parseLocalDate(order.createdAt);
      if (localDate) return localDate;
    }
    return null;
  }

  // Filter orders for today using the same logic as calendar
  const todayKey = format(today, 'yyyy-MM-dd')
  const todaysOrders = useMemo(() => {
    if (!Array.isArray(orders)) {
      console.warn('Orders is not an array in realtime view:', orders);
      return [];
    }
    return orders.filter(order => {
      const date = getOrderDeliveryDate(order)
      if (!date) return false
      return format(date, 'yyyy-MM-dd') === todayKey
    })
  }, [orders, todayKey])

  const fetchOrders = async (isRefresh = false) => {
    // Prevent fetching too frequently (minimum 2 seconds between fetches)
    const now = Date.now()
    if (!isRefresh && now - lastFetchTime < 2000) {
      return
    }
    setLastFetchTime(now)

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      setConnectionStatus('connected')
      
      // Fetch all orders since we need to check multiple date fields (deliveryDate, tags, note_attributes, createdAt)
      // Use a high limit to get all orders
      const response = await fetch('/api/orders?limit=10000')
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data = await response.json()
      
      // Extract orders from the response (API returns { orders: [], pagination: {} })
      const fetchedOrders = data.orders || data
      
      // Only update if the data has actually changed
      const currentOrdersJson = JSON.stringify(orders)
      const newOrdersJson = JSON.stringify(fetchedOrders)
      
      if (currentOrdersJson !== newOrdersJson) {
        setOrders(fetchedOrders)
        setLastUpdateTime(now)
        setUpdateCount(prev => prev + 1)
        
        // Show subtle update indicator
        setShowUpdateIndicator(true)
        setTimeout(() => setShowUpdateIndicator(false), 2000)
        
        console.log('🔄 Orders updated at:', new Date().toLocaleTimeString(), 'Changes detected')
      } else {
        console.log('✅ Orders checked at:', new Date().toLocaleTimeString(), 'No changes')
      }
      setError(null)
    } catch (err) {
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('❌ Error fetching orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchOrders()

    // Set up interval for refreshing orders - REDUCED TO 5 SECONDS
    const ordersInterval = setInterval(() => fetchOrders(true), 5000) // 5 seconds

    // Cleanup interval and update queue on unmount
    return () => {
      clearInterval(ordersInterval)
      // Clear the update queue
      updateQueue.length = 0
      currentUpdates = 0
    }
  }, [])

  // Add monitoring for request deduplication
  useEffect(() => {
    const interval = setInterval(() => {
      const pendingCount = requestDeduplicator.getPendingCount();
      if (pendingCount > 0) {
        console.log(`📊 Request deduplication stats: ${pendingCount} pending requests`);
        console.log(`📊 Pending keys:`, requestDeduplicator.getPendingKeys());
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>): Promise<Order> => {
    console.log('RealtimeOrdersView handleUpdateOrder called:', orderId, updates); // Debug log
    
    return deduplicateOrderUpdate(orderId, updates, async () => {
      return new Promise((resolve, reject) => {
        queueUpdate(async () => {
          const maxRetries = 3
          let retryCount = 0
          let lastError: Error | null = null

          while (retryCount < maxRetries) {
            try {
              const fetchLabel = `PATCH /api/orders/${orderId}`;
              console.time(fetchLabel);
              console.log('[TIMING] PATCH request started at', new Date().toISOString());
              
              // Create AbortController for timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
              
              const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              console.timeEnd(fetchLabel);
              console.log('[TIMING] PATCH request ended at', new Date().toISOString());

              if (response.status === 429) {
                const waitTime = parseInt(response.headers.get('Retry-After') ?? '1') * 1000
                await new Promise(resolve => setTimeout(resolve, waitTime))
                retryCount++
                continue
              }

              if (!response.ok) {
                throw new Error(`Failed to update order ${orderId}: ${response.statusText}`)
              }

              const updatedOrder = await response.json()
              setOrders(prev =>
                prev.map(order =>
                  order.id === orderId ? { ...order, ...updatedOrder } : order
                )
              )

              resolve(updatedOrder)
              return
            } catch (err) {
              lastError = err instanceof Error ? err : new Error('Unknown error')
              console.error(`Error updating order (attempt ${retryCount + 1}/${maxRetries}):`, lastError)

              // Handle timeout errors
              if (err instanceof Error && err.name === 'AbortError') {
                console.error('Request timed out, retrying...');
                const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retryCount++;
                continue;
              }

              if (err instanceof TypeError && err.message === 'Failed to fetch') {
                const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                await new Promise(resolve => setTimeout(resolve, waitTime))
                retryCount++
              } else {
                break
              }
            }
          }

          if (lastError) {
            console.error(`Failed to update order ${orderId} after ${maxRetries} attempts`, lastError)
            reject(lastError)
          }

          releaseNext()
        })
      })
    });
  }

  // Memoize the orders list to prevent unnecessary re-renders
  const memoizedOrders = useMemo(() => orders, [orders])

  // Format last update time for display
  const formatLastUpdate = () => {
    if (!lastUpdateTime) return 'Never'
    const now = Date.now()
    const diff = now - lastUpdateTime
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return new Date(lastUpdateTime).toLocaleTimeString()
  }

  // Test function to simulate real-time updates
  const testRealtimeUpdate = async () => {
    try {
      const response = await fetch('/api/test-realtime?action=update-test-order')
      const data = await response.json()
      
      if (data.success) {
        console.log('🧪 Test update triggered:', data.message)
        // Force a refresh to show the update
        setTimeout(() => fetchOrders(true), 1000)
      } else {
        console.log('❌ Test update failed:', data.message)
      }
    } catch (error) {
      console.error('❌ Error testing realtime update:', error)
    }
  }

  if (loading) return <div className="p-4">Loading orders...</div>
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>

  return (
    <div className="w-full mx-0 px-0">
      {/* Real-time status bar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {connectionStatus === 'connected' ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className={connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'}>
              {connectionStatus === 'connected' ? 'Live' : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-blue-500' : 'text-gray-400'}`} />
            <span className="text-gray-600">
              {refreshing ? 'Updating...' : 'Auto-refresh every 5s'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {showUpdateIndicator && (
            <Badge variant="secondary" className="animate-pulse">
              Updated
            </Badge>
          )}
          <span className="text-gray-500">
            Last update: {formatLastUpdate()}
          </span>
          <span className="text-gray-400">
            Updates: {updateCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={testRealtimeUpdate}
            className="flex items-center gap-1 text-xs"
            title="Test real-time updates"
          >
            <Zap className="h-3 w-3" />
            Test
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[85%_15%] gap-4">
        <div>
          <OrderCardList 
            orders={todaysOrders} 
            onUpdateOrder={handleUpdateOrder}
            onBulkUpdateComplete={() => fetchOrders(true)} // Refresh after bulk update
          />
        </div>
        <div>
          <StockPanel 
            autoRefresh={true}
            refreshInterval={60000} // Refresh every minute
            showRefreshButton={true}
            targetDate={today} // Use today's date for realtime orders
          />
        </div>
      </div>
    </div>
  )
}
