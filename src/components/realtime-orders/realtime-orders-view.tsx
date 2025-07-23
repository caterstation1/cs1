'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Order } from '@/types/order'
import OrderCardList from './order-card-list'
import { StockPanel } from '@/components/StockPanel'
import { format, parseISO } from 'date-fns'

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

  // Create a stable reference to today's date to prevent infinite re-renders
  const today = useMemo(() => new Date(), [])

  // Helper: extract delivery date from order (prefer deliveryDate field)
  function getOrderDeliveryDate(order: Order): Date | null {
    if (order.deliveryDate) {
      const parsed = Date.parse(order.deliveryDate)
      if (!isNaN(parsed)) return new Date(parsed)
      return null;
    }
    if (order.createdAt) {
      const parsed = Date.parse(order.createdAt)
      if (!isNaN(parsed)) return new Date(order.createdAt)
      return null;
    }
    return null
  }

  // Filter orders for today
  const todayKey = format(today, 'yyyy-MM-dd')
  const todaysOrders = useMemo(() => {
    return orders.filter(order => {
      const date = getOrderDeliveryDate(order)
      if (!date) return false
      return format(date, 'yyyy-MM-dd') === todayKey
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
      const response = await fetch('/api/orders')
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data = await response.json()
      
      // Only update if the data has actually changed
      const currentOrdersJson = JSON.stringify(orders)
      const newOrdersJson = JSON.stringify(data)
      
      if (currentOrdersJson !== newOrdersJson) {
        setOrders(data)
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

    // Set up interval for refreshing orders
    const ordersInterval = setInterval(() => fetchOrders(true), 30000) // 30 seconds

    // Cleanup interval and update queue on unmount
    return () => {
      clearInterval(ordersInterval)
      // Clear the update queue
      updateQueue.length = 0
      currentUpdates = 0
    }
  }, [])

  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>): Promise<Order> => {
    console.log('RealtimeOrdersView handleUpdateOrder called:', orderId, updates); // Debug log
    
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
            const response = await fetch(`/api/orders/${orderId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updates)
            })
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

            if (err instanceof TypeError && err.message === 'Failed to fetch') {
              const waitTime = 1000 * (retryCount + 1)
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
            onUpdateOrder={handleUpdateOrder}
            onBulkUpdateComplete={() => fetchOrders(true)} // Refresh after bulk update
          />
        </div>
        <div>
          <StockPanel 
            autoRefresh={true}
            refreshInterval={60000} // Refresh every minute
            showRefreshButton={true}
            targetDate={today} // Pass today's date explicitly
          />
        </div>
      </div>
    </div>
  )
}
