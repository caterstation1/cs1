"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Clock, Plus, Edit, Car, DollarSign } from 'lucide-react'

interface Shift {
  id: string
  clockIn: Date
  clockOut: Date | null
  totalHours: number | null
  date: Date
  mileage: number | null
  notes: string | null
  status: string
  reimbursements: Reimbursement[]
}

interface Reimbursement {
  id: string
  amount: number
  description: string
  createdAt: Date
}

export default function TimesheetPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [reimbursementDialogOpen, setReimbursementDialogOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [newReimbursement, setNewReimbursement] = useState({ amount: '', description: '' })
  const [editShift, setEditShift] = useState<{ clockIn: string; clockOut: string; mileage: string; notes: string }>({
    clockIn: '',
    clockOut: '',
    mileage: '',
    notes: ''
  })
  const { toast } = useToast()

  // Fetch shifts
  const fetchShifts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/timesheet/shifts')
      if (!response.ok) throw new Error('Failed to fetch shifts')
      const data = await response.json()
      setShifts(data)
      
      // Find current active shift
      const active = data.find((shift: Shift) => !shift.clockOut)
      setCurrentShift(active || null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch shifts",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShifts()
  }, [])

  // Clock in
  const handleClockIn = async () => {
    try {
      const response = await fetch('/api/timesheet/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) throw new Error('Failed to clock in')

      await fetchShifts()
      toast({
        title: "Success",
        description: "Clocked in successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clock in",
        variant: "destructive",
      })
    }
  }

  // Clock out
  const handleClockOut = async () => {
    try {
      const response = await fetch('/api/timesheet/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) throw new Error('Failed to clock out')

      await fetchShifts()
      toast({
        title: "Success",
        description: "Clocked out successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clock out",
        variant: "destructive",
      })
    }
  }

  // Handle shift edit
  const handleEditShift = async () => {
    if (!selectedShift) return

    try {
      const response = await fetch(`/api/timesheet/shifts/${selectedShift.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clockIn: editShift.clockIn,
          clockOut: editShift.clockOut,
          mileage: parseFloat(editShift.mileage) || null,
          notes: editShift.notes
        })
      })

      if (!response.ok) throw new Error('Failed to update shift')

      await fetchShifts()
      setEditDialogOpen(false)
      setSelectedShift(null)
      toast({
        title: "Success",
        description: "Shift updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive",
      })
    }
  }

  // Handle reimbursement creation
  const handleCreateReimbursement = async () => {
    if (!selectedShift || !newReimbursement.amount || !newReimbursement.description) return

    try {
      const response = await fetch(`/api/timesheet/shifts/${selectedShift.id}/reimbursements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(newReimbursement.amount),
          description: newReimbursement.description
        })
      })

      if (!response.ok) throw new Error('Failed to create reimbursement')

      await fetchShifts()
      setNewReimbursement({ amount: '', description: '' })
      setReimbursementDialogOpen(false)
      setSelectedShift(null)
      toast({
        title: "Success",
        description: "Reimbursement added successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create reimbursement",
        variant: "destructive",
      })
    }
  }

  // Open edit dialog
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

  // Open reimbursement dialog
  const openReimbursementDialog = (shift: Shift) => {
    setSelectedShift(shift)
    setNewReimbursement({ amount: '', description: '' })
    setReimbursementDialogOpen(true)
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-NZ', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-NZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const calculateHours = (clockIn: Date, clockOut: Date | null) => {
    if (!clockOut) return null
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    return (diff / (1000 * 60 * 60)).toFixed(2)
  }

  const calculateTotalReimbursements = (reimbursements: Reimbursement[]) => {
    return reimbursements.reduce((total, reimbursement) => total + reimbursement.amount, 0)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Timesheet</h1>
        <p className="text-muted-foreground">Track your work hours and expenses</p>
      </div>

      {/* Current Shift Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5" /> Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentShift ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Currently Clocked In</p>
                <p className="text-sm text-muted-foreground">
                  Started at {formatTime(currentShift.clockIn)}
                </p>
              </div>
              <Button onClick={handleClockOut} variant="destructive">
                Clock Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Not Clocked In</p>
                <p className="text-sm text-muted-foreground">
                  Click the button below to start your shift
                </p>
              </div>
              <Button onClick={handleClockIn}>
                Clock In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>{formatDate(shift.date)}</TableCell>
                  <TableCell>{formatTime(shift.clockIn)}</TableCell>
                  <TableCell>
                    {shift.clockOut ? formatTime(shift.clockOut) : '-'}
                  </TableCell>
                  <TableCell>
                    {shift.clockOut ? calculateHours(shift.clockIn, shift.clockOut) : '-'}
                  </TableCell>
                  <TableCell>
                    {shift.mileage ? `${shift.mileage}km` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={shift.clockOut ? "secondary" : "default"}>
                      {shift.clockOut ? "Completed" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(shift)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReimbursementDialog(shift)}
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      {shift.reimbursements && shift.reimbursements.length > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${calculateTotalReimbursements(shift.reimbursements).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Shift Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
            <DialogDescription>
              Update the shift details including clock times, mileage, and notes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockIn" className="text-right">Clock In</Label>
              <Input
                id="clockIn"
                type="datetime-local"
                value={editShift.clockIn}
                onChange={(e) => setEditShift({ ...editShift, clockIn: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockOut" className="text-right">Clock Out</Label>
              <Input
                id="clockOut"
                type="datetime-local"
                value={editShift.clockOut}
                onChange={(e) => setEditShift({ ...editShift, clockOut: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mileage" className="text-right">Mileage</Label>
              <Input
                id="mileage"
                type="number"
                placeholder="0"
                value={editShift.mileage}
                onChange={(e) => setEditShift({ ...editShift, mileage: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add notes..."
                value={editShift.notes}
                onChange={(e) => setEditShift({ ...editShift, notes: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditShift}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Reimbursement Dialog */}
      <Dialog open={reimbursementDialogOpen} onOpenChange={setReimbursementDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Reimbursement</DialogTitle>
            <DialogDescription>
              Add an expense reimbursement for this shift.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newReimbursement.amount}
                onChange={(e) => setNewReimbursement({ ...newReimbursement, amount: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea
                id="description"
                placeholder="What was this expense for?"
                value={newReimbursement.description}
                onChange={(e) => setNewReimbursement({ ...newReimbursement, description: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReimbursementDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReimbursement}>
              Add Reimbursement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 