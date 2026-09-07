"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { Activity, Calendar, Car, CheckCircle, Clock, DollarSign, Edit, Plus } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils'
import { Badge } from '@/components/ui/badge'
import { useShiftLocationTracking } from '@/hooks/useShiftLocationTracking'

type ShiftTask = {
  id: string
  title: string
  description?: string
  isCompleted: boolean
  completedAt?: string | null
}

type Reimbursement = {
  id: string
  amount: number
  description: string
  createdAt: string
}

type Shift = {
  id: string
  clockIn: string
  clockOut: string | null
  totalHours: number | null
  date: string
  mileage: number | null
  notes: string | null
  status: string
  trackingAllowed?: boolean
  trackingStartedAt?: string | null
  trackingStoppedAt?: string | null
  reimbursements: Reimbursement[]
  tasks: ShiftTask[]
}

export default function MyTimesheetTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)

  // Filters: Day / Range
  const [isRangeMode, setIsRangeMode] = useState(false)
  const [day, setDay] = useState<string>(() => formatLocalDate(getTodayLocal()))
  const [startDate, setStartDate] = useState<string>(() => formatLocalDate(getTodayLocal()))
  const [endDate, setEndDate] = useState<string>(() => formatLocalDate(getTodayLocal()))

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [reimbursementDialogOpen, setReimbursementDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [clockInDialogOpen, setClockInDialogOpen] = useState(false)
  const [addShiftDialogOpen, setAddShiftDialogOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [newReimbursement, setNewReimbursement] = useState({ amount: '', description: '' })
  const [newShift, setNewShift] = useState<{ date: string; clockIn: string; clockOut: string; mileage: string; notes: string }>({
    date: formatLocalDate(getTodayLocal()),
    clockIn: '',
    clockOut: '',
    mileage: '',
    notes: ''
  })
  const [editShift, setEditShift] = useState<{ clockIn: string; clockOut: string; mileage: string; notes: string }>({
    clockIn: '',
    clockOut: '',
    mileage: '',
    notes: ''
  })
  const { stopTracking, refreshServerStatus } = useShiftLocationTracking()

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (isRangeMode) {
        params.set('startDate', startDate)
        params.set('endDate', endDate)
      } else {
        params.set('date', day)
      }
      const response = await fetch(`/api/timesheet/shifts?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch shifts')
      const data = await response.json()
      setShifts(data)
      const active = data.find((s: Shift) => !s.clockOut)
      setCurrentShift(active || null)
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch shifts', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [isRangeMode, day, startDate, endDate, toast])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const handleClockIn = async () => {
    try {
      const fitForWork = window.confirm(
        'Are you feeling fit and well for work today?\n\nPress OK for Yes, Cancel for No.'
      )
      const res = await fetch('/api/timesheet/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fitForWork }),
      })
      if (!res.ok) throw new Error()
      // Clock-in does NOT start location tracking. Delivery-run location
      // sharing only activates when a dispatched order is assigned to this
      // driver (handled by the tracking provider's status sync).
      await refreshServerStatus().catch(() => null)
      await fetchShifts()
      toast({ title: 'Clocked in' })
    } catch {
      toast({ title: 'Failed to clock in', variant: 'destructive' })
    }
  }

  const handleClockOut = async () => {
    if (!currentShift) return
    const incompleteTasks = currentShift.tasks?.filter(t => !t.isCompleted) || []
    if (incompleteTasks.length > 0) {
      setSelectedShift(currentShift)
      setTaskDialogOpen(true)
      return
    }
    try {
      const res = await fetch('/api/timesheet/clock-out', { method: 'POST' })
      if (!res.ok) throw new Error()
      await stopTracking(true, 'clock_out')
      await fetchShifts()
      toast({ title: 'Clocked out' })
    } catch {
      toast({ title: 'Failed to clock out', variant: 'destructive' })
    }
  }

  const handleClockOutWithTasks = async (completedTaskIds: string[]) => {
    try {
      for (const id of completedTaskIds) {
        await fetch(`/api/timesheet/shifts/${selectedShift?.id}/tasks/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isCompleted: true, completedAt: new Date().toISOString() })
        })
      }
      const res = await fetch('/api/timesheet/clock-out', { method: 'POST' })
      if (!res.ok) throw new Error()
      await stopTracking(true, 'clock_out')
      setTaskDialogOpen(false)
      await fetchShifts()
      toast({ title: 'Clocked out' })
    } catch {
      toast({ title: 'Failed to clock out', variant: 'destructive' })
    }
  }

  const openEditDialog = (shift: Shift) => {
    setSelectedShift(shift)
    setEditShift({
      clockIn: new Date(shift.clockIn).toISOString().slice(0, 16),
      clockOut: shift.clockOut ? new Date(shift.clockOut).toISOString().slice(0, 16) : '',
      mileage: shift.mileage?.toString() || '',
      notes: shift.notes || ''
    })
    setEditDialogOpen(true)
  }

  const handleEditShift = async () => {
    if (!selectedShift) return
    try {
      const res = await fetch(`/api/timesheet/shifts/${selectedShift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockIn: editShift.clockIn,
          clockOut: editShift.clockOut || null,
          mileage: editShift.mileage ? parseFloat(editShift.mileage) : null,
          notes: editShift.notes
        })
      })
      if (!res.ok) throw new Error()
      setEditDialogOpen(false)
      await fetchShifts()
      toast({ title: 'Shift updated' })
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' })
    }
  }

  const openReimbursementDialog = (shift: Shift) => {
    setSelectedShift(shift)
    setNewReimbursement({ amount: '', description: '' })
    setReimbursementDialogOpen(true)
  }

  const handleCreateReimbursement = async () => {
    if (!selectedShift) return
    try {
      const res = await fetch(`/api/timesheet/shifts/${selectedShift.id}/reimbursements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(newReimbursement.amount), description: newReimbursement.description })
      })
      if (!res.ok) throw new Error()
      setReimbursementDialogOpen(false)
      await fetchShifts()
      toast({ title: 'Reimbursement added' })
    } catch {
      toast({ title: 'Failed to add reimbursement', variant: 'destructive' })
    }
  }

  const openAddShiftDialog = () => {
    const today = formatLocalDate(getTodayLocal())
    setNewShift({
      date: today,
      clockIn: `${today}T09:00`,
      clockOut: `${today}T17:00`,
      mileage: '',
      notes: ''
    })
    setAddShiftDialogOpen(true)
  }

  const handleCreateHistoricShift = async () => {
    if (!newShift.clockIn) {
      toast({ title: 'Clock in required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/timesheet/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newShift.date,
          clockIn: newShift.clockIn,
          clockOut: newShift.clockOut || null,
          mileage: newShift.mileage ? parseFloat(newShift.mileage) : null,
          notes: newShift.notes || null,
          status: newShift.clockOut ? 'completed' : 'active'
        })
      })
      if (!res.ok) throw new Error()
      setAddShiftDialogOpen(false)
      await fetchShifts()
      toast({ title: 'Historic shift added' })
    } catch {
      toast({ title: 'Failed to add shift', variant: 'destructive' })
    }
  }

  const totalHours = useMemo(
    () => shifts.reduce((a, s) => a + (typeof s.totalHours === 'number' ? s.totalHours : 0), 0),
    [shifts]
  )
  const totalMileage = useMemo(
    () => shifts.reduce((a, s) => a + (typeof s.mileage === 'number' ? s.mileage : 0), 0),
    [shifts]
  )
  const totalReimbursements = useMemo(
    () => shifts.reduce((a, s) => a + (s.reimbursements?.reduce((x, r) => x + (r.amount || 0), 0) || 0), 0),
    [shifts]
  )
  const completedShifts = useMemo(() => shifts.filter(s => s.clockOut).length, [shifts])
  const pastShifts = useMemo(() => shifts.filter(s => !!s.clockOut), [shifts])

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })
  const fmtDateLong = (dt: string) =>
    new Date(dt).toLocaleDateString('en-NZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Filter toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Mode</Label>
              <Button variant={isRangeMode ? 'outline' : 'default'} size="sm" onClick={() => setIsRangeMode(false)}>
                Day
              </Button>
              <Button variant={isRangeMode ? 'default' : 'outline'} size="sm" onClick={() => setIsRangeMode(true)}>
                Range
              </Button>
            </div>
            {!isRangeMode ? (
              <div className="flex items-center gap-2">
                <Label htmlFor="day" className="text-sm">Day</Label>
                <Input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
                <Button size="sm" onClick={() => { setDay(formatLocalDate(getTodayLocal())); fetchShifts() }}>Today</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="startDate" className="text-sm">Start</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="endDate" className="text-sm">End</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => {
                    const t = formatLocalDate(getTodayLocal())
                    setStartDate(t); setEndDate(t); fetchShifts()
                  }}>Today</Button>
                  <Button size="sm" onClick={() => {
                    const today = getTodayLocal()
                    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
                    setStartDate(formatLocalDate(startOfWeek))
                    setEndDate(formatLocalDate(today))
                    fetchShifts()
                  }}>This Week</Button>
                  <Button size="sm" onClick={() => {
                    const today = getTodayLocal()
                    const last7 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
                    setStartDate(formatLocalDate(last7))
                    setEndDate(formatLocalDate(today))
                    fetchShifts()
                  }}>Last 7 Days</Button>
                  <Button size="sm" onClick={() => {
                    const today = getTodayLocal()
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                    setStartDate(formatLocalDate(monthStart))
                    setEndDate(formatLocalDate(today))
                    fetchShifts()
                  }}>MTD</Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={openAddShiftDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add Shift
              </Button>
              <Button onClick={() => fetchShifts()} className="bg-blue-600 hover:bg-blue-700">Apply</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add historic shift dialog */}
      <Dialog open={addShiftDialogOpen} onOpenChange={setAddShiftDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Historic Shift</DialogTitle>
            <DialogDescription>Create a past shift entry for your timesheet.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="newShiftDate" className="text-sm font-medium">Shift Date</Label>
              <Input
                id="newShiftDate"
                type="date"
                value={newShift.date}
                onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newClockIn" className="text-sm font-medium">Clock In</Label>
                <Input
                  id="newClockIn"
                  type="datetime-local"
                  value={newShift.clockIn}
                  onChange={(e) => setNewShift({ ...newShift, clockIn: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="newClockOut" className="text-sm font-medium">Clock Out</Label>
                <Input
                  id="newClockOut"
                  type="datetime-local"
                  value={newShift.clockOut}
                  onChange={(e) => setNewShift({ ...newShift, clockOut: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="newShiftMileage" className="text-sm font-medium">Mileage (km)</Label>
              <Input
                id="newShiftMileage"
                type="number"
                placeholder="0"
                value={newShift.mileage}
                onChange={(e) => setNewShift({ ...newShift, mileage: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="newShiftNotes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="newShiftNotes"
                rows={3}
                placeholder="Optional notes..."
                value={newShift.notes}
                onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAddShiftDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateHistoricShift} className="min-w-[120px]">Add Shift</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-600" /><div><p className="text-sm text-muted-foreground">Total Hours</p><p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Car className="h-5 w-5 text-green-600" /><div><p className="text-sm text-muted-foreground">Mileage</p><p className="text-2xl font-bold">{totalMileage.toFixed(0)}km</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-purple-600" /><div><p className="text-sm text-muted-foreground">Reimbursements</p><p className="text-2xl font-bold">${totalReimbursements.toFixed(2)}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-orange-600" /><div><p className="text-sm text-muted-foreground">Completed Shifts</p><p className="text-2xl font-bold">{completedShifts}</p></div></div></CardContent></Card>
      </div>

      {/* Current status */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Current Status</CardTitle></CardHeader>
        <CardContent>
          {currentShift ? (
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="font-medium text-green-800">Currently Clocked In</p>
                  <p className="text-sm text-green-600">Started at {fmtTime(currentShift.clockIn)}</p>
                </div>
              </div>
              <Button onClick={handleClockOut} variant="destructive" className="bg-red-600 hover:bg-red-700">Clock Out</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-800">Not Clocked In</p>
                  <p className="text-sm text-gray-600">Click the button below to start your shift</p>
                </div>
              </div>
              <Button onClick={() => setClockInDialogOpen(true)} className="bg-green-600 hover:bg-green-700">Clock In</Button>
            </div>
          )}
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
                await handleClockIn()
              }}
            >
              Continue Clock In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shifts table */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Shift History</CardTitle></CardHeader>
        <CardContent>
          <div className="md:hidden space-y-3">
            {pastShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past shifts in this date range.</p>
            ) : (
              pastShifts.map((shift) => (
                <div key={shift.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{fmtDateLong(shift.date)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtTime(shift.clockIn)} - {shift.clockOut ? fmtTime(shift.clockOut) : 'Active'}
                      </p>
                    </div>
                    <Badge variant={shift.clockOut ? 'secondary' : 'default'}>
                      {shift.clockOut ? 'Completed' : 'Active'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-muted-foreground">Hours</span>
                      <p className="font-medium">{typeof shift.totalHours === 'number' ? `${shift.totalHours.toFixed(2)}h` : '-'}</p>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-muted-foreground">Mileage</span>
                      <p className="font-medium">{typeof shift.mileage === 'number' ? `${shift.mileage}km` : '-'}</p>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-muted-foreground">Tasks</span>
                      <p className="font-medium">
                        {shift.tasks?.length ? `${shift.tasks.filter(t => t.isCompleted).length}/${shift.tasks.length}` : '-'}
                      </p>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-muted-foreground">Reimbursements</span>
                      <p className="font-medium">
                        ${((shift.reimbursements || []).reduce((sum, r) => sum + (r.amount || 0), 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(shift)} className="flex-1">
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit Shift
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openReimbursementDialog(shift)} className="flex-1">
                      <DollarSign className="h-3.5 w-3.5 mr-1" />
                      Add Expense
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map(shift => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{fmtDateLong(shift.date)}</TableCell>
                    <TableCell>{fmtTime(shift.clockIn)}</TableCell>
                    <TableCell>{shift.clockOut ? fmtTime(shift.clockOut) : '-'}</TableCell>
                    <TableCell>
                      {typeof shift.totalHours === 'number' ? (
                        <Badge variant="secondary" className="font-mono">{shift.totalHours.toFixed(2)}h</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{typeof shift.mileage === 'number' ? `${shift.mileage}km` : '-'}</TableCell>
                    <TableCell>
                      {shift.tasks?.length ? (
                        <Badge variant="outline" className="text-xs">
                          {shift.tasks.filter(t => t.isCompleted).length}/{shift.tasks.length}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={shift.clockOut ? 'secondary' : 'default'}>
                        {shift.clockOut ? 'Completed' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(shift)} className="h-8 px-2">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openReimbursementDialog(shift)} className="h-8 px-2">
                          <DollarSign className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit Shift</DialogTitle>
            <DialogDescription>Update the shift details including clock times, mileage, and notes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clockIn" className="text-sm font-medium">Clock In</Label>
                <Input id="clockIn" type="datetime-local" value={editShift.clockIn} onChange={(e) => setEditShift({ ...editShift, clockIn: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="clockOut" className="text-sm font-medium">Clock Out</Label>
                <Input id="clockOut" type="datetime-local" value={editShift.clockOut} onChange={(e) => setEditShift({ ...editShift, clockOut: e.target.value })} className="mt-2" />
              </div>
            </div>
            <div>
              <Label htmlFor="mileage" className="text-sm font-medium">Mileage (km)</Label>
              <Input id="mileage" type="number" placeholder="0" value={editShift.mileage} onChange={(e) => setEditShift({ ...editShift, mileage: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea id="notes" placeholder="Add notes about this shift..." value={editShift.notes} onChange={(e) => setEditShift({ ...editShift, notes: e.target.value })} className="mt-2" rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditShift} className="min-w-[120px]">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reimbursement dialog */}
      <Dialog open={reimbursementDialogOpen} onOpenChange={setReimbursementDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Add Reimbursement</DialogTitle>
            <DialogDescription>Add an expense reimbursement for this shift.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="amount" className="text-sm font-medium">Amount ($)</Label>
              <Input id="amount" type="number" step="0.01" placeholder="0.00" value={newReimbursement.amount} onChange={(e) => setNewReimbursement({ ...newReimbursement, amount: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea id="description" placeholder="What was this expense for?" value={newReimbursement.description} onChange={(e) => setNewReimbursement({ ...newReimbursement, description: e.target.value })} className="mt-2" rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setReimbursementDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateReimbursement} className="min-w-[120px]">Add Reimbursement</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task completion dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Complete Tasks</DialogTitle>
            <DialogDescription>Please mark which tasks you have completed before clocking out.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedShift?.tasks?.filter(t => !t.isCompleted).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <input type="checkbox" id={`task-${task.id}`} className="h-4 w-4 text-blue-600 rounded" onChange={(e) => { if (e.target.checked) { /* local only */ } }} />
                <div className="flex-1">
                  <Label htmlFor={`task-${task.id}`} className="font-medium cursor-pointer">{task.title}</Label>
                  {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                const completed = selectedShift?.tasks?.filter(t => !t.isCompleted).map(t => t.id) || []
                handleClockOutWithTasks(completed)
              }} className="min-w-[120px]">Clock Out</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

