"use client";

import { useEffect, useState, useMemo } from 'react'
import { StockPanel } from '@/components/StockPanel'
import OrderCardList from '@/components/realtime-orders/order-card-list'
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns'
import { Order } from '@/types/order'
import { getTodayLocal, parseLocalDate } from '@/lib/date-utils'

export default function WlgCalendarPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => getTodayLocal())

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/orders?limit=10000')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()
      const list: Order[] = Array.isArray(data) ? data : Array.isArray(data.orders) ? data.orders : []

      // Filter to city=WLG in either noteAttributes or any line item properties
      const filtered = list.filter((o: any) => {
        // 1) Primary source: order-level note_attributes City
        const noteProps = Array.isArray(o.noteAttributes) ? o.noteAttributes : (Array.isArray(o.note_attributes) ? o.note_attributes : [])
        const cityAttr = noteProps.find((p: any) => ((p?.name || '') as string).toLowerCase() === 'city')
        if (cityAttr) {
          return String(cityAttr.value || '').toUpperCase() === 'WLG'
        }

        // 2) Fallback: line items properties (legacy)
        let items: any[] = []
        if (Array.isArray(o.lineItems)) items = o.lineItems
        else if (typeof o.lineItems === 'string' && o.lineItems) {
          try { items = JSON.parse(o.lineItems) } catch { items = [] }
        }
        if (items.some(it => Array.isArray(it?.properties) && it.properties.some((p: any) => ((p?.name || '') as string).toLowerCase() === 'city' && String(p?.value).toUpperCase() === 'WLG'))) return true

        // 3) Fallback: shipping address
        const ship = (o as any).shippingAddress || (o as any).shipping_address || {}
        const shipCity = String(ship?.city || '').toLowerCase()
        const shipProvince = String(ship?.province || '').toLowerCase()
        const provinceCode = String(ship?.province_code || '').toUpperCase()
        
        // Check if city contains "wellington" or province is "Wellington" or province code is "WGN"
        if (shipCity.includes('wellington') || shipProvince === 'wellington' || provinceCode === 'WGN') return true

        return false
      })

      setOrders(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

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
          <div className="font-bold text-lg mb-2">Orders for {format(selectedDate, 'EEE, MMM d, yyyy')}</div>
          <div className="min-h-[300px] w-full max-w-full overflow-x-hidden">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">{error}</div>
            ) : (
              <OrderCardList orders={filteredOrders} onUpdateOrder={async (orderId, updates) => {
                const res = await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
                if (!res.ok) throw new Error('Failed to update order')
                const updated = await res.json()
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o))
                return updated
              }} onBulkUpdateComplete={fetchOrders} selectedDate={selectedDate} originAddressOverride={"9 Ganges Road, Khandallah, Wellington 6035"} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}



