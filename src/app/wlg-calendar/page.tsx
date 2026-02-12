"use client";

import { useEffect, useState, useMemo } from 'react'
import { StockPanel } from '@/components/StockPanel'
import OrderCardList from '@/components/realtime-orders/order-card-list'
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns'
import { Order } from '@/types/order'
import { getTodayLocal, parseLocalDate } from '@/lib/date-utils'
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
import { Plus, RefreshCw } from 'lucide-react'
import { isWellingtonOrder } from '@/lib/region'

export default function WlgCalendarPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => getTodayLocal())
  
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
      city: 'Wellington',
      province: 'Wellington',
      zip: ''
    },
    deliveryDate: '',
    deliveryTime: '',
    note: '',
    noteAttributes: [{ name: 'City', value: 'WLG' }]
  })

  const fetchOrders = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch('/api/orders?limit=10000')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()
      const list: Order[] = Array.isArray(data) ? data : Array.isArray(data.orders) ? data.orders : []

      // Filter orders using centralized Wellington detection
      const filtered = list.filter((o: any) => isWellingtonOrder(o))

      setOrders(filtered)
      setError(null)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders')
      // Don't clear orders on error - keep existing data
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Initial load - show UI immediately, load data in background
  useEffect(() => {
    // Load immediately in background (don't block UI)
    fetchOrders(false)
  }, [])

  // Auto-refresh every 2 minutes (120000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing WLG calendar data...')
      fetchOrders(false) // Background refresh, don't show loading spinner
    }, 120000) // 2 minutes

    return () => clearInterval(interval)
  }, [])

  // Group orders by date (YYYY-MM-DD) identical to main calendar
  const ordersByDate = useMemo(() => {
    const map: Record<string, Order[]> = {}
    for (const o of orders) {
      let d: Date | null = null
      if (o.deliveryDate) d = parseLocalDate(o.deliveryDate)
      if (!d && (o as any).note_attributes && Array.isArray((o as any).note_attributes)) {
        const a = (o as any).note_attributes.find((x: any) => x.name === 'Delivery Date')
        if (a?.value) d = parseLocalDate(a.value)
      }
      // Also parse from note text e.g. "... | Delivery Date: Wed Sep 10 2025"
      if (!d && typeof (o as any).note === 'string') {
        const note: string = (o as any).note
        const m = note.match(/Delivery Date:\s*([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4})/)
        if (m && m[1]) {
          const parsed = parseLocalDate(m[1])
          if (parsed) d = parsed
        }
      }
      if (!d && o.createdAt) d = parseLocalDate(o.createdAt)
      if (!d) continue
      const key = format(d, 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(o)
    }
    return map
  }, [orders])

  const filteredOrders = useMemo(() => ordersByDate[format(selectedDate, 'yyyy-MM-dd')] || [], [ordersByDate, selectedDate])

  // Calendar rendering helpers
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const today = new Date()

  const calendarDays: { date: Date; isCurrentMonth: boolean; isToday: boolean; orderCount: number }[] = []
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    const key = format(d, 'yyyy-MM-dd')
    calendarDays.push({ date: d, isCurrentMonth: isSameMonth(d, monthStart), isToday: isSameDay(d, today), orderCount: ordersByDate[key]?.length || 0 })
  }

  function goToPrevMonth() { setSelectedDate(prev => addDays(startOfMonth(prev), -1)) }
  function goToNextMonth() { setSelectedDate(prev => addDays(endOfMonth(prev), 1)) }

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

      await fetchOrders()
      
      setIsAddOrderModalOpen(false)
      setNewOrderData({
        customerFirstName: '',
        customerLastName: '',
        customerEmail: '',
        customerPhone: '',
        shippingAddress: {
          address1: '',
          address2: '',
          city: 'Wellington',
          province: 'Wellington',
          zip: ''
        },
        deliveryDate: '',
        deliveryTime: '',
        note: '',
        noteAttributes: [{ name: 'City', value: 'WLG' }]
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
        city: 'Wellington',
        province: 'Wellington',
        zip: ''
      },
      deliveryDate: format(selectedDate, 'yyyy-MM-dd'),
      deliveryTime: '',
      note: '',
      noteAttributes: [{ name: 'City', value: 'WLG' }]
    })
    setIsAddOrderModalOpen(true)
  }

  return (
    <div className="flex w-full gap-6">
      {/* Left sidebar: Calendar + StockList */}
      <div className="flex flex-col w-[340px] min-w-[280px] max-w-[400px]">
        <div className="mb-6 rounded-lg bg-white shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-gray-100"><span className="sr-only">Previous month</span><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <div className="font-semibold text-lg">WLG Calendar — {format(monthStart, 'MMMM yyyy')}</div>
            <button onClick={goToNextMonth} className="p-1 rounded hover:bg-gray-100"><span className="sr-only">Next month</span><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-1">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, isCurrentMonth, isToday, orderCount }) => {
              const isSelected = isSameDay(date, selectedDate)
              return (
                <button key={date.toISOString()} onClick={() => setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0,0,0,0))} className={'aspect-square w-full rounded flex flex-col items-center justify-center border ' + (isSelected ? 'bg-blue-600 text-white border-blue-700 shadow' : isToday ? 'border-blue-400 text-blue-700 bg-blue-50' : isCurrentMonth ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-gray-50 text-gray-400 border-gray-100')}>
                  <span className="font-medium text-base">{date.getDate()}</span>
                  {orderCount > 0 && (<span className="text-xs mt-0.5 text-purple-600 font-semibold">{orderCount}</span>)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="rounded-lg bg-white shadow p-4">
          <StockPanel autoRefresh={false} showRefreshButton={true} targetDate={selectedDate} cityFilter="WLG" />
        </div>
      </div>
      {/* Main content: OrderCardList */}
      <div className="flex-1 w-full max-w-full overflow-x-hidden">
        <div className="rounded-lg bg-white shadow p-4 w-full max-w-full overflow-x-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-bold text-lg">
                Orders for {format(selectedDate, 'EEE, MMM d, yyyy')}
              </div>
              {lastRefresh && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {format(lastRefresh, 'HH:mm:ss')} • Auto-refresh every 2 min
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => fetchOrders(true)} 
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
                <OrderCardList orders={filteredOrders} onUpdateOrder={async (orderId, updates) => {
                  const res = await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
                  if (!res.ok) throw new Error('Failed to update order')
                  const updated = await res.json()
                  setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o))
                  return updated
                }} onBulkUpdateComplete={() => fetchOrders(true)} selectedDate={selectedDate} originAddressOverride={"9 Ganges Road, Khandallah, Wellington 6035"} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Order Modal */}
      <Dialog open={isAddOrderModalOpen} onOpenChange={setIsAddOrderModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Order</DialogTitle>
            <DialogDescription>
              Create a new WLG order for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input
                  value={newOrderData.customerFirstName}
                  onChange={(e) => setNewOrderData({...newOrderData, customerFirstName: e.target.value})}
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={newOrderData.customerLastName}
                  onChange={(e) => setNewOrderData({...newOrderData, customerLastName: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newOrderData.customerEmail}
                onChange={(e) => setNewOrderData({...newOrderData, customerEmail: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Phone</Label>
              <Input
                value={newOrderData.customerPhone}
                onChange={(e) => setNewOrderData({...newOrderData, customerPhone: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Address Line 1</Label>
              <Input
                value={newOrderData.shippingAddress.address1}
                onChange={(e) => setNewOrderData({
                  ...newOrderData,
                  shippingAddress: {...newOrderData.shippingAddress, address1: e.target.value}
                })}
              />
            </div>
            
            <div>
              <Label>Address Line 2</Label>
              <Input
                value={newOrderData.shippingAddress.address2}
                onChange={(e) => setNewOrderData({
                  ...newOrderData,
                  shippingAddress: {...newOrderData.shippingAddress, address2: e.target.value}
                })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Delivery Date</Label>
                <Input
                  type="date"
                  value={newOrderData.deliveryDate}
                  onChange={(e) => setNewOrderData({...newOrderData, deliveryDate: e.target.value})}
                />
              </div>
              <div>
                <Label>Delivery Time</Label>
                <Input
                  type="time"
                  value={newOrderData.deliveryTime}
                  onChange={(e) => setNewOrderData({...newOrderData, deliveryTime: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Input
                value={newOrderData.note}
                onChange={(e) => setNewOrderData({...newOrderData, note: e.target.value})}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={isCreatingOrder}>
              {isCreatingOrder ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



