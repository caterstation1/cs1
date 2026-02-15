"use client";

import { useEffect, useState, useMemo } from 'react'
import { StockPanel } from '@/components/StockPanel'
import OrderCardList from '@/components/realtime-orders/order-card-list'
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns'
import { Order } from '@/types/order'
import { parseLocalDate, getTodayLocal } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { useCachedFetch } from '@/lib/use-cached-fetch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, RefreshCw } from 'lucide-react'
import { useShopifySync } from '@/components/shopify-sync/shopify-sync-provider'
import { isWellingtonOrder } from '@/lib/region'

export default function CalendarPage() {
  const { syncOrders } = useShopifySync()
  
  // Use cached fetch for orders - will skip caching if too large to avoid quota errors
  const { 
    data: ordersData, 
    loading, 
    error, 
    refresh: refreshOrders,
    lastFetch 
  } = useCachedFetch<Order[] | { orders: Order[] }>(
    '/api/orders?limit=10000',
    { key: 'orders_akl', ttl: 120000 } // 2 minutes cache
  )
  
  // Extract orders array from response
  const orders = useMemo(() => {
    if (!ordersData) return []
    if (Array.isArray(ordersData)) return ordersData
    if (ordersData && Array.isArray((ordersData as any).orders)) return (ordersData as any).orders
    return []
  }, [ordersData])
  
  // Filter to AKL-only (exclude WLG orders)
  const aklOrders = useMemo(() => {
    return orders.filter((o: Order) => !isWellingtonOrder(o))
  }, [orders])
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Create a local midnight date for today
    return getTodayLocal();
  })
  
  // Add Order Modal state
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [newOrderData, setNewOrderData] = useState({
    customerFirstName: '',
    customerLastName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: {
      address1: '',
      address2: '',
      city: '',
      province: '',
      zip: ''
    },
    deliveryDate: '',
    deliveryTime: '',
    note: ''
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
      // Invalidate cache and refresh in background
      setTimeout(() => refreshOrders(), 500) // Small delay to let update complete
      return updatedOrder
    } catch (err) {
      console.error('Error updating order:', err)
      throw err
    }
  }

  // Re-fetch all orders (for after bulk update) - uses cached fetch
  const fetchOrders = refreshOrders

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
    // Ensure aklOrders is an array before iterating
    if (!Array.isArray(aklOrders)) {
      console.warn('Orders is not an array:', aklOrders)
      return map
    }
    for (const order of aklOrders) {
      const date = getOrderDeliveryDate(order)
      if (!date) continue
      const key = format(date, 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(order)
    }
    return map
  }, [aklOrders])

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

  // Handle creating new order
  const handleCreateOrder = async () => {
    try {
      setIsCreatingOrder(true)
      
      const orderData = {
        ...newOrderData,
        deliveryDate: newOrderData.deliveryDate || format(selectedDate, 'yyyy-MM-dd'),
        lineItems: [] // Start with empty line items
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create order')
      }

      const newOrder = await response.json()
      
      // Refresh orders list
      await fetchOrders()
      
      // Close modal and reset form
      setIsAddOrderModalOpen(false)
      setNewOrderData({
        customerFirstName: '',
        customerLastName: '',
        customerEmail: '',
        customerPhone: '',
        shippingAddress: {
          address1: '',
          address2: '',
          city: '',
          province: '',
          zip: ''
        },
        deliveryDate: '',
        deliveryTime: '',
        note: ''
      })
    } catch (err) {
      console.error('Error creating order:', err)
      alert(`Error creating order: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsCreatingOrder(false)
    }
  }

  // Reset form when modal opens and set default delivery date
  const openAddOrderModal = () => {
    setNewOrderData({
      customerFirstName: '',
      customerLastName: '',
      customerEmail: '',
      customerPhone: '',
      shippingAddress: {
        address1: '',
        address2: '',
        city: '',
        province: '',
        zip: ''
      },
      deliveryDate: format(selectedDate, 'yyyy-MM-dd'),
      deliveryTime: '',
      note: ''
    })
    setIsAddOrderModalOpen(true)
  }

  // Auto-refresh every 2 minutes (120000ms) - handled by useCachedFetch
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing calendar data...')
      fetchOrders() // Background refresh
    }, 120000) // 2 minutes

    return () => clearInterval(interval)
  }, [fetchOrders])
  
  // Trigger a one-off Shopify sync when the calendar page opens
  useEffect(() => {
    syncOrders().catch(() => {})
  }, [syncOrders])

  return (
    <div className="w-full flex flex-col md:flex-row gap-6">
      {/* Left sidebar: Calendar + StockList */}
      <div className="flex flex-col w-full md:w-[340px] md:min-w-[280px] md:max-w-[400px]">
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
            autoRefresh={true}
            refreshInterval={20000}
            showRefreshButton={true}
            targetDate={selectedDate}
          />
        </div>
      </div>
      {/* Main content: OrderCardList (stacks below calendar on mobile) */}
      <div className="flex-1 w-full max-w-full overflow-x-hidden min-w-0">
        <div className="rounded-lg bg-white shadow p-4 w-full max-w-full overflow-x-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-bold text-lg">
                Orders for {format(selectedDate, 'EEE, MMM d, yyyy')}
              </div>
              {lastFetch && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {format(lastFetch, 'HH:mm:ss')} • Auto-refresh every 2 min
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => fetchOrders()} 
                size="sm" 
                variant="outline"
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={openAddOrderModal} size="sm" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Order
              </Button>
            </div>
          </div>
          <div className="min-h-[300px] w-full max-w-full overflow-x-hidden">
            {error && (
              <div className="text-center py-2 text-red-500 text-sm mb-2">{error}</div>
            )}
            {loading && orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
            ) : (
              <>
                {loading && orders.length > 0 && (
                  <div className="text-center py-1 text-xs text-muted-foreground mb-2">
                    🔄 Refreshing...
                  </div>
                )}
                <OrderCardList 
                  orders={filteredOrders} 
                  onUpdateOrder={handleUpdateOrder}
                  onBulkUpdateComplete={() => fetchOrders()}
                  selectedDate={selectedDate}
                />
              </>
            )}
          </div>
        </div>

      </div>

      {/* Add Order Modal */}
      <Dialog open={isAddOrderModalOpen} onOpenChange={setIsAddOrderModalOpen}>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Order</DialogTitle>
            <DialogDescription>
              Create a new order for {format(selectedDate, 'EEE, MMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Customer Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerFirstName">First Name *</Label>
                <Input
                  id="customerFirstName"
                  value={newOrderData.customerFirstName}
                  onChange={(e) => setNewOrderData(prev => ({ ...prev, customerFirstName: e.target.value }))}
                  placeholder="Customer first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerLastName">Last Name *</Label>
                <Input
                  id="customerLastName"
                  value={newOrderData.customerLastName}
                  onChange={(e) => setNewOrderData(prev => ({ ...prev, customerLastName: e.target.value }))}
                  placeholder="Customer last name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email *</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={newOrderData.customerEmail}
                  onChange={(e) => setNewOrderData(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="customer@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={newOrderData.customerPhone}
                  onChange={(e) => setNewOrderData(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="Phone number"
                />
              </div>
            </div>

            {/* Delivery Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Delivery Date</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={newOrderData.deliveryDate}
                  onChange={(e) => setNewOrderData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryTime">Delivery Time</Label>
                <Input
                  id="deliveryTime"
                  type="time"
                  value={newOrderData.deliveryTime}
                  onChange={(e) => setNewOrderData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Delivery Address</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Address Line 1"
                  value={newOrderData.shippingAddress.address1}
                  onChange={(e) => setNewOrderData(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, address1: e.target.value }
                  }))}
                />
                <Input
                  placeholder="Address Line 2 (optional)"
                  value={newOrderData.shippingAddress.address2}
                  onChange={(e) => setNewOrderData(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, address2: e.target.value }
                  }))}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="City"
                    value={newOrderData.shippingAddress.city}
                    onChange={(e) => setNewOrderData(prev => ({
                      ...prev,
                      shippingAddress: { ...prev.shippingAddress, city: e.target.value }
                    }))}
                  />
                  <Input
                    placeholder="Province/State"
                    value={newOrderData.shippingAddress.province}
                    onChange={(e) => setNewOrderData(prev => ({
                      ...prev,
                      shippingAddress: { ...prev.shippingAddress, province: e.target.value }
                    }))}
                  />
                  <Input
                    placeholder="Postal Code"
                    value={newOrderData.shippingAddress.zip}
                    onChange={(e) => setNewOrderData(prev => ({
                      ...prev,
                      shippingAddress: { ...prev.shippingAddress, zip: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Order Notes */}
            <div className="space-y-2">
              <Label htmlFor="note">Order Notes</Label>
              <textarea
                id="note"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                value={newOrderData.note}
                onChange={(e) => setNewOrderData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Add any special instructions or notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOrderModalOpen(false)}
              disabled={isCreatingOrder}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={isCreatingOrder || !newOrderData.customerFirstName || !newOrderData.customerLastName || !newOrderData.customerEmail}
            >
              {isCreatingOrder ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
} 