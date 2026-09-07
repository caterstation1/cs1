'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import EditOrderModal from '@/components/orders/EditOrderModal'
import CustomerDetailTabs from '@/components/customers/CustomerDetailTabs'
import { sanitizeNotes } from '@/lib/notes'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import YesterdaysPostPurchaseFollowUps from '@/components/dashboard/YesterdaysPostPurchaseFollowUps'
import { useShiftLocationTracking } from '@/hooks/useShiftLocationTracking'
import LiveMapModal from '@/components/live-map/LiveMapModal'

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  totalOrders: number
  totalSpent: number
  last60DaysSpent: number
  isVIP?: boolean
}

interface OrderLite {
  id: string
  orderNumber: number
  createdAt: string
  deliveryDate?: string | null
  deliveryTime?: string | null
  tags?: string | null
  customerFirstName: string
  customerLastName: string
  customerPhone?: string | null
  shippingAddress?: any
  lineItems?: any
  note?: string | null
  internalNote?: string | null
  fulfillmentStatus?: string | null
  fulfillmentClientNote?: string | null
}

interface FulfillmentAlertOrder extends OrderLite {
  triggers?: Array<{
    ruleId: string
    metric: 'orders' | 'spent'
    threshold: number
    suggestedRebate: string
    actualValue: number
  }>
  lifetimeSpend?: number
  orderOrdinal?: number
}

interface Car {
  id: string
  name: string
  rego: string
  wofExpiry?: string | null
  regoExpiry?: string | null
}

interface Todo {
  id: string
  userId: string
  content: string
  isCompleted: boolean
  createdAt: string
}

function expiryColor(dateIso?: string | null) {
  if (!dateIso) return 'bg-slate-100 text-slate-700 border border-slate-300'
  const now = new Date()
  const d = new Date(dateIso)
  if (isNaN(d.getTime())) return 'bg-slate-100 text-slate-700 border border-slate-300'
  const days = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'bg-red-100 text-red-800 border border-red-200'
  if (days <= 30) return 'bg-amber-100 text-amber-800 border border-amber-200'
  return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
}

export default function AdminSDashboard() {
  const { data: session } = useSession()
  const userId = (session as any)?.session?.user?.id || (session as any)?.user?.id || 'unknown'
  const userEmail = (session as any)?.session?.user?.email || (session as any)?.user?.email || ''

  // Clock in/out
  const [isClocking, setIsClocking] = useState(false)
  const [clockInDialogOpen, setClockInDialogOpen] = useState(false)
  const [liveMapOpen, setLiveMapOpen] = useState(false)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [activeShift, setActiveShift] = useState<any | null>(null)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [editShiftDate, setEditShiftDate] = useState<string>('')
  const [editClockIn, setEditClockIn] = useState<string>('')
  const [editClockOut, setEditClockOut] = useState<string>('')
  const [editShiftMileage, setEditShiftMileage] = useState<string>('')
  const [editShiftNotes, setEditShiftNotes] = useState<string>('')
  const { stopTracking, refreshServerStatus } = useShiftLocationTracking()
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const loadStaffAndShifts = useCallback(async () => {
    try {
      const rs = await fetch('/api/staff')
      if (!rs.ok) return
      const staff = await rs.json()
      const me = (staff || []).find((s: any) => s.email?.toLowerCase() === String(userEmail).toLowerCase())
      if (!me) return
      setStaffId(me.id)
      const r = await fetch(`/api/timesheet?staffId=${encodeURIComponent(me.id)}`)
      if (!r.ok) return
      const all = await r.json()
      const sorted = all.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setShifts(sorted)
      setActiveShift(sorted.find((s: any) => !s.clockOut && s.status === 'active') || null)
    } catch {}
  }, [userEmail])
  useEffect(() => { loadStaffAndShifts() }, [loadStaffAndShifts])
  const clockIn = useCallback(async () => {
    try {
      setIsClocking(true)
      const fitForWork = window.confirm(
        'Are you feeling fit and well for work today?\n\nPress OK for Yes, Cancel for No.'
      )
      const response = await fetch('/api/timesheet/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fitForWork }),
      })
      // Clock-in does NOT start location tracking. Delivery-run location
      // sharing only activates when a dispatched order is assigned to this
      // driver (handled by the tracking provider's status sync).
      if (response.ok) {
        await refreshServerStatus().catch(() => null)
      }
      await loadStaffAndShifts()
    } finally {
      setIsClocking(false)
    }
  }, [loadStaffAndShifts, refreshServerStatus])
  const clockOut = useCallback(async () => {
    try {
      setIsClocking(true)
      await fetch('/api/timesheet/clock-out', { method: 'POST' })
      await stopTracking(true, 'clock_out')
      await loadStaffAndShifts()
    } finally {
      setIsClocking(false)
    }
  }, [loadStaffAndShifts, stopTracking])

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/customers')
        if (!res.ok) return
        const data = await res.json()
        setCustomers(Array.isArray(data.customers) ? data.customers : [])
      } catch {}
    }
    run()
  }, [])
  const filteredCustomers = useMemo(() => {
    const s = customerSearch.trim().toLowerCase()
    if (!s) return customers.slice(0, 30)
    return customers.filter(c =>
      c.firstName.toLowerCase().includes(s) ||
      c.lastName.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      (c.phone || '').includes(s)
    ).slice(0, 50)
  }, [customers, customerSearch])

  // Orders
  const [orders, setOrders] = useState<OrderLite[]>([])
  const [orderSearch, setOrderSearch] = useState('')
  const [editingOrder, setEditingOrder] = useState<any | null>(null)
  const [internalNoteDraft, setInternalNoteDraft] = useState<Record<string, string>>({})
  const [recentFulfillmentOrders, setRecentFulfillmentOrders] = useState<FulfillmentAlertOrder[]>([])
  const [outTodayFulfillmentOrders, setOutTodayFulfillmentOrders] = useState<FulfillmentAlertOrder[]>([])
  const [fulfillmentAlertsMeta, setFulfillmentAlertsMeta] = useState<{ nowYmd: string; recentWindowDays: number } | null>(null)
  const [notifyCustomer, setNotifyCustomer] = useState<boolean>(false)
  const [fulfillmentNoteDraft, setFulfillmentNoteDraft] = useState<Record<string, string>>({})
  const fetchOrders = useCallback(async (search: string) => {
    const params = new URLSearchParams({ limit: '100' })
    if (search) params.append('search', search)
    const res = await fetch(`/api/orders?${params.toString()}`)
    if (!res.ok) return
    const data = await res.json()
    setOrders(data.orders || [])
  }, [])
  useEffect(() => {
    fetchOrders('')
  }, [fetchOrders])
  const loadFulfillmentAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/fulfillment-comms/alerts', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setRecentFulfillmentOrders(Array.isArray(data.recentOrders) ? data.recentOrders : [])
      setOutTodayFulfillmentOrders(Array.isArray(data.outTodayOrders) ? data.outTodayOrders : [])
      setFulfillmentAlertsMeta({
        nowYmd: data.nowYmd || '',
        recentWindowDays: typeof data.recentWindowDays === 'number' ? data.recentWindowDays : 7,
      })
    } catch {}
  }, [])
  useEffect(() => {
    loadFulfillmentAlerts()
  }, [loadFulfillmentAlerts])
  const fulfillOrder = useCallback(async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/fulfill?notify=${notifyCustomer ? '1' : '0'}`, { method: 'POST' })
    if (res.ok) {
      setRecentFulfillmentOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, fulfillmentStatus: 'fulfilled' } as FulfillmentAlertOrder : o))
      )
      setOutTodayFulfillmentOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, fulfillmentStatus: 'fulfilled' } as FulfillmentAlertOrder : o))
      )
      await loadFulfillmentAlerts()
    } else {
      console.error('Failed to fulfill order', await res.text().catch(() => ''))
    }
  }, [notifyCustomer, loadFulfillmentAlerts])
  const saveFulfillmentClientNote = useCallback(async (orderId: string) => {
    const text = (fulfillmentNoteDraft[orderId] ?? '').trim()
    const res = await fetch(`/api/orders/${orderId}/fulfillment-client-note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfillmentClientNote: text || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRecentFulfillmentOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, fulfillmentClientNote: updated.fulfillmentClientNote } : o))
      )
      setOutTodayFulfillmentOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, fulfillmentClientNote: updated.fulfillmentClientNote } : o))
      )
      setFulfillmentNoteDraft((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
    }
  }, [fulfillmentNoteDraft])
  const itemsTitles = (li: any): string[] => {
    if (!li) return []
    let arr: any[] = []
    if (Array.isArray(li)) {
      arr = li
    } else if (typeof li === 'string') {
      try { arr = JSON.parse(li) } catch { arr = [] }
    }
    return arr.map((x: any) => x.title || x.name).filter(Boolean)
  }
  const saveInternalNote = useCallback(async (orderId: string) => {
    const draft = internalNoteDraft[orderId] || ''
    const res = await fetch('/api/orders/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: { orderId, updates: { internalNote: draft } }, action: 'update' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, internalNote: updated.internalNote } : o))
      setInternalNoteDraft(prev => ({ ...prev, [orderId]: '' }))
    }
  }, [internalNoteDraft])

  // Cars
  const [cars, setCars] = useState<Car[]>([])
  const [carForm, setCarForm] = useState<Partial<Car>>({ name: '', rego: '', wofExpiry: '', regoExpiry: '' })
  const [editingCar, setEditingCar] = useState<Partial<Car> & { id?: string } | null>(null)
  const loadCars = useCallback(async () => {
    const res = await fetch('/api/cars')
    if (!res.ok) return
    setCars(await res.json())
  }, [])
  useEffect(() => { loadCars() }, [loadCars])
  const saveCar = useCallback(async () => {
    const body = { ...carForm }
    const res = await fetch('/api/cars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      setCarForm({ name: '', rego: '', wofExpiry: '', regoExpiry: '' })
      loadCars()
    }
  }, [carForm, loadCars])
  const updateCar = useCallback(async (id: string, patch: Partial<Car>) => {
    const res = await fetch(`/api/cars/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (res.ok) loadCars()
  }, [loadCars])
  const deleteCar = useCallback(async (id: string) => {
    const res = await fetch(`/api/cars/${id}`, { method: 'DELETE' })
    if (res.ok) loadCars()
  }, [loadCars])

  // Todos
  const [todos, setTodos] = useState<Todo[]>([])
  const [todoText, setTodoText] = useState('')
  const loadTodos = useCallback(async () => {
    const res = await fetch('/api/todos?completed=0')
    if (!res.ok) return
    setTodos(await res.json())
  }, [])
  useEffect(() => { loadTodos() }, [loadTodos])
  const addTodo = useCallback(async () => {
    if (!todoText.trim()) return
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, content: todoText.trim() }),
    })
    if (res.ok) {
      setTodoText('')
      loadTodos()
    }
  }, [todoText, userId, loadTodos])
  const toggleTodo = useCallback(async (id: string, isCompleted: boolean) => {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted }),
    })
    if (res.ok) loadTodos()
  }, [loadTodos])
  const removeTodo = useCallback(async (id: string) => {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    if (res.ok) loadTodos()
  }, [loadTodos])

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
      {/* 1) Clock In/Out */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Clock In / Out</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setLiveMapOpen(true)}>
              Live Map
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button
              onClick={() => setClockInDialogOpen(true)}
              disabled={isClocking || !!activeShift}
              className={`min-h-11 ${activeShift ? 'cursor-default bg-emerald-600 text-white hover:bg-emerald-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {activeShift ? 'Clocked In' : 'Clock In'}
            </Button>
            <Button
              onClick={clockOut}
              disabled={isClocking || !activeShift}
              className={`min-h-11 ${!activeShift ? 'cursor-default border-slate-200 bg-slate-100 text-slate-400' : 'border-red-200 bg-red-600 text-white hover:bg-red-700'}`}
            >
              Clock Out
            </Button>
            {activeShift && (
              <div className="text-sm font-medium text-emerald-700">
                Started: {new Date(activeShift.clockIn).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })} • Elapsed:{' '}
                {(() => {
                  const ms = nowTick - new Date(activeShift.clockIn).getTime()
                  const h = Math.floor(ms / 3600000)
                  const m = Math.floor((ms % 3600000) / 60000)
                  const s = Math.floor((ms % 60000) / 1000)
                  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                })()}
              </div>
            )}
          </div>
          <div className="mobile-inset-panel max-h-[180px] overflow-auto p-2">
            {(shifts || []).filter(s => {
              const d = new Date(s.date)
              const days = (Date.now() - d.getTime()) / 86400000
              return days <= 14
            }).map(s => (
              <div key={s.id} className="flex flex-col gap-2 border-b border-slate-200 py-2 text-sm last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-[160px] font-medium text-slate-900">{new Date(s.date).toLocaleDateString('en-GB')} {s.status === 'active' ? '(active)' : ''}</div>
                <div className="flex-1 text-slate-700">
                  {s.clockIn ? new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} - {s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  {typeof s.totalHours === 'number' ? ` • ${s.totalHours.toFixed(2)} hrs` : ''}
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  setEditingShift(s)
                  const d = new Date(s.date); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0')
                  setEditShiftDate(`${y}-${m}-${day}`)
                  const toTime = (dt?: string) => dt ? (()=>{ const t=new Date(dt); return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` })() : ''
                  setEditClockIn(toTime(s.clockIn))
                  setEditClockOut(toTime(s.clockOut))
                  setEditShiftMileage(typeof s.mileage === 'number' ? String(s.mileage) : '')
                  setEditShiftNotes(s.notes || '')
                }}>Edit</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Dialog open={clockInDialogOpen} onOpenChange={setClockInDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Clock In</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Location sharing is not active just because you are clocked in.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                It is only used while you are on an assigned dispatched delivery run, so dispatch can provide
                customer ETAs, avoid calling drivers while driving, and see when drivers are returning to base.
                It stops when you return to base, tap Stop Tracking, or clock out.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockInDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                setClockInDialogOpen(false)
                await clockIn()
              }}
            >
              Continue Clock In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LiveMapModal open={liveMapOpen} onOpenChange={setLiveMapOpen} />

      {/* 2) Customers */}
      <Card className="dashboard-card xl:row-span-2">
        <CardHeader>
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="max-h-[420px] overflow-auto divide-y">
              {filteredCustomers.map(c => (
                <button key={c.id} onClick={() => setSelectedCustomer(c)} className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-2 text-left hover:border-slate-200 hover:bg-slate-50">
                  <div>
                    <div className="font-medium text-slate-900">{c.firstName} {c.lastName}</div>
                    <div className="text-sm text-slate-600">{c.email} {c.phone ? `• ${c.phone}` : ''}</div>
                  </div>
                  {c.isVIP ? <Badge>VIP</Badge> : null}
                </button>
              ))}
            </div>
            <div className="min-h-[420px]">
              {selectedCustomer ? (
                <CustomerDetailTabs customer={selectedCustomer as any} />
              ) : (
                <div className="text-sm text-slate-500">Select a customer to view details</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3) Orders */}
      <Card className="dashboard-card xl:row-span-2">
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-1">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Search orders (number, name, email, phone...)" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
            <Button className="min-h-11 sm:min-h-10" onClick={() => fetchOrders(orderSearch)}>Search</Button>
          </div>
          <div className="max-h-[420px] overflow-auto divide-y pb-0">
            {orders.map(o => (
              <div key={o.id} className="py-2">
                <div className="font-medium">#{o.orderNumber} • {o.customerFirstName} {o.customerLastName}</div>
                <div className="text-sm text-slate-600">
                  {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('en-GB') : '—'} {o.deliveryTime ? `• ${o.deliveryTime}` : ''} • {o.customerPhone || '—'}
                </div>
                <div className="text-sm text-slate-800">{o.shippingAddress?.company || ''} — {(o.shippingAddress?.address1 || '')} {(o.shippingAddress?.address2 || '')}</div>
                <div className="text-xs text-slate-700 mt-1">
                  Items:
                  <ul className="list-disc pl-5">
                    {itemsTitles(o.lineItems).map((t, idx) => (<li key={idx}>{t}</li>))}
                  </ul>
                </div>
                <div className="text-xs text-slate-500 mt-1">{sanitizeNotes(o.note || '')}</div>
                <div className="text-xs text-slate-500">{o.internalNote || ''}</div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => setEditingOrder(o)}>Edit</Button>
                </div>
                <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Input placeholder="Add internal note..." value={internalNoteDraft[o.id] || ''} onChange={e => setInternalNoteDraft(prev => ({ ...prev, [o.id]: e.target.value }))} />
                  <Button size="sm" className="min-h-10 sm:min-h-9" onClick={() => saveInternalNote(o.id)}>Save</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3b) Fulfillment — recent placed & out today */}
      <Card className="dashboard-card xl:col-span-2">
        <CardHeader>
          <CardTitle>Fulfillment</CardTitle>
          <div className="text-xs text-slate-500 mt-1">
            {fulfillmentAlertsMeta
              ? `NZ today: ${fulfillmentAlertsMeta.nowYmd} · “Recent” = last ${fulfillmentAlertsMeta.recentWindowDays} days`
              : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} />
              Email customer on fulfill (app confirmation; not Shopify)
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => loadFulfillmentAlerts()}>
              Refresh lists
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="mobile-inset-panel max-h-[520px] space-y-2 overflow-auto p-3">
              <div className="text-sm font-semibold text-slate-900">Recently placed</div>
              {recentFulfillmentOrders.length === 0 ? (
                <div className="text-sm text-slate-500">No orders in the recent window.</div>
              ) : (
                recentFulfillmentOrders.map((o) => (
                  <div key={o.id} className="space-y-2 border-b border-slate-200 py-3 last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          #{o.orderNumber} • {o.customerFirstName} {o.customerLastName}
                        </div>
                        <div className="text-xs text-slate-600">
                          Placed {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                          {typeof o.orderOrdinal === 'number' ? ` · order #${o.orderOrdinal} for customer` : ''}
                          {typeof o.lifetimeSpend === 'number' ? ` · lifetime $${o.lifetimeSpend.toFixed(0)}` : ''}
                        </div>
                        <div className="text-xs text-slate-500">Delivery: {o.deliveryTime || '—'}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          {o.fulfillmentStatus || 'unfulfilled'}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => fulfillOrder(o.id)}
                          disabled={o.fulfillmentStatus === 'fulfilled'}
                        >
                          {o.fulfillmentStatus === 'fulfilled' ? 'Fulfilled' : 'Fulfill'}
                        </Button>
                      </div>
                    </div>
                    {(o.triggers || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(o.triggers || []).map((t) => (
                          <span
                            key={t.ruleId}
                            className="rounded-md border border-slate-200 bg-blue-50 px-2 py-0.5 text-xs text-slate-800"
                          >
                            {t.metric === 'orders'
                              ? `Order ${t.actualValue} — ${t.suggestedRebate || 'milestone'}`
                              : `Spend ≥ $${t.threshold} — ${t.suggestedRebate || 'milestone'}`}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <Label className="text-xs text-slate-600">Client confirmation note (email)</Label>
                      <textarea
                        className="mt-1 min-h-[56px] w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400"
                        placeholder="Optional personal message to include in the confirmation email…"
                        value={fulfillmentNoteDraft[o.id] ?? o.fulfillmentClientNote ?? ''}
                        onChange={(e) => setFulfillmentNoteDraft((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-1"
                        onClick={() => saveFulfillmentClientNote(o.id)}
                      >
                        Save note
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mobile-inset-panel max-h-[520px] space-y-2 overflow-auto p-3">
              <div className="text-sm font-semibold text-slate-900">Out today</div>
              {outTodayFulfillmentOrders.length === 0 ? (
                <div className="text-sm text-slate-500">No orders scheduled out today.</div>
              ) : (
                outTodayFulfillmentOrders.map((o) => (
                  <div key={o.id} className="space-y-2 border-b border-slate-200 py-3 last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          #{o.orderNumber} • {o.customerFirstName} {o.customerLastName}
                        </div>
                        <div className="text-xs text-slate-600">
                          {typeof o.orderOrdinal === 'number' ? `Order #${o.orderOrdinal} for customer` : ''}
                          {typeof o.lifetimeSpend === 'number' ? ` · lifetime $${o.lifetimeSpend.toFixed(0)}` : ''}
                        </div>
                        <div className="text-xs text-slate-500">Time: {o.deliveryTime || '—'}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          {o.fulfillmentStatus || 'unfulfilled'}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => fulfillOrder(o.id)}
                          disabled={o.fulfillmentStatus === 'fulfilled'}
                        >
                          {o.fulfillmentStatus === 'fulfilled' ? 'Fulfilled' : 'Fulfill'}
                        </Button>
                      </div>
                    </div>
                    {(o.triggers || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(o.triggers || []).map((t) => (
                          <span
                            key={t.ruleId}
                            className="rounded-md border border-slate-200 bg-blue-50 px-2 py-0.5 text-xs text-slate-800"
                          >
                            {t.metric === 'orders'
                              ? `Order ${t.actualValue} — ${t.suggestedRebate || 'milestone'}`
                              : `Spend ≥ $${t.threshold} — ${t.suggestedRebate || 'milestone'}`}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <Label className="text-xs text-slate-600">Client confirmation note (email)</Label>
                      <textarea
                        className="mt-1 min-h-[56px] w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400"
                        placeholder="Optional personal message…"
                        value={fulfillmentNoteDraft[o.id] ?? o.fulfillmentClientNote ?? ''}
                        onChange={(e) => setFulfillmentNoteDraft((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-1"
                        onClick={() => saveFulfillmentClientNote(o.id)}
                      >
                        Save note
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <YesterdaysPostPurchaseFollowUps />

      {/* 4) Cars */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Cars</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <Label>Name</Label>
              <Input value={carForm.name || ''} onChange={e => setCarForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Rego</Label>
              <Input value={carForm.rego || ''} onChange={e => setCarForm(f => ({ ...f, rego: e.target.value }))} />
            </div>
            <div>
              <Label>WOF Expiry</Label>
              <Input type="date" value={carForm.wofExpiry || ''} onChange={e => setCarForm(f => ({ ...f, wofExpiry: e.target.value }))} />
            </div>
            <div>
              <Label>Rego Expiry</Label>
              <Input type="date" value={carForm.regoExpiry || ''} onChange={e => setCarForm(f => ({ ...f, regoExpiry: e.target.value }))} />
            </div>
          </div>
          <Button onClick={saveCar}>Add Car</Button>

          <div className="divide-y mt-3">
            {cars.map(car => (
              <div key={car.id} className="py-2 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{car.name} • {car.rego}</div>
                  <div className="text-xs flex gap-2">
                    <span className={`px-2 py-0.5 rounded ${expiryColor(car.wofExpiry)}`}>WOF {car.wofExpiry ? new Date(car.wofExpiry).toLocaleDateString() : 'N/A'}</span>
                    <span className={`px-2 py-0.5 rounded ${expiryColor(car.regoExpiry)}`}>Rego {car.regoExpiry ? new Date(car.regoExpiry).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditingCar(car)}>Edit</Button>
                  <Button variant="destructive" onClick={() => deleteCar(car.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 5) Todos */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Todos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="New todo..." value={todoText} onChange={e => setTodoText(e.target.value)} />
            <Button className="min-h-11 sm:min-h-10" onClick={addTodo}>Add</Button>
          </div>
          <div className="divide-y">
            {todos.map(t => (
              <div key={t.id} className="py-2 flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={t.isCompleted} onChange={e => toggleTodo(t.id, e.target.checked)} />
                  <span className={t.isCompleted ? 'line-through text-slate-400' : ''}>{t.content}</span>
                </label>
                <Button variant="ghost" onClick={() => removeTodo(t.id)}>Remove</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <EditOrderModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        onUpdated={(updated) => {
          setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
        }}
      />
      <Dialog open={!!editingShift} onOpenChange={(v)=>{ if(!v){ setEditingShift(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={editShiftDate} onChange={e=>setEditShiftDate(e.target.value)} />
            </div>
            <div>
              <Label>Clock In</Label>
              <Input type="time" value={editClockIn} onChange={e=>setEditClockIn(e.target.value)} />
            </div>
            <div>
              <Label>Clock Out</Label>
              <Input type="time" value={editClockOut} onChange={e=>setEditClockOut(e.target.value)} />
            </div>
            <div>
              <Label>Mileage (km)</Label>
              <Input type="number" min="0" step="0.1" placeholder="0" value={editShiftMileage} onChange={e=>setEditShiftMileage(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} placeholder="Add notes about this shift..." value={editShiftNotes} onChange={e=>setEditShiftNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setEditingShift(null)}>Cancel</Button>
            <Button onClick={async ()=>{
              if(!editingShift) return
              // Compose ISO datetimes in local timezone
              const buildIso = (dateStr: string, timeStr: string) => {
                if (!dateStr || !timeStr) return null
                const [h,m] = timeStr.split(':').map(Number)
                const d = new Date(dateStr + 'T00:00:00')
                d.setHours(h, m, 0, 0)
                return d.toISOString()
              }
              const payload:any = { date: editShiftDate }
              const ci = buildIso(editShiftDate, editClockIn)
              const co = buildIso(editShiftDate, editClockOut)
              if (ci) payload.clockIn = ci
              if (co) payload.clockOut = co
              payload.mileage = editShiftMileage.trim() ? parseFloat(editShiftMileage) : null
              payload.notes = editShiftNotes.trim() || null
              await fetch(`/api/timesheet/shifts/${editingShift.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              })
              setEditingShift(null)
              await loadStaffAndShifts()
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingCar} onOpenChange={(v) => { if (!v) setEditingCar(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Car</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Label>Name</Label>
              <Input value={editingCar?.name || ''} onChange={e => setEditingCar(prev => ({ ...(prev || {}), name: e.target.value }))} />
            </div>
            <div>
              <Label>Rego</Label>
              <Input value={editingCar?.rego || ''} onChange={e => setEditingCar(prev => ({ ...(prev || {}), rego: e.target.value }))} />
            </div>
            <div>
              <Label>WOF Expiry</Label>
              <Input type="date" value={(() => { const v = editingCar?.wofExpiry; if (!v) return ''; const d = new Date(v as any); if (isNaN(d.getTime())) return String(v); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; })()} onChange={e => setEditingCar(prev => ({ ...(prev || {}), wofExpiry: e.target.value }))} />
            </div>
            <div>
              <Label>Rego Expiry</Label>
              <Input type="date" value={(() => { const v = editingCar?.regoExpiry; if (!v) return ''; const d = new Date(v as any); if (isNaN(d.getTime())) return String(v); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; })()} onChange={e => setEditingCar(prev => ({ ...(prev || {}), regoExpiry: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingCar(null)}>Cancel</Button>
            <Button onClick={async () => {
              if (!editingCar?.id) return
              await updateCar(editingCar.id, {
                name: editingCar.name,
                rego: editingCar.rego,
                wofExpiry: editingCar.wofExpiry || null,
                regoExpiry: editingCar.regoExpiry || null,
              })
              setEditingCar(null)
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


