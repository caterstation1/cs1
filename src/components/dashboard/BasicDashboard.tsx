'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useShiftLocationTracking } from '@/hooks/useShiftLocationTracking'
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes'
import { DeliveryNotesButton } from '@/components/realtime-orders/delivery-notes-modal'

interface Assignment {
  id: string
  date: string
  staff?: { firstName: string; lastName: string; email?: string } | null
  shiftType?: { name: string; startTime: string; endTime: string } | null
  startTime?: string | null
  endTime?: string | null
}

interface OrderLite {
  id: string
  orderNumber: number
  deliveryDateResolved?: string | null
  deliveryDate?: string | null
  leaveTime?: string | null
  deliveryTime?: string | null
  travelTime?: string | null
  driverId?: string | null
  isDispatched?: boolean
  shippingAddress?: any
  shippingLines?: Array<{ phone?: string }>
  customerFirstName: string
  customerLastName: string
  customerPhone?: string | null
  customerEmail?: string | null
  note?: string | null
  customerNote?: string | null
  internalNote?: string | null
  lineItems?: any
}

function todayLocalYYYYMMDD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDaysYYYYMMDD(isoDate: string, days: number) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function BasicDashboard() {
  const { data: session } = useSession()
  const userEmail = (session as any)?.session?.user?.email || (session as any)?.user?.email || ''
  const currentUserId = (session as any)?.session?.user?.id || (session as any)?.user?.id || ''

  // Clock in/out
  const [isClocking, setIsClocking] = useState(false)
  const [clockInDialogOpen, setClockInDialogOpen] = useState(false)
  const [shifts, setShifts] = useState<any[]>([])
  const [activeShift, setActiveShift] = useState<any | null>(null)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [editShiftDate, setEditShiftDate] = useState<string>('')
  const [editClockIn, setEditClockIn] = useState<string>('')
  const [editClockOut, setEditClockOut] = useState<string>('')
  const [editShiftMileage, setEditShiftMileage] = useState<string>('')
  const [editShiftNotes, setEditShiftNotes] = useState<string>('')
  const [myStaffId, setMyStaffId] = useState<string>('')
  const { stopTracking, refreshServerStatus } = useShiftLocationTracking()
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const loadShifts = useCallback(async () => {
    try {
      const rs = await fetch('/api/staff')
      if (!rs.ok) return
      const staff = await rs.json()
      const me = (staff || []).find((s: any) => s.email?.toLowerCase() === String(userEmail).toLowerCase())
      if (!me) return
      setMyStaffId(me.id)
      const r = await fetch(`/api/timesheet?staffId=${encodeURIComponent(me.id)}`)
      if (!r.ok) return
      const all = await r.json()
      const sorted = all.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setShifts(sorted)
      setActiveShift(sorted.find((s: any) => !s.clockOut && s.status === 'active') || null)
    } catch {}
  }, [userEmail])
  useEffect(() => { loadShifts() }, [loadShifts])
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
      await loadShifts()
    } finally {
      setIsClocking(false)
    }
  }, [loadShifts, refreshServerStatus])
  const clockOut = useCallback(async () => {
    try {
      setIsClocking(true)
      await fetch('/api/timesheet/clock-out', { method: 'POST' })
      await stopTracking(true, 'clock_out')
      await loadShifts()
    } finally {
      setIsClocking(false)
    }
  }, [loadShifts, stopTracking])

  // My roster next 7 days
  const [assignments, setAssignments] = useState<Assignment[]>([])
  useEffect(() => {
    const run = async () => {
      const start = todayLocalYYYYMMDD()
      const end = addDaysYYYYMMDD(start, 7)
      const res = await fetch(`/api/roster/assignments?startDate=${start}&endDate=${end}`)
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data) ? data : Array.isArray(data.assignments) ? data.assignments : []
      setAssignments(list)
    }
    run()
  }, [])
  const myAssignments = useMemo(() => {
    return assignments.filter(a => (a as any)?.staff?.email === userEmail).slice(0, 30)
  }, [assignments, userEmail])

  // Daily summary (today and tomorrow)
  const [ordersToday, setOrdersToday] = useState<OrderLite[]>([])
  const [ordersTomorrow, setOrdersTomorrow] = useState<OrderLite[]>([])
  const [myDeliveriesToday, setMyDeliveriesToday] = useState<OrderLite[]>([])
  const { notesByOrderId: deliveryNotesByOrderId, updateOrderNotes: updateDeliveryNotes } = useDeliveryNotes(myDeliveriesToday)
  useEffect(() => {
    const run = async () => {
      const today = todayLocalYYYYMMDD()
      const tomorrow = addDaysYYYYMMDD(today, 1)
      const [r1, r2] = await Promise.all([
        fetch(`/api/orders?deliveryDateResolved=${today}&limit=200`),
        fetch(`/api/orders?deliveryDateResolved=${tomorrow}&limit=200`),
      ])
      const byDeliveryTime = (a: OrderLite, b: OrderLite) =>
        String(a.deliveryTime || '99:99').localeCompare(String(b.deliveryTime || '99:99'))
      if (r1.ok) {
        const d1 = await r1.json()
        const todayOrders = (Array.isArray(d1.orders) ? d1.orders : []).sort(byDeliveryTime)
        setOrdersToday(todayOrders)
        const deliveries = todayOrders.filter((o: any) => {
          if (myStaffId && o?.driverId) return String(o.driverId) === String(myStaffId)
          if (currentUserId && o?.driverId) return String(o.driverId) === String(currentUserId)
          return false
        })
        setMyDeliveriesToday(deliveries)
      }
      if (r2.ok) {
        const d2 = await r2.json()
        setOrdersTomorrow((Array.isArray(d2.orders) ? d2.orders : []).sort(byDeliveryTime))
      }
    }
    run()
  }, [myStaffId, currentUserId])

  const getOrderPhone = (order: OrderLite) =>
    order.customerPhone || order.shippingLines?.find((s) => !!s.phone)?.phone || ''

  const getAddressObj = (order: OrderLite) =>
    typeof order.shippingAddress === 'string'
      ? (() => {
          try {
            return JSON.parse(order.shippingAddress)
          } catch {
            return {}
          }
        })()
      : (order.shippingAddress || {})

  const getOrderCompany = (order: OrderLite) => {
    const addrObj = getAddressObj(order)
    return (addrObj?.company || '').toString().trim()
  }

  const getOrderAddress = (order: OrderLite) => {
    const addrObj = getAddressObj(order)
    const line1 = (addrObj?.address1 || '').toString().trim()
    const line2 = (addrObj?.address2 || '').toString().trim()
    const line3 = (addrObj?.address3 || '').toString().trim()
    const city = (addrObj?.city || '').toString().trim()
    return [line1, line2, line3, city].filter(Boolean).join(', ')
  }

  const getAddressForMaps = (order: OrderLite) => {
    const addrObj = getAddressObj(order)
    const parts = [
      (addrObj?.address1 || '').toString().trim(),
      (addrObj?.address2 || '').toString().trim(),
      (addrObj?.address3 || '').toString().trim(),
      (addrObj?.city || '').toString().trim(),
      (addrObj?.province || '').toString().trim(),
      (addrObj?.zip || '').toString().trim(),
    ].filter(Boolean)
    return parts.join(', ')
  }

  const getCompactOrderItems = (order: OrderLite) => {
    let base: any[] = []
    if (Array.isArray(order.lineItems)) {
      base = order.lineItems
    } else if (typeof order.lineItems === 'string' && order.lineItems) {
      try {
        base = JSON.parse(order.lineItems)
      } catch {
        base = []
      }
    }

    return base.map((it: any, idx: number) => ({
      key: `${it.variant_id || it.variantId || it.id || idx}-${idx}`,
      qty: Number(it.quantity || 1),
      name: it.title || it.name || 'Item',
      hasSW: ((it.variant_title || it.variantTitle || '').toLowerCase().includes('yes serveware')),
    }))
  }

  const renderSummaryRow = (o: OrderLite) => {
    const items = getCompactOrderItems(o)
    return (
      <div key={o.id} className="mobile-list-row text-sm">
        <div className="font-semibold text-slate-900">
          {o.deliveryTime || '—'} • {getOrderCompany(o) || `${o.customerFirstName || ''} ${o.customerLastName || ''}`.trim() || 'No company'}
          <span className="ml-1.5 text-xs font-medium text-slate-500">#{o.orderNumber}</span>
        </div>
        {items.length > 0 && (
          <div className="mobile-subtext">
            {items.map(it => `${it.qty}x ${it.name}`).join(', ')}
          </div>
        )}
        <div className="mobile-subtext">{getOrderAddress(o) || 'No address'}</div>
      </div>
    )
  }

  const getItemCount = (order: OrderLite) => {
    if (Array.isArray(order.lineItems)) return order.lineItems.reduce((sum, item: any) => sum + Number(item.quantity || 0), 0)
    if (typeof order.lineItems === 'string') {
      try {
        const parsed = JSON.parse(order.lineItems)
        if (Array.isArray(parsed)) return parsed.reduce((sum, item: any) => sum + Number(item.quantity || 0), 0)
      } catch {}
    }
    return 0
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
      {/* 1) Clock In/Out */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Clock In / Out</CardTitle>
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
                <button className="min-h-9 self-start rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm sm:self-auto" onClick={() => {
                  setEditingShift(s)
                  const d = new Date(s.date); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0')
                  setEditShiftDate(`${y}-${m}-${day}`)
                  const toTime = (dt?: string) => dt ? (()=>{ const t=new Date(dt); return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` })() : ''
                  setEditClockIn(toTime(s.clockIn))
                  setEditClockOut(toTime(s.clockOut))
                  setEditShiftMileage(typeof s.mileage === 'number' ? String(s.mileage) : '')
                  setEditShiftNotes(s.notes || '')
                }}>Edit</button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Dialog open={clockInDialogOpen} onOpenChange={setClockInDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Clock In</DialogTitle>
            <DialogDescription>About delivery run location sharing</DialogDescription>
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
          <div className="flex justify-end gap-2">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* 2) My Roster (next 7 days) */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>My Roster (next 7 days)</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[420px] space-y-2 overflow-auto">
          {myAssignments.length === 0 ? (
            <div className="mobile-empty">No rostered shifts</div>
          ) : (
            myAssignments.map(a => (
              <div key={a.id} className="mobile-list-row text-sm">
                <div className="font-semibold text-slate-900">{new Date(a.date).toLocaleDateString('en-GB')}</div>
                <div className="mobile-subtext">
                  {(a.shiftType?.name || 'Shift')} • {a.startTime || a.shiftType?.startTime || '—'} - {a.endTime || a.shiftType?.endTime || '—'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl">
            <div className="text-lg font-semibold">Edit Shift</div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input type="date" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900" value={editShiftDate} onChange={e=>setEditShiftDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Clock In</label>
                <input type="time" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900" value={editClockIn} onChange={e=>setEditClockIn(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Clock Out</label>
                <input type="time" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900" value={editClockOut} onChange={e=>setEditClockOut(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Mileage (km)</label>
                <input type="number" min="0" step="0.1" placeholder="0" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900" value={editShiftMileage} onChange={e=>setEditShiftMileage(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea rows={3} placeholder="Add notes about this shift..." className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900" value={editShiftNotes} onChange={e=>setEditShiftNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50" onClick={()=>setEditingShift(null)}>Cancel</button>
              <button className="min-h-10 rounded-md border border-blue-600 bg-blue-600 px-3 py-1 text-white hover:bg-blue-700" onClick={async ()=>{
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
                await loadShifts()
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* 3) Daily Summary */}
      <Card className="dashboard-card xl:col-span-2">
        <CardHeader>
          <CardTitle>My Deliveries Today</CardTitle>
        </CardHeader>
        <CardContent>
          {myDeliveriesToday.length === 0 ? (
            <div className="mobile-empty">No deliveries assigned to you today.</div>
          ) : (
            <div className="space-y-2">
              {myDeliveriesToday.map(o => (
                <div key={o.id} className="mobile-list-row">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{o.leaveTime || o.deliveryTime || '--:--'}</span>
                      <span className="truncate text-xs font-medium text-slate-600">#{o.orderNumber}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      o.isDispatched ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {o.isDispatched ? 'Dispatched' : 'Pending'}
                    </span>
                  </div>

                  <div className="mt-2">
                    <p className="truncate text-base font-semibold leading-tight text-slate-900">
                      {`${o.customerFirstName || ''} ${o.customerLastName || ''}`.trim() || 'Unknown customer'}
                      {getOrderCompany(o) ? ` - ${getOrderCompany(o)}` : ''}
                    </p>
                    <p className="truncate text-sm text-slate-600">{getOrderPhone(o) || 'No phone'}</p>
                    <div className="flex min-w-0 items-center">
                      <p className="truncate text-sm text-slate-600">{getOrderAddress(o) || 'No address'}</p>
                      <DeliveryNotesButton
                        orderId={o.id}
                        shippingAddress={o.shippingAddress}
                        customerEmail={o.customerEmail}
                        addressLabel={getOrderAddress(o)}
                        notes={deliveryNotesByOrderId[o.id]}
                        onNotesChanged={updateDeliveryNotes}
                        className="ml-1.5"
                      />
                    </div>
                    {o.note ? <p className="mt-1 text-sm text-slate-700">{o.note}</p> : null}
                    {o.customerNote ? (
                      <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Customer note</div>
                        <p className="whitespace-pre-wrap text-sm text-amber-900">{o.customerNote}</p>
                      </div>
                    ) : null}
                    {o.internalNote ? (
                      <div className="mt-1.5 rounded-md border border-blue-200 bg-blue-50 p-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Internal note</div>
                        <p className="whitespace-pre-wrap text-sm text-blue-800">{o.internalNote}</p>
                      </div>
                    ) : null}
                    {(deliveryNotesByOrderId[o.id] || []).length > 0 ? (
                      <div className="mt-1.5 rounded-md border border-violet-200 bg-violet-50 p-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Delivery notes</div>
                        {(deliveryNotesByOrderId[o.id] || []).map(n => (
                          <p key={n.id} className="whitespace-pre-wrap text-sm text-violet-900">{n.note}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {getCompactOrderItems(o).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {getCompactOrderItems(o).map((it) => (
                        <div key={it.key} className="flex items-center justify-between text-sm text-slate-800">
                          <div className="flex min-w-0 items-center">
                            <span className="w-7 flex-shrink-0 text-[10px] font-black text-red-600">{it.hasSW ? 'SW' : ''}</span>
                            <span className="truncate">{it.name}</span>
                          </div>
                          <span className="ml-2 font-medium text-slate-600">x{it.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-slate-600">
                      {getItemCount(o)} items {o.travelTime ? `• ${o.travelTime} min` : ''}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                        onClick={() => {
                          const phone = getOrderPhone(o)
                          if (!phone) {
                            alert('No phone number available')
                            return
                          }
                          const shouldCall = window.confirm(`Do you want to call ${phone}?`)
                          if (!shouldCall) return
                          window.location.href = `tel:${phone}`
                        }}
                      >
                        Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                        onClick={() => {
                          const phone = getOrderPhone(o)
                          if (!phone) {
                            alert('No phone number available')
                            return
                          }
                          window.location.href = `sms:${phone}`
                        }}
                      >
                        Txt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                        onClick={() => {
                          const addr = getAddressForMaps(o)
                          if (!addr) {
                            alert('No address available')
                            return
                          }
                          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
                          window.open(url, '_blank', 'noopener,noreferrer')
                        }}
                      >
                        Map
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4) Daily Summary */}
      <Card className="dashboard-card xl:col-span-2">
        <CardHeader>
          <CardTitle>Daily Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 font-semibold text-slate-900">Today</div>
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {ordersToday.map(renderSummaryRow)}
            </div>
          </div>
          <div>
            <div className="mb-2 font-semibold text-slate-900">Tomorrow</div>
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {ordersTomorrow.map(renderSummaryRow)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


