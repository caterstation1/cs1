'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
  deliveryTime?: string | null
  shippingAddress?: any
  customerFirstName: string
  customerLastName: string
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

  // Clock in/out
  const [isClocking, setIsClocking] = useState(false)
  const [shifts, setShifts] = useState<any[]>([])
  const [activeShift, setActiveShift] = useState<any | null>(null)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [editShiftDate, setEditShiftDate] = useState<string>('')
  const [editClockIn, setEditClockIn] = useState<string>('')
  const [editClockOut, setEditClockOut] = useState<string>('')
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
      await fetch('/api/timesheet/clock-in', { method: 'POST' })
      await loadShifts()
    } finally {
      setIsClocking(false)
    }
  }, [])
  const clockOut = useCallback(async () => {
    try {
      setIsClocking(true)
      await fetch('/api/timesheet/clock-out', { method: 'POST' })
      await loadShifts()
    } finally {
      setIsClocking(false)
    }
  }, [])

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
  useEffect(() => {
    const run = async () => {
      const today = todayLocalYYYYMMDD()
      const tomorrow = addDaysYYYYMMDD(today, 1)
      const [r1, r2] = await Promise.all([
        fetch(`/api/orders?deliveryDateResolved=${today}&limit=200`),
        fetch(`/api/orders?deliveryDateResolved=${tomorrow}&limit=200`),
      ])
      if (r1.ok) {
        const d1 = await r1.json()
        setOrdersToday(Array.isArray(d1.orders) ? d1.orders : [])
      }
      if (r2.ok) {
        const d2 = await r2.json()
        setOrdersTomorrow(Array.isArray(d2.orders) ? d2.orders : [])
      }
    }
    run()
  }, [])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* 1) Clock In/Out */}
      <Card>
        <CardHeader>
          <CardTitle>Clock In / Out</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 items-center">
            <Button
              onClick={clockIn}
              disabled={isClocking || !!activeShift}
              className={activeShift ? 'bg-green-600 hover:bg-green-600 cursor-default' : undefined}
            >
              {activeShift ? 'Clocked In' : 'Clock In'}
            </Button>
            <Button
              onClick={clockOut}
              disabled={isClocking || !activeShift}
              className={!activeShift ? 'bg-slate-300 text-slate-700 hover:bg-slate-300 cursor-default' : 'bg-red-600 hover:bg-red-700'}
            >
              Clock Out
            </Button>
            {activeShift && (
              <div className="text-sm text-slate-700">
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
          <div className="border rounded p-2 max-h-[180px] overflow-auto">
            {(shifts || []).filter(s => {
              const d = new Date(s.date)
              const days = (Date.now() - d.getTime()) / 86400000
              return days <= 14
            }).map(s => (
              <div key={s.id} className="text-sm flex justify-between items-center py-1 gap-2">
                <div className="min-w-[160px]">{new Date(s.date).toLocaleDateString('en-GB')} {s.status === 'active' ? '(active)' : ''}</div>
                <div className="flex-1">
                  {s.clockIn ? new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} - {s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  {typeof s.totalHours === 'number' ? ` • ${s.totalHours.toFixed(2)} hrs` : ''}
                </div>
                <button className="px-2 py-1 text-xs border rounded" onClick={() => {
                  setEditingShift(s)
                  const d = new Date(s.date); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0')
                  setEditShiftDate(`${y}-${m}-${day}`)
                  const toTime = (dt?: string) => dt ? (()=>{ const t=new Date(dt); return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` })() : ''
                  setEditClockIn(toTime(s.clockIn))
                  setEditClockOut(toTime(s.clockOut))
                }}>Edit</button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2) My Roster (next 7 days) */}
      <Card>
        <CardHeader>
          <CardTitle>My Roster (next 7 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[420px] overflow-auto">
          {myAssignments.length === 0 ? (
            <div className="text-sm text-slate-500">No rostered shifts</div>
          ) : (
            myAssignments.map(a => (
              <div key={a.id} className="text-sm">
                <div className="font-medium">{new Date(a.date).toLocaleDateString('en-GB')}</div>
                <div className="text-slate-600">
                  {(a.shiftType?.name || 'Shift')} • {a.startTime || a.shiftType?.startTime || '—'} - {a.endTime || a.shiftType?.endTime || '—'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {editingShift && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded p-4 w-full max-w-md space-y-3">
            <div className="text-lg font-semibold">Edit Shift</div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-sm">Date</label>
                <input type="date" className="w-full border rounded px-2 py-1" value={editShiftDate} onChange={e=>setEditShiftDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Clock In</label>
                <input type="time" className="w-full border rounded px-2 py-1" value={editClockIn} onChange={e=>setEditClockIn(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Clock Out</label>
                <input type="time" className="w-full border rounded px-2 py-1" value={editClockOut} onChange={e=>setEditClockOut(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={()=>setEditingShift(null)}>Cancel</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={async ()=>{
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
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Daily Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="font-semibold mb-2">Today</div>
            <div className="space-y-2 max-h-[280px] overflow-auto">
              {ordersToday.map(o => (
                <div key={o.id} className="text-sm">
                  <div className="font-medium">#{o.orderNumber} • {o.deliveryTime || '—'}</div>
                  <div className="text-slate-600">{o.shippingAddress?.company || ''}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Tomorrow</div>
            <div className="space-y-2 max-h-[280px] overflow-auto">
              {ordersTomorrow.map(o => (
                <div key={o.id} className="text-sm">
                  <div className="font-medium">#{o.orderNumber} • {o.deliveryTime || '—'}</div>
                  <div className="text-slate-600">{o.shippingAddress?.company || ''}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


