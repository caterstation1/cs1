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
import { Clock, Plus, Edit, Car, DollarSign, TrendingUp, Calendar, Users, Activity, CheckCircle, Circle } from 'lucide-react'

interface ShiftTask {
  id: string
  title: string
  description?: string
  isCompleted: boolean
  completedAt?: Date
}

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
  tasks: ShiftTask[]
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
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
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
  }, [fetchShifts])

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

  // Handle task completion
  const handleTaskCompletion = async (taskId: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/timesheet/shifts/${selectedShift?.id}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : null
        })
      })

      if (!response.ok) throw new Error('Failed to update task')

      await fetchShifts()
      toast({
        title: "Success",
        description: isCompleted ? "Task marked as completed" : "Task marked as incomplete",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      })
    }
  }

  // Handle clock out with task completion check
  const handleClockOut = async () => {
    if (!currentShift) return

    // Check if there are incomplete tasks
    const incompleteTasks = currentShift.tasks?.filter(task => !task.isCompleted) || []
    
    if (incompleteTasks.length > 0) {
      // Show task completion dialog
      setSelectedShift(currentShift)
      setTaskDialogOpen(true)
      return
    }

    // Proceed with normal clock out
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

  // Handle clock out with task completion
  const handleClockOutWithTasks = async (completedTaskIds: string[]) => {
    try {
      // Mark specified tasks as completed
      for (const taskId of completedTaskIds) {
        await handleTaskCompletion(taskId, true)
      }

      // Then clock out
      const response = await fetch('/api/timesheet/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) throw new Error('Failed to clock out')

      await fetchShifts()
      setTaskDialogOpen(false)
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

  // Calculate stats
  const totalHours = shifts.reduce((total, shift) => {
    if (shift.totalHours) return total + shift.totalHours
    return total
  }, 0)

  const totalMileage = shifts.reduce((total, shift) => {
    if (shift.mileage) return total + shift.mileage
    return total
  }, 0)

  const totalReimbursements = shifts.reduce((total, shift) => {
    return total + calculateTotalReimbursements(shift.reimbursements)
  }, 0)

  const completedShifts = shifts.filter(shift => shift.clockOut).length

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Clock className="h-8 w-8 text-blue-600" />
          Timesheet
        </h1>
        <p className="text-muted-foreground">Track your work hours and expenses</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Mileage</p>
                <p className="text-2xl font-bold">{totalMileage.toFixed(0)}km</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Reimbursements</p>
                <p className="text-2xl font-bold">${totalReimbursements.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed Shifts</p>
                <p className="text-2xl font-bold">{completedShifts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Shift Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentShift ? (
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="font-medium text-green-800">Currently Clocked In</p>
                  <p className="text-sm text-green-600">
                    Started at {formatTime(currentShift.clockIn)}
                  </p>
                </div>
              </div>
              <Button onClick={handleClockOut} variant="destructive" className="bg-red-600 hover:bg-red-700">
                Clock Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-800">Not Clocked In</p>
                  <p className="text-sm text-gray-600">
                    Click the button below to start your shift
                  </p>
                </div>
              </div>
              <Button onClick={handleClockIn} className="bg-green-600 hover:bg-green-700">
                Clock In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Recent Shifts
          </CardTitle>
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
                <TableHead>Tasks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{formatDate(shift.date)}</TableCell>
                  <TableCell>{formatTime(shift.clockIn)}</TableCell>
                  <TableCell>
                    {shift.clockOut ? formatTime(shift.clockOut) : '-'}
                  </TableCell>
                  <TableCell>
                    {shift.clockOut ? (
                      <Badge variant="secondary" className="font-mono">
                        {calculateHours(shift.clockIn, shift.clockOut)}h
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {shift.mileage ? (
                      <div className="flex items-center gap-1">
                        <Car className="h-3 w-3 text-gray-500" />
                        <span>{shift.mileage}km</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {shift.tasks && shift.tasks.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1">
                          {shift.tasks.filter(task => task.isCompleted).length}/{shift.tasks.length}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {shift.tasks.filter(task => task.isCompleted).length === shift.tasks.length ? 'All Done' : 'In Progress'}
                        </Badge>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={shift.clockOut ? "secondary" : "default"} className="flex items-center gap-1">
                      {shift.clockOut ? "Completed" : "Active"}
                      {!shift.clockOut && <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(shift)}
                        className="h-8 px-2"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReimbursementDialog(shift)}
                        className="h-8 px-2"
                      >
                        <DollarSign className="h-3 w-3" />
                      </Button>
                      {shift.reimbursements && shift.reimbursements.length > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1 h-8">
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

      {/* Enhanced Edit Shift Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" /> Edit Shift
            </DialogTitle>
            <DialogDescription>
              Update the shift details including clock times, mileage, and notes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clockIn" className="text-sm font-medium">Clock In</Label>
                <Input
                  id="clockIn"
                  type="datetime-local"
                  value={editShift.clockIn}
                  onChange={(e) => setEditShift({ ...editShift, clockIn: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="clockOut" className="text-sm font-medium">Clock Out</Label>
                <Input
                  id="clockOut"
                  type="datetime-local"
                  value={editShift.clockOut}
                  onChange={(e) => setEditShift({ ...editShift, clockOut: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mileage" className="text-sm font-medium">Mileage (km)</Label>
              <Input
                id="mileage"
                type="number"
                placeholder="0"
                value={editShift.mileage}
                onChange={(e) => setEditShift({ ...editShift, mileage: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this shift..."
                value={editShift.notes}
                onChange={(e) => setEditShift({ ...editShift, notes: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditShift} className="min-w-[120px]">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Add Reimbursement Dialog */}
      <Dialog open={reimbursementDialogOpen} onOpenChange={setReimbursementDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Add Reimbursement
            </DialogTitle>
            <DialogDescription>
              Add an expense reimbursement for this shift.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="amount" className="text-sm font-medium">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newReimbursement.amount}
                onChange={(e) => setNewReimbursement({ ...newReimbursement, amount: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                placeholder="What was this expense for?"
                value={newReimbursement.description}
                onChange={(e) => setNewReimbursement({ ...newReimbursement, description: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setReimbursementDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReimbursement} className="min-w-[120px]">
              Add Reimbursement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Completion Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> Complete Tasks
            </DialogTitle>
            <DialogDescription>
              Please mark which tasks you have completed before clocking out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedShift?.tasks?.filter(task => !task.isCompleted).map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id={`task-${task.id}`}
                  className="h-4 w-4 text-blue-600 rounded"
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleTaskCompletion(task.id, true)
                    }
                  }}
                />
                <div className="flex-1">
                  <Label htmlFor={`task-${task.id}`} className="font-medium cursor-pointer">
                    {task.title}
                  </Label>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setTaskDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  const completedTaskIds = selectedShift?.tasks
                    ?.filter(task => !task.isCompleted)
                    .map(task => task.id) || []
                  handleClockOutWithTasks(completedTaskIds)
                }}
                className="min-w-[120px]"
              >
                Clock Out
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 