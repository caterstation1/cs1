"use client";

import { useEffect, useState, useMemo } from 'react'
import { StockPanel } from '@/components/StockPanel'
import OrderCardList from '@/components/realtime-orders/order-card-list'
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns'
import { Order } from '@/types/order'
import { parseLocalDate, getTodayLocal } from '@/lib/date-utils'

export default function CalendarPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Create a local midnight date for today
    return getTodayLocal();
  })

  // Real update handler for OrderCardList
  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>): Promise<Order> => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update order')
      const updatedOrder = await response.json()
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, ...updatedOrder } : order))
      return updatedOrder
    } catch (err) {
      console.error('Error updating order:', err)
      throw err
    }
  }

  // Re-fetch all orders (for after bulk update)
  const fetchOrders = async () => {
    setLoading(true)
    try {
      // Fetch all orders with a high limit to ensure we get all orders
      const response = await fetch('/api/orders?limit=10000')
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data = await response.json()
      
      // Ensure we have an array of orders
      let ordersArray: Order[] = []
      if (Array.isArray(data)) {
        ordersArray = data
      } else if (data && Array.isArray(data.orders)) {
        ordersArray = data.orders
      } else {
        console.warn('Unexpected orders data format:', data)
        ordersArray = []
      }
      

      setOrders(ordersArray)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Failed to load orders')
      setOrders([]) // Ensure orders is always an array
    } finally {
      setLoading(false)
    }
  }

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

  // Group orders by date (YYYY-MM-DD)
  const ordersByDate = useMemo(() => {
    const map: Record<string, Order[]> = {}
    // Ensure orders is an array before iterating
    if (!Array.isArray(orders)) {
      console.warn('Orders is not an array:', orders)
      return map
    }
    for (const order of orders) {
      const date = getOrderDeliveryDate(order)
      if (!date) continue
      const key = format(date, 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(order)
    }
    return map
  }, [orders])

  // Orders for selected date
  const filteredOrders = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd')
    return ordersByDate[key] || []
  }, [ordersByDate, selectedDate])

  // Calendar rendering helpers
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const today = new Date()

  const calendarDays: { date: Date; isCurrentMonth: boolean; isToday: boolean; orderCount: number }[] = []
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    const key = format(d, 'yyyy-MM-dd')
    calendarDays.push({
      date: d,
      isCurrentMonth: isSameMonth(d, monthStart),
      isToday: isSameDay(d, today),
      orderCount: ordersByDate[key]?.length || 0,
    })
  }

  function goToPrevMonth() {
    setSelectedDate(prev => addDays(startOfMonth(prev), -1))
  }
  function goToNextMonth() {
    setSelectedDate(prev => addDays(endOfMonth(prev), 1))
  }



  useEffect(() => {
    fetchOrders()
  }, [])

  return (
    <div className="flex w-full gap-6">
      {/* Left sidebar: Calendar + StockList */}
      <div className="flex flex-col w-[340px] min-w-[280px] max-w-[400px]">
        <div className="mb-6 rounded-lg bg-white shadow p-4">
          {/* Modern Calendar */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-gray-100">
              <span className="sr-only">Previous month</span>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="font-semibold text-lg">{format(monthStart, 'MMMM yyyy')}</div>
            <button onClick={goToNextMonth} className="p-1 rounded hover:bg-gray-100">
              <span className="sr-only">Next month</span>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, isCurrentMonth, isToday, orderCount }) => {
              const isSelected = isSameDay(date, selectedDate)
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => {
                    // Fix: Create a true local midnight date to avoid timezone issues
                    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
                    console.log('Calendar date click:', {
                      originalDate: date.toISOString(),
                      localDate: localDate.toISOString(),
                      localDateString: localDate.toDateString(),
                      selectedDate: selectedDate.toISOString(),
                      orderCount
                    });
                    setSelectedDate(localDate);
                  }}
                  className={
                    'aspect-square w-full rounded flex flex-col items-center justify-center border ' +
                    (isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow'
                      : isToday
                        ? 'border-blue-400 text-blue-700 bg-blue-50'
                        : isCurrentMonth
                          ? 'bg-white border-gray-200 hover:bg-gray-50'
                          : 'bg-gray-50 text-gray-400 border-gray-100')
                  }
                >
                  <span className="font-medium text-base">{date.getDate()}</span>
                  {orderCount > 0 && (
                    <span className="text-xs mt-0.5 text-purple-600 font-semibold">{orderCount}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="rounded-lg bg-white shadow p-4">
          <StockPanel 
            autoRefresh={false} // No auto-refresh on calendar page
            showRefreshButton={true}
            targetDate={selectedDate} // Use the selected calendar date
          />
        </div>
      </div>
      {/* Main content: OrderCardList */}
      <div className="flex-1 w-full max-w-full overflow-x-hidden">
        <div className="rounded-lg bg-white shadow p-4 w-full max-w-full overflow-x-hidden">
          <div className="font-bold text-lg mb-2">
            Orders for {format(selectedDate, 'EEE, MMM d, yyyy')}
          </div>
          <div className="min-h-[300px] w-full max-w-full overflow-x-hidden">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">{error}</div>
            ) : (
              <OrderCardList 
                orders={filteredOrders} 
                onUpdateOrder={handleUpdateOrder}
                onBulkUpdateComplete={fetchOrders}
                selectedDate={selectedDate}
              />
            )}
          </div>
        </div>

      </div>
      

    </div>
  )
} 