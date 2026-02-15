"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Users, TrendingUp } from 'lucide-react'
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils'
import StaffDetailSheet from './StaffDetailSheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type WeeklyResponse = {
  weekStart: string
  days: string[]
  staff: Array<{
    staffId: string
    name: string
    isActiveNow: boolean
    byDay: Record<string, {
      shifts: Array<{ id: string; clockIn: string; clockOut: string | null; totalHours: number | null; mileage: number | null; notes: string | null; reimbursementsTotal: number }>
      totals: { hours: number; mileage: number; reimbursed: number; notesCount: number }
    }>
    totals: { hours: number; mileage: number; reimbursed: number; notesCount: number }
  }>
  overallTotals: { hours: number; mileage: number; reimbursed: number; notesCount: number }
}

export default function AdminTimesheetsTab() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [active, setActive] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [weekStart, setWeekStart] = useState<string>(() => {
    const today = getTodayLocal()
    const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
    return formatLocalDate(mon)
  })
  const [weekly, setWeekly] = useState<WeeklyResponse | null>(null)
  const [openStaff, setOpenStaff] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<{ staffId: string; date: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ weekStart })
      if (debouncedQ) params.set('q', debouncedQ)
      const [weeklyRes, activeRes] = await Promise.all([
        fetch(`/api/timesheet/admin/weekly?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/timesheet/active', { cache: 'no-store' }),
      ])
      if (weeklyRes.ok) setWeekly(await weeklyRes.json())
      if (activeRes.ok) setActive(await activeRes.json())
    } finally {
      setLoading(false)
    }
  }, [weekStart, debouncedQ])

  useEffect(() => { fetchAll() }, [fetchAll])

  const kpis = useMemo(() => {
    const o = weekly?.overallTotals || { hours: 0, mileage: 0, reimbursed: 0, notesCount: 0 }
    const hours = o.hours || 0
    const mileage = o.mileage || 0
    const reimb = o.reimbursed || 0
    const shifts = 0
    return { hours, shifts, mileage, reimb }
  }, [weekly])

  const exportCsv = () => {
    const header = ['Staff', ...(weekly?.days || []), 'Hours', 'Mileage', 'Reimbursed', 'Notes', 'Active']
    const body = (weekly?.staff || []).map((r) => [
      r.name,
      ...(weekly?.days || []).map((d) => (r.byDay?.[d]?.totals?.hours ?? 0)),
      r.totals.hours,
      r.totals.mileage,
      r.totals.reimbursed,
      r.totals.notesCount,
      r.isActiveNow ? 'yes' : 'no'
    ])
    const csv = [header, ...body].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheets_week_${weekStart}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const weekLabel = useMemo(() => {
    if (!weekly?.days) return ''
    const first = weekly.days[0]
    const last = weekly.days[weekly.days.length - 1]
    return `${first} → ${last}`
  }, [weekly])

  const goThisWeek = () => {
    const today = getTodayLocal()
    const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
    setWeekStart(formatLocalDate(mon))
  }
  const goLastWeek = () => {
    const today = getTodayLocal()
    const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 7)
    setWeekStart(formatLocalDate(mon))
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="p-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <Label htmlFor="week" className="text-sm">Week Start</Label>
            <Input id="week" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            <div className="text-sm text-gray-600">{weekLabel}</div>
            <Button size="sm" onClick={goThisWeek}>This Week</Button>
            <Button size="sm" onClick={goLastWeek}>Last Week</Button>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Search staff…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
            <Button onClick={fetchAll} className="bg-blue-600 hover:bg-blue-700">Apply</Button>
            <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Currently Clocked In</CardTitle></CardHeader>
        <CardContent className="p-4">
          {active.length === 0 ? (
            <div className="text-sm text-gray-600">No one is currently clocked in.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {active.map((s: any) => (
                <div key={s.id} className="px-3 py-2 rounded border bg-green-50 text-green-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="font-medium">{s.staff?.firstName} {s.staff?.lastName}</span>
                  <span className="text-xs text-green-700">since {new Date(s.clockIn).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-sm text-gray-600">Total Hours</div><div className="text-2xl font-semibold">{kpis.hours.toFixed(2)}h</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-gray-600">Total Shifts</div><div className="text-2xl font-semibold">{kpis.shifts}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-gray-600">Total Mileage</div><div className="text-2xl font-semibold">{kpis.mileage.toFixed(0)}km</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-gray-600">Total Reimbursed</div><div className="text-2xl font-semibold">${kpis.reimb.toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Weekly Grid</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Staff</TableHead>
                  {(weekly?.days || []).map((d) => (
                    <TableHead key={d} className="text-center min-w-[140px]">{new Date(d).toLocaleDateString('en-NZ', { weekday: 'short' })}</TableHead>
                  ))}
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Mileage</TableHead>
                  <TableHead className="text-right">Reimbursed</TableHead>
                  <TableHead className="text-right">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(weekly?.staff || []).map((s) => (
                  <TableRow key={s.staffId}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {s.isActiveNow && <span className="w-2 h-2 rounded-full bg-green-500" />}
                      {s.name}
                    </TableCell>
                    {(weekly?.days || []).map((d) => {
                      const cell = (s as any).byDay?.[d]
                      if (!cell) {
                        return <TableCell key={d} className="text-center text-gray-400">—</TableCell>
                      }
                      const firstShift = cell.shifts?.[0]
                      const active = cell.shifts?.some((sh: any) => !sh.clockOut)
                      const timeLabel = firstShift?.clockIn ? new Date(firstShift.clockIn).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }) : ''
                      const endLabel = firstShift?.clockOut ? new Date(firstShift.clockOut).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }) : ''
                      const hasHours = (cell.totals.hours || 0) > 0
                      const colorClasses = active
                        ? 'bg-green-50 hover:bg-green-100 border-green-200'
                        : hasHours
                          ? 'bg-blue-50 hover:bg-blue-100 border-blue-200'
                          : 'hover:bg-gray-50 border-transparent hover:border-gray-200'
                      return (
                        <TableCell key={d} className="align-top">
                          <button
                            type="button"
                            onClick={() => setOpenDay({ staffId: s.staffId, date: d })}
                            className={`w-full text-left p-2 rounded border transition ${colorClasses}`}
                          >
                            <div className="text-sm font-medium">
                              {active ? `Active since ${timeLabel}` : (firstShift ? `${timeLabel}${endLabel ? ` - ${endLabel}` : ''}` : 'No shift')}
                            </div>
                            <div className="text-xs text-gray-600">{(cell.totals.hours || 0).toFixed(2)}h</div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {cell.totals.mileage > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">{cell.totals.mileage.toFixed(0)}km</span>}
                              {cell.totals.reimbursed > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">${cell.totals.reimbursed.toFixed(2)}</span>}
                              {cell.totals.notesCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">notes {cell.totals.notesCount}</span>}
                            </div>
                          </button>
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-right font-semibold">{s.totals.hours.toFixed(2)}h</TableCell>
                    <TableCell className="text-right font-semibold">{s.totals.mileage.toFixed(0)}km</TableCell>
                    <TableCell className="text-right font-semibold">${s.totals.reimbursed.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{s.totals.notesCount}</TableCell>
                  </TableRow>
                ))}
                {weekly?.staff?.length ? (
                  <TableRow>
                    <TableCell className="font-semibold">All Staff</TableCell>
                    {(weekly?.days || []).map((d) => <TableCell key={d} />)}
                    <TableCell className="text-right font-semibold">{weekly?.overallTotals?.hours?.toFixed(2)}h</TableCell>
                    <TableCell className="text-right font-semibold">{weekly?.overallTotals?.mileage?.toFixed(0)}km</TableCell>
                    <TableCell className="text-right font-semibold">${weekly?.overallTotals?.reimbursed?.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{weekly?.overallTotals?.notesCount}</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <StaffDetailSheet
        staffId={openStaff}
        open={!!openStaff}
        onOpenChange={(v) => !v && setOpenStaff(null)}
        startDate={weekly?.days?.[0] || weekStart}
        endDate={weekly?.days?.[6] || weekStart}
      />

      <StaffDaySheet openState={openDay} onClose={() => setOpenDay(null)} />
    </div>
  )
}

function StaffDaySheet({ openState, onClose }: { openState: { staffId: string; date: string } | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [edits, setEdits] = useState<Record<string, { clockIn: string; clockOut: string; mileage: string; notes: string }>>({})
  const [newReimb, setNewReimb] = useState<Record<string, { amount: string; description: string }>>({})

  const load = useCallback(async () => {
    if (!openState) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ date: openState.date, staffId: openState.staffId })
      const res = await fetch(`/api/timesheet/shifts?${params.toString()}`, { cache: 'no-store' })
      const data = res.ok ? await res.json() : []
      setRows(data)
      const initEdits: Record<string, any> = {}
      const initReimb: Record<string, any> = {}
      for (const s of data) {
        initEdits[s.id] = {
          clockIn: s.clockIn ? new Date(s.clockIn).toISOString().slice(0, 16) : '',
          clockOut: s.clockOut ? new Date(s.clockOut).toISOString().slice(0, 16) : '',
          mileage: s.mileage?.toString() || '',
          notes: s.notes || ''
        }
        initReimb[s.id] = { amount: '', description: '' }
      }
      setEdits(initEdits)
      setNewReimb(initReimb)
    } finally {
      setLoading(false)
    }
  }, [openState])

  useEffect(() => { load() }, [load])

  const saveShift = async (id: string) => {
    const e = edits[id]
    if (!e) return
    await fetch(`/api/timesheet/shifts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clockIn: e.clockIn || null,
        clockOut: e.clockOut || null,
        mileage: e.mileage ? parseFloat(e.mileage) : null,
        notes: e.notes
      })
    })
    await load()
  }
  const addReimb = async (id: string) => {
    const r = newReimb[id]
    if (!r?.amount || !r?.description) return
    await fetch(`/api/timesheet/shifts/${id}/reimbursements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(r.amount), description: r.description })
    })
    await load()
  }

  return (
    <Dialog modal open={!!openState} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shifts — {openState?.date}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No shifts this day.</div>
        ) : (
          <div className="space-y-4">
            {rows.map((s) => (
              <div key={s.id} className="p-3 border rounded">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Clock In</Label>
                    <Input type="datetime-local" value={edits[s.id]?.clockIn || ''} onChange={(e) => setEdits((p) => ({ ...p, [s.id]: { ...p[s.id], clockIn: e.target.value } }))} />
                  </div>
                  <div>
                    <Label className="text-sm">Clock Out</Label>
                    <Input type="datetime-local" value={edits[s.id]?.clockOut || ''} onChange={(e) => setEdits((p) => ({ ...p, [s.id]: { ...p[s.id], clockOut: e.target.value } }))} />
                  </div>
                  <div>
                    <Label className="text-sm">Mileage (km)</Label>
                    <Input type="number" value={edits[s.id]?.mileage || ''} onChange={(e) => setEdits((p) => ({ ...p, [s.id]: { ...p[s.id], mileage: e.target.value } }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm">Notes</Label>
                    <Textarea rows={3} value={edits[s.id]?.notes || ''} onChange={(e) => setEdits((p) => ({ ...p, [s.id]: { ...p[s.id], notes: e.target.value } }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="outline" onClick={() => saveShift(s.id)}>Save</Button>
                </div>
                <div className="mt-3 border-t pt-3">
                  <div className="text-sm font-medium mb-2">Reimbursements</div>
                  <div className="flex items-center gap-2 mb-2">
                    <Input type="number" step="0.01" placeholder="Amount" value={newReimb[s.id]?.amount || ''} onChange={(e) => setNewReimb((p) => ({ ...p, [s.id]: { ...p[s.id], amount: e.target.value } }))} />
                    <Input placeholder="Description" value={newReimb[s.id]?.description || ''} onChange={(e) => setNewReimb((p) => ({ ...p, [s.id]: { ...p[s.id], description: e.target.value } }))} />
                    <Button onClick={() => addReimb(s.id)}>Add</Button>
                  </div>
                  {Array.isArray(s.reimbursements) && s.reimbursements.length > 0 && (
                    <div className="text-xs text-gray-600">
                      Existing: ${s.reimbursements.reduce((a: number, r: any) => a + (r.amount || 0), 0).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

