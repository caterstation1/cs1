'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import OrderCardList from './order-card-list'
import { Order } from '@/types/order'
import { parseLocalDate, getTodayLocal, formatLocalDate } from '@/lib/date-utils'
import { StockPanel } from '@/components/StockPanel'
import { deduplicateOrderUpdate, requestDeduplicator } from '@/lib/request-deduplication'

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
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null)
  const isPollingRef = useRef(false)
  const lastLocalUpdateMsRef = useRef<number>(0)

  // Create a stable reference to today's date to prevent infinite re-renders
  const today = useMemo(() => getTodayLocal(), [])

  // Helper: extract delivery date from order (prefer deliveryDateResolved if present)
  function getOrderDeliveryDate(order: Order): Date | null {
    // 0. Prefer resolved day from server if available
    if ((order as any).deliveryDateResolved) {
      const d = parseLocalDate((order as any).deliveryDateResolved as unknown as string)
      if (d) return d
    }
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

  // Strict filter: require orders to have deliveryDateResolved equal to today (local day)
  const todayKey = format(today, 'yyyy-MM-dd')
  const todaysOrders = useMemo(() => {
    if (!Array.isArray(orders)) return []
    return orders.filter(order => {
      const resolved = (order as any).deliveryDateResolved as string | undefined
      if (!resolved) return false
      const d = parseLocalDate(resolved)
      return !!d && format(d, 'yyyy-MM-dd') === todayKey
    })
  }, [orders, todayKey])

  const fetchOrders = async (isRefresh = false) => {
    // Prevent fetching too frequently (minimum 5 seconds between fetches)
    const now = Date.now()
    if (!isRefresh && now - lastFetchTime < 5000) {
      return
    }
    setLastFetchTime(now)

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      // Prefer server-side filtering by resolved delivery day to avoid huge payloads
      const dateStr = format(today, 'yyyy-MM-dd')
      let response = await fetch(`/api/orders?deliveryDateResolved=${encodeURIComponent(dateStr)}&limit=2000`)
      if (!response.ok) {
        // Fallback to legacy wide fetch
        response = await fetch('/api/orders?limit=10000')
      }
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data = await response.json()

      // Extract orders from the response (API returns { orders: [], pagination: {} })
      const fetchedOrders = data.orders || data
      
      // Only update if the data has actually changed
      const currentOrdersJson = JSON.stringify(orders)
      const newOrdersJson = JSON.stringify(fetchedOrders)
      
      if (currentOrdersJson !== newOrdersJson) {
        setOrders(fetchedOrders)
      }

      // Establish baseline sync timestamp from max dbUpdatedAt (falls back to now)
      try {
        const maxUpdatedAt = Array.isArray(fetchedOrders) && fetchedOrders.length > 0
          ? Math.max(
              ...fetchedOrders
                .map((o: any) => {
                  const v = (o && (o.dbUpdatedAt || o.updatedAt)) as string | Date | undefined
                  const t = v ? new Date(v as any).getTime() : NaN
                  return Number.isFinite(t) ? t : 0
                })
            )
          : Date.now()
        if (Number.isFinite(maxUpdatedAt)) {
          setLastSyncMs(maxUpdatedAt)
        } else {
          setLastSyncMs(Date.now())
        }
      } catch {
        setLastSyncMs(Date.now())
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchOrders()

    // Incremental polling: fetch only changes since last sync
    const changesInterval = setInterval(async () => {
      if (isPollingRef.current) return
      if (!lastSyncMs) return
      isPollingRef.current = true
      try {
        let since = lastSyncMs
        let safetyCounter = 0
        while (safetyCounter < 5) {
          const resp = await fetch(`/api/orders/changes?since=${encodeURIComponent(String(since))}&limit=1000`)
          if (!resp.ok) break
          const payload = await resp.json()
          const changed = Array.isArray(payload.orders) ? payload.orders : []

          if (changed.length > 0) {
            setOrders(prev => {
              if (!Array.isArray(prev) || prev.length === 0) return changed
              const byId = new Map(prev.map(o => [o.id, o]))
              for (const upd of changed) {
                const existing = byId.get(upd.id)
                if (existing) {
                  // Merge only if server data is newer than our last local update
                  const serverUpdatedMs = new Date((upd as any).dbUpdatedAt || (upd as any).updatedAt || Date.now()).getTime()
                  const localUpdatedMs = new Date((existing as any).dbUpdatedAt || (existing as any).updatedAt || 0).getTime()
                  // Also guard against clobbering very recent local updates
                  const lastLocal = lastLocalUpdateMsRef.current
                  const isServerNewer = serverUpdatedMs >= Math.max(localUpdatedMs, lastLocal)
                  byId.set(upd.id, isServerNewer ? { ...existing, ...upd } : existing)
                } else {
                  byId.set(upd.id, upd)
                }
              }
              return Array.from(byId.values())
            })
          }

          const newMax = typeof payload.maxUpdatedAt === 'number' ? payload.maxUpdatedAt : (payload.maxUpdatedAt ? new Date(payload.maxUpdatedAt).getTime() : null)
          if (newMax && Number.isFinite(newMax)) {
            since = Math.max(since, newMax)
            setLastSyncMs(since)
          }

          if (!payload.hasMore) break
          safetyCounter++
        }
      } catch {
        // Silent: kitchen screens should not show errors for background polling
      } finally {
        isPollingRef.current = false
      }
    }, 5000) // 5 seconds

    // Cleanup interval and update queue on unmount
    return () => {
      clearInterval(changesInterval)
      // Clear the update queue
      updateQueue.length = 0
      currentUpdates = 0
    }
  }, [])

  // Wrap update handler to record local update time, preventing flicker from stale polling
  const handleUpdateOrderWithLocalStamp = async (orderId: string, updates: Partial<Order>): Promise<Order> => {
    lastLocalUpdateMsRef.current = Date.now()
    const updated = await handleUpdateOrder(orderId, updates)
    // Advance sync cursor to now to avoid immediate reapplication of stale changes
    setLastSyncMs(prev => Math.max(prev ?? 0, Date.now()))
    return updated
  }

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

  if (loading) return <div className="p-4">Loading orders...</div>
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>

  return (
    <div className="w-full mx-0 px-0">
      <div className="grid grid-cols-1 lg:grid-cols-[85%_15%] gap-4">
        <div>
          <OrderCardList 
            orders={todaysOrders} 
            onUpdateOrder={handleUpdateOrderWithLocalStamp}
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
