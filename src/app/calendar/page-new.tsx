"use client";

import { useEffect, useState, useMemo, useCallback } from 'react'
import { StockPanel } from '@/components/StockPanel'
import OrderCardList from '@/components/realtime-orders/order-card-list'
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns'
import { Order } from '@/types/order'
import { getTodayLocal } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
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
import { Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { useShopifySync } from '@/components/shopify-sync/shopify-sync-provider'
import LiveMapModal from '@/components/live-map/LiveMapModal'
import DeliveryMap from '@/components/DeliveryMap'
import { useNativeAppShell } from '@/hooks/useNativeAppShell'
import {
  CalendarDayAlertBanner,
  CalendarDayAlertButton,
  CalendarDayAlertModal,
  useCalendarDayAlert,
} from '@/components/calendar/CalendarDayAlertControls'
import { RosterDrawer, RosterDrawerButton } from '@/components/calendar/RosterDrawer'

interface CalendarSummary {
  region: string
  start: string
  end: string
  days?: Array<{
    date: string
    totalCount: number
    morningCount: number
    needsReviewCount: number
    dispatchedCount: number
  }>
  countsByDay: Array<{ date: string; count: number }>
  needsReviewCount: number
}

export default function CalendarPage() {
  const { syncOrders } = useShopifySync()
  const isMobileApp = useNativeAppShell()
  const region = 'AKL' // Auckland calendar
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => getTodayLocal())
  const [summary, setSummary] = useState<CalendarSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [lastSummaryFetch, setLastSummaryFetch] = useState<Date | null>(null)
  const [alertRefreshToken, setAlertRefreshToken] = useState(0)
  
  // Orders for selected day (fetched on demand)
  const [dayOrders, setDayOrders] = useState<Order[]>([])
  const [dayOrdersLoading, setDayOrdersLoading] = useState(false)
  const [dayOrdersError, setDayOrdersError] = useState<string | null>(null)
  
  // Needs Review panel state
  const [needsReviewOpen, setNeedsReviewOpen] = useState(false)
  const [needsReviewOrders, setNeedsReviewOrders] = useState<Order[]>([])
  const [needsReviewLoading, setNeedsReviewLoading] = useState(false)

  // Add Order Modal state
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false)
  const [isLiveMapOpen, setIsLiveMapOpen] = useState(false)
  const [isRosterOpen, setIsRosterOpen] = useState(false)

  // Day deliveries map (same map as the owner dashboard, numbered by delivery time)
  const [isDeliveriesMapOpen, setIsDeliveriesMapOpen] = useState(false)
  const [deliveriesMapPoints, setDeliveriesMapPoints] = useState<any[]>([])
  const [deliveriesMapLoading, setDeliveriesMapLoading] = useState(false)

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

  // Fetch calendar summary for rolling 29-day window (selected day -14 to +14)
  const fetchCalendarSummary = useCallback(async (anchorDate: Date) => {
    setSummaryLoading(true)
    setSummaryError(null)
    
    try {
      const fetchStart = addDays(anchorDate, -14)
      // End is exclusive, so +15 gives [today-14, today+14]
      const fetchEnd = addDays(anchorDate, 15)
      const startStr = format(fetchStart, 'yyyy-MM-dd')
      const endStr = format(fetchEnd, 'yyyy-MM-dd')
      
      const response = await fetch(`/api/calendar/summary?region=${region}&start=${startStr}&end=${endStr}&fresh=1`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Failed to fetch calendar summary')
      
      const data = await response.json()
      setSummary(data)
      setLastSummaryFetch(new Date())
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load calendar')
      console.error('Error fetching calendar summary:', err)
    } finally {
      setSummaryLoading(false)
    }
  }, [region])

  const openDeliveriesMap = useCallback(async () => {
    setIsDeliveriesMapOpen(true)
    setDeliveriesMapLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/dashboard/deliveries-map?date=${dateStr}&region=auckland`, { cache: 'no-store' })
      const data = await res.json()
      setDeliveriesMapPoints(Array.isArray(data.points) ? data.points : [])
    } catch {
      setDeliveriesMapPoints([])
    } finally {
      setDeliveriesMapLoading(false)
    }
  }, [selectedDate])

  // Fetch orders for a specific day
  const fetchDayOrders = useCallback(async (date: Date) => {
    setDayOrdersLoading(true)
    setDayOrdersError(null)
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const response = await fetch(`/api/orders/by-day?region=${region}&date=${dateStr}&page=1&pageSize=5000`)
      if (!response.ok) throw new Error('Failed to fetch day orders')
      
      const data = await response.json()
      setDayOrders(data.orders || [])
    } catch (err) {
      setDayOrdersError(err instanceof Error ? err.message : 'Failed to load orders')
      console.error('Error fetching day orders:', err)
    } finally {
      setDayOrdersLoading(false)
    }
  }, [region])

  // Fetch needs review orders
  const fetchNeedsReview = useCallback(async () => {
    setNeedsReviewLoading(true)
    try {
      const response = await fetch(`/api/orders/needs-review?region=${region}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Failed to fetch needs review orders')
      const data = await response.json()
      setNeedsReviewOrders(data.orders || [])
    } catch (err) {
      console.error('Error fetching needs review orders:', err)
    } finally {
      setNeedsReviewLoading(false)
    }
  }, [region])

  // Initial load and when month changes
  useEffect(() => {
    fetchCalendarSummary(selectedDate)
  }, [selectedDate, fetchCalendarSummary])

  // Fetch day orders when date is selected
  useEffect(() => {
    fetchDayOrders(selectedDate)
  }, [selectedDate, fetchDayOrders])

  // Auto-refresh rolling window + selected day every 90 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing calendar summary + selected day...')
      fetchCalendarSummary(selectedDate)
      fetchDayOrders(selectedDate)
      setAlertRefreshToken((token) => token + 1)
    }, 90000)

    return () => clearInterval(interval)
  }, [selectedDate, fetchCalendarSummary, fetchDayOrders])

  const calendarAlert = useCalendarDayAlert({
    region,
    selectedDate,
    refreshToken: alertRefreshToken,
  })

  // Trigger Shopify sync on mount
  useEffect(() => {
    syncOrders().catch(() => {})
  }, [syncOrders])

  // Auto-alert on unresolved needs-review orders.
  // This keeps prompting until the count is actually resolved back to zero.
  useEffect(() => {
    const count = Number(summary?.needsReviewCount || 0)
    if (count > 0) {
      setNeedsReviewOpen(true)
      fetchNeedsReview()
    } else {
      setNeedsReviewOpen(false)
      setNeedsReviewOrders([])
    }
  }, [summary?.needsReviewCount, fetchNeedsReview])

  // Calendar rendering helpers
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const today = new Date()

  // Build counts map from summary
  const countsByDay = useMemo(() => {
    const map: Record<string, number> = {}
    if (Array.isArray(summary?.days) && summary.days.length > 0) {
      for (const item of summary.days) {
        map[item.date] = Number(item.totalCount || 0)
      }
    } else if (summary?.countsByDay) {
      for (const item of summary.countsByDay) {
        map[item.date] = item.count
      }
    }
    return map
  }, [summary])

  const calendarDays: { date: Date; isCurrentMonth: boolean; isToday: boolean; orderCount: number }[] = []
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    const key = format(d, 'yyyy-MM-dd')
    calendarDays.push({
      date: d,
      isCurrentMonth: isSameMonth(d, monthStart),
      isToday: isSameDay(d, today),
      orderCount: countsByDay[key] || 0,
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
        lineItems: []
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

      // Refresh summary and day orders
      await Promise.all([
        fetchCalendarSummary(selectedDate),
        fetchDayOrders(selectedDate)
      ])
      
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
      
      // Refresh summary and day orders
      setTimeout(() => {
        fetchCalendarSummary(selectedDate)
        fetchDayOrders(selectedDate)
      }, 500)
      
      return updatedOrder
    } catch (err) {
      console.error('Error updating order:', err)
      throw err
    }
  }

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
                    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
                    setSelectedDate(localDate)
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
        {!isMobileApp ? (
          <div className="rounded-lg bg-white shadow p-4">
            <StockPanel 
              autoRefresh={true}
              refreshInterval={20000}
              showRefreshButton={true}
              targetDate={selectedDate}
            />
          </div>
        ) : null}
      </div>
      
      {/* Main content: OrderCardList */}
      <div className="flex-1 w-full max-w-full overflow-x-hidden min-w-0">
        <div className="rounded-lg bg-white shadow p-4 w-full max-w-full overflow-x-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-bold text-lg">
                Orders for {format(selectedDate, 'EEE, MMM d, yyyy')}
              </div>
              {lastSummaryFetch && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {format(lastSummaryFetch, 'HH:mm:ss')} • Auto-refresh every 90s
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {summary && summary.needsReviewCount > 0 && (
                <Button 
                  onClick={() => {
                    setNeedsReviewOpen(true)
                    fetchNeedsReview()
                  }}
                  size="sm" 
                  variant="outline"
                  className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <AlertCircle className="w-4 h-4" />
                  Needs Review ({summary.needsReviewCount})
                </Button>
              )}
              <Button 
                onClick={() => {
                  fetchCalendarSummary(selectedDate)
                  fetchDayOrders(selectedDate)
                  setAlertRefreshToken((token) => token + 1)
                }}
                size="sm" 
                variant="outline"
                disabled={summaryLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${summaryLoading || dayOrdersLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <CalendarDayAlertButton onClick={() => calendarAlert.setModalOpen(true)} />
              <RosterDrawerButton onClick={() => setIsRosterOpen(true)} />
              <Button onClick={() => setIsLiveMapOpen(true)} size="sm" variant="outline">
                Live Map
              </Button>
              <Button onClick={openDeliveriesMap} size="sm" variant="outline">
                Map
              </Button>
              <Button onClick={openAddOrderModal} size="sm" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Order
              </Button>
            </div>
          </div>
          <CalendarDayAlertBanner
            alert={calendarAlert.alert}
            dismissing={calendarAlert.dismissing}
            onDismiss={calendarAlert.handleDismiss}
          />
          <div className="min-h-[300px] w-full max-w-full overflow-x-hidden">
            {summaryError && (
              <div className="text-center py-2 text-red-500 text-sm mb-2">{summaryError}</div>
            )}
            {dayOrdersError && (
              <div className="text-center py-2 text-red-500 text-sm mb-2">{dayOrdersError}</div>
            )}
            {dayOrdersLoading && dayOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
            ) : (
              <>
                {/* Background refreshes are indicated via the header Refresh
                    button spinner instead of an in-flow banner, so the order
                    card list doesn't jump while auto-refreshing. */}
                <OrderCardList 
                  orders={dayOrders} 
                  onUpdateOrder={handleUpdateOrder}
                  onBulkUpdateComplete={() => {
                    fetchCalendarSummary(selectedDate)
                    fetchDayOrders(selectedDate)
                  }}
                  selectedDate={selectedDate}
                  compactFonts={isMobileApp}
                  mobileSimpleList={isMobileApp}
                  forceCompactOnly={isMobileApp}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Needs Review Dialog */}
      <Dialog open={needsReviewOpen} onOpenChange={setNeedsReviewOpen}>
        <DialogContent className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orders Needing Review ({summary?.needsReviewCount || 0})</DialogTitle>
            <DialogDescription>
              Orders with unclear delivery dates that require manual scheduling. This alert persists until the list is resolved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {needsReviewLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : needsReviewOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No orders need review</div>
            ) : (
              needsReviewOrders.map((order) => (
                <div key={order.id} className="border rounded p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Order #{order.orderNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.customerFirstName} {order.customerLastName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created: {order.createdAt ? format(new Date(order.createdAt), 'MMM d, yyyy') : 'Unknown'}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Open order in new tab or navigate
                        window.open(`/orders?search=${order.orderNumber}`, '_blank')
                      }}
                    >
                      Open Order
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

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
      <CalendarDayAlertModal
        open={calendarAlert.modalOpen}
        onOpenChange={calendarAlert.setModalOpen}
        selectedDate={selectedDate}
        note={calendarAlert.note}
        onNoteChange={calendarAlert.setNote}
        posting={calendarAlert.posting}
        onPost={calendarAlert.handlePost}
      />
      <LiveMapModal open={isLiveMapOpen} onOpenChange={setIsLiveMapOpen} />
      <RosterDrawer
        open={isRosterOpen}
        onClose={() => setIsRosterOpen(false)}
        selectedDate={selectedDate}
      />

      {/* Day deliveries map (numbered stops, same as owner dashboard) */}
      <Dialog
        open={isDeliveriesMapOpen}
        onOpenChange={(open) => {
          setIsDeliveriesMapOpen(open)
          // Pull in any travel-time / driver edits made in the map so the
          // order cards reflect them without a manual refresh.
          if (!open) fetchDayOrders(selectedDate)
        }}
      >
        <DialogContent className="sm:max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Deliveries Map — {format(selectedDate, 'yyyy-MM-dd')}</DialogTitle>
            <DialogDescription>
              All deliveries for the day plotted in delivery-time order
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            {deliveriesMapLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading deliveries...</div>
            ) : deliveriesMapPoints.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No deliveries found for this day</div>
            ) : (
              (() => {
                const modalH = (typeof window !== 'undefined' && window.innerHeight) ? Math.round(window.innerHeight * 0.72) : 640
                return (
                  <DeliveryMap
                    deliveryPoints={deliveriesMapPoints}
                    heightPx={modalH}
                    listPosition="right"
                    originAddress="562 Richmond Road, Grey Lynn, Auckland 1021"
                    allowAssignDriver
                  />
                )
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
