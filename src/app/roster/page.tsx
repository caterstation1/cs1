"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Plus, Calendar, Users, Clock, Copy, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

interface Staff {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
}

interface ShiftType {
  id: string
  name: string
  startTime: string
  endTime: string
  color: string
}

interface RosterAssignmentTask {
  id?: string
  title: string
  description?: string
}

interface RosterAssignment {
  id: string
  staffId: string
  shiftTypeId?: string
  startTime?: string
  endTime?: string
  date: string
  notes?: string
  staff: Staff
  shiftType?: ShiftType
  tasks?: RosterAssignmentTask[]
}

export default function RosterPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [staff, setStaff] = useState<Staff[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [assignments, setAssignments] = useState<RosterAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ staffId: string; date: string } | null>(null)
  const [newAssignment, setNewAssignment] = useState({ 
    shiftTypeId: '', 
    startTime: '', 
    endTime: '', 
    notes: '',
    tasks: [] as RosterAssignmentTask[]
  })
  const { toast } = useToast()
  
  // Get week dates (Monday to Sunday)
  const getWeekDates = (date: Date) => {
    const start = new Date(date)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    start.setDate(diff)
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const newDate = new Date(start)
      newDate.setDate(start.getDate() + i)
      dates.push(newDate)
    }
    return dates
  }

  const weekDates = getWeekDates(currentWeek)
  const today = new Date().toISOString().split('T')[0]

  // Calculate shift duration
  const calculateShiftDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return null
    
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    
    // Handle overnight shifts
    if (end < start) {
      end.setDate(end.getDate() + 1)
    }
    
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [staffRes, shiftTypesRes, assignmentsRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/shift-types'),
        fetch(`/api/roster/assignments?startDate=${weekDates[0].toISOString()}&endDate=${weekDates[6].toISOString()}`)
      ])

      // Check for API errors
      if (!staffRes.ok) {
        console.error('Staff API error:', staffRes.status, staffRes.statusText)
      }
      if (!shiftTypesRes.ok) {
        console.error('Shift types API error:', shiftTypesRes.status, shiftTypesRes.statusText)
      }
      if (!assignmentsRes.ok) {
        console.error('Assignments API error:', assignmentsRes.status, assignmentsRes.statusText)
      }

      const staffData = await staffRes.json()
      const shiftTypesData = await shiftTypesRes.json()
      const assignmentsData = await assignmentsRes.json()

      console.log('Fetched assignments:', assignmentsData)
      console.log('Week dates:', weekDates.map(d => d.toISOString().split('T')[0]))
      console.log('Sample assignment date format:', assignmentsData[0]?.date)
      console.log('Staff data:', staffData.filter((s: Staff) => s.isActive))

      // Ensure data is arrays and handle errors gracefully
      const safeStaffData = Array.isArray(staffData) ? staffData : []
      const safeShiftTypesData = Array.isArray(shiftTypesData) ? shiftTypesData : []
      const safeAssignmentsData = Array.isArray(assignmentsData) ? assignmentsData : []

      setStaff(safeStaffData.filter((s: Staff) => s.isActive))
      setShiftTypes(safeShiftTypesData)
      setAssignments(safeAssignmentsData)
    } catch (error) {
      console.error('Error fetching roster data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch roster data",
        variant: "destructive",
      })
    } finally {
      console.log('✅ Setting loading to false')
      setLoading(false)
    }
  }, [currentWeek])

  useEffect(() => {
    fetchData()
  }, [currentWeek, fetchData])

  // Navigation
  const previousWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(currentWeek.getDate() - 7)
    setCurrentWeek(newDate)
  }

  const nextWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(currentWeek.getDate() + 7)
    setCurrentWeek(newDate)
  }

  // Get assignment for a specific staff and date
  const getAssignment = (staffId: string, date: string) => {
    const assignment = assignments.find(a => {
      // Convert assignment date to YYYY-MM-DD format for comparison
      const assignmentDate = new Date(a.date).toISOString().split('T')[0]
      return a.staffId === staffId && assignmentDate === date
    })
    console.log(`Looking for assignment: staffId=${staffId}, date=${date}, found:`, assignment)
    return assignment
  }

  // Handle cell click
  const handleCellClick = (staffId: string, date: string) => {
    setSelectedCell({ staffId, date })
    
    // Check if assignment already exists
    const existingAssignment = getAssignment(staffId, date)
    
    if (existingAssignment) {
      // Populate form with existing data
      setNewAssignment({
        shiftTypeId: existingAssignment.shiftTypeId || '',
        startTime: existingAssignment.startTime || '',
        endTime: existingAssignment.endTime || '',
        notes: existingAssignment.notes || '',
        tasks: existingAssignment.tasks || []
      })
    } else {
      // Clear form for new assignment
      setNewAssignment({ shiftTypeId: '', startTime: '', endTime: '', notes: '', tasks: [] })
    }
    
    setDialogOpen(true)
  }

  // Handle assignment creation
  const handleCreateAssignment = async () => {
    if (!selectedCell || (!newAssignment.shiftTypeId && (!newAssignment.startTime || !newAssignment.endTime))) {
      toast({
        title: "Error",
        description: "Please select a shift type or enter custom start and end times",
        variant: "destructive",
      })
      return
    }

    try {
      console.log('Creating assignment with data:', {
        staffId: selectedCell.staffId,
        shiftTypeId: newAssignment.shiftTypeId || null,
        startTime: newAssignment.startTime || null,
        endTime: newAssignment.endTime || null,
        date: selectedCell.date,
        notes: newAssignment.notes,
        tasks: newAssignment.tasks
      })

      const response = await fetch('/api/roster/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: selectedCell.staffId,
          shiftTypeId: newAssignment.shiftTypeId || null,
          startTime: newAssignment.startTime || null,
          endTime: newAssignment.endTime || null,
          date: selectedCell.date,
          notes: newAssignment.notes,
          tasks: newAssignment.tasks
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to create assignment:', errorData)
        throw new Error(`Failed to create assignment: ${errorData.error || response.statusText}`)
      }

      const createdAssignment = await response.json()
      console.log('Created assignment:', createdAssignment)

      await fetchData()
      setDialogOpen(false)
      toast({
        title: "Success",
        description: "Shift assigned successfully",
      })
    } catch (error) {
      console.error('Error creating assignment:', error)
      toast({
        title: "Error",
        description: `Failed to assign shift: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  // Handle assignment deletion
  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/roster/assignments/${assignmentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete assignment')

      await fetchData()
      toast({
        title: "Success",
        description: "Shift removed successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove shift",
        variant: "destructive",
      })
    }
  }

  // Copy assignment to other days
  const handleCopyAssignment = async (assignment: RosterAssignment, targetDate: string) => {
    try {
      const response = await fetch('/api/roster/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: assignment.staffId,
          shiftTypeId: assignment.shiftTypeId || null,
          startTime: assignment.startTime || null,
          endTime: assignment.endTime || null,
          date: targetDate,
          notes: assignment.notes,
          tasks: assignment.tasks
        })
      })

      if (!response.ok) throw new Error('Failed to copy assignment')

      await fetchData()
      toast({
        title: "Success",
        description: "Shift copied successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy shift",
        variant: "destructive",
      })
    }
  }
  
  console.log('🔍 Loading state:', loading, 'Staff count:', staff.length)
  
  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading roster...</div>
        </div>
      </div>
    )
  }

  // Show error state if no staff data
  if (staff.length === 0) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">No Staff Available</h2>
            <p className="text-gray-600 mb-4">Please add staff members to create a roster.</p>
            <Button onClick={() => window.location.href = '/staff'}>
              Manage Staff
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            Roster Management
          </h1>
          <p className="text-muted-foreground mt-1">Schedule and manage staff shifts</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2 shadow-sm">
            <Button variant="ghost" size="sm" onClick={previousWeek} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[200px] text-center">
              {weekDates[0].toLocaleDateString('en-NZ', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-NZ', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <Button variant="ghost" size="sm" onClick={nextWeek} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active Staff</p>
                <p className="text-2xl font-bold">{staff.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Shifts This Week</p>
                <p className="text-2xl font-bold">{assignments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Shift Types</p>
                <p className="text-2xl font-bold">{shiftTypes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-orange-100 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-orange-600"></div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Roster Grid */}
      <Card className="shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-6 text-left font-semibold min-w-[220px] bg-white">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-600" />
                      Staff
                    </div>
                  </th>
                  {weekDates.map((date, index) => {
                    const dateStr = date.toISOString().split('T')[0]
                    const isToday = dateStr === today
                    const dayAssignments = assignments.filter(a => 
                      new Date(a.date).toISOString().split('T')[0] === dateStr
                    )
                    
                    return (
                      <th key={index} className={`p-4 text-center font-semibold min-w-[160px] ${isToday ? 'bg-blue-50 border-l-2 border-r-2 border-blue-200' : ''}`}>
                        <div className="flex flex-col items-center">
                          <div className={`text-sm font-medium ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
                            {date.toLocaleDateString('en-NZ', { weekday: 'short' })}
                          </div>
                          <div className={`text-xl font-bold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                            {date.getDate()}
                          </div>
                          {isToday && (
                            <div className="text-xs text-blue-600 font-medium">TODAY</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {dayAssignments.length} shifts
                          </div>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {staff.map((member, memberIndex) => (
                  <tr key={member.id} className={`border-b hover:bg-gray-50 transition-colors ${memberIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-6 font-medium bg-white border-r">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold">{member.firstName} {member.lastName}</div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    {weekDates.map((date, index) => {
                      const dateStr = date.toISOString().split('T')[0]
                      const assignment = getAssignment(member.id, dateStr)
                      const isToday = dateStr === today
                      
                      return (
                        <td key={index} className={`p-2 ${isToday ? 'bg-blue-50' : ''}`}>
                          <div 
                            className={`h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 ${
                              assignment ? 'border-solid border-0 shadow-sm' : ''
                            }`}
                            onClick={() => handleCellClick(member.id, dateStr)}
                          >
                            {assignment ? (
                              <div className="w-full h-full p-2 flex flex-col justify-between">
                                <div className="flex items-start justify-between">
                                  <Badge 
                                    style={{ backgroundColor: assignment.shiftType?.color || '#6B7280' }}
                                    className="text-white text-xs font-medium"
                                  >
                                    {assignment.shiftType?.name || 'Custom Shift'}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-gray-200"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        // Copy to next day
                                        const nextDay = new Date(date)
                                        nextDay.setDate(date.getDate() + 1)
                                        const nextDayStr = nextDay.toISOString().split('T')[0]
                                        handleCopyAssignment(assignment, nextDayStr)
                                      }}
                                      title="Copy to next day"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-red-200 hover:text-red-700"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteAssignment(assignment.id)
                                      }}
                                      title="Remove shift"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="text-center flex-1 flex flex-col justify-center">
                                  <div className="text-sm font-medium text-gray-900">
                                    {assignment.shiftType ? 
                                      `${assignment.shiftType.startTime} - ${assignment.shiftType.endTime}` :
                                      assignment.startTime && assignment.endTime ?
                                      `${assignment.startTime} - ${assignment.endTime}` :
                                      'No time set'
                                    }
                                  </div>
                                  
                                  {assignment.shiftType && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {calculateShiftDuration(assignment.shiftType.startTime, assignment.shiftType.endTime)}
                                    </div>
                                  )}
                                  
                                  {assignment.notes && (
                                    <div className="text-xs text-gray-600 mt-1 px-2 py-1 bg-gray-100 rounded truncate">
                                      {assignment.notes}
                                    </div>
                                  )}
                                  
                                  {assignment.tasks && assignment.tasks.length > 0 && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      <div className="font-medium">Tasks:</div>
                                      <div className="space-y-1">
                                        {assignment.tasks.slice(0, 2).map((task, index) => (
                                          <div key={index} className="flex items-center gap-1">
                                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                            <span className="truncate">{task.title}</span>
                                          </div>
                                        ))}
                                        {assignment.tasks.length > 2 && (
                                          <div className="text-gray-500">+{assignment.tasks.length - 2} more</div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-gray-400">
                                <Plus className="h-6 w-6 mb-1" />
                                <span className="text-xs">Add Shift</span>
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedCell && getAssignment(selectedCell.staffId, selectedCell.date) 
                ? 'Edit Shift Assignment' 
                : 'Assign Shift'
              }
            </DialogTitle>
            <DialogDescription>
              Select a shift type or enter custom start and end times for this staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="shiftType" className="text-sm font-medium">Shift Type (Optional)</Label>
              <div className="flex gap-2 mt-2">
                <Select value={newAssignment.shiftTypeId} onValueChange={(value) => setNewAssignment(prev => ({ ...prev, shiftTypeId: value, startTime: '', endTime: '', tasks: [] }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select shift type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((shiftType) => (
                      <SelectItem key={shiftType.id} value={shiftType.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: shiftType.color }}
                          />
                          <span className="font-medium">{shiftType.name}</span>
                          <span className="text-gray-500">({shiftType.startTime} - {shiftType.endTime})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newAssignment.shiftTypeId && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setNewAssignment(prev => ({ ...prev, shiftTypeId: '', startTime: '', endTime: '', tasks: [] }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {!newAssignment.shiftTypeId && (
                <p className="text-sm text-muted-foreground mt-2">
                  No shift type selected. You can enter custom start and end times below.
                </p>
              )}
            </div>
            
            {!newAssignment.shiftTypeId && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime" className="text-sm font-medium">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={newAssignment.startTime}
                      onChange={(e) => setNewAssignment(prev => ({ ...prev, startTime: e.target.value }))}
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime" className="text-sm font-medium">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={newAssignment.endTime}
                      onChange={(e) => setNewAssignment(prev => ({ ...prev, endTime: e.target.value }))}
                      className="mt-2"
                      required
                    />
                  </div>
                </div>
              </>
            )}
            
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this shift..."
                value={newAssignment.notes}
                onChange={(e) => setNewAssignment(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-2"
                rows={3}
              />
            </div>

            {/* Tasks Section */}
            <div>
              <Label htmlFor="tasks" className="text-sm font-medium">Tasks (Optional)</Label>
              <div className="flex flex-col gap-2 mt-2">
                {newAssignment.tasks.map((task, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Task title"
                      value={task.title}
                      onChange={(e) => setNewAssignment(prev => ({
                        ...prev,
                        tasks: prev.tasks.map((t, i) => (i === index ? { ...t, title: e.target.value } : t))
                      }))}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewAssignment(prev => ({
                        ...prev,
                        tasks: prev.tasks.filter((_, i) => i !== index)
                      }))}
                      className="h-8 w-8 p-0 hover:bg-red-100"
                      title="Remove task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewAssignment(prev => ({ ...prev, tasks: [...prev.tasks, { title: '', description: '' }] }))}
                  className="h-8 w-full"
                >
                  Add Task
                </Button>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateAssignment} 
                disabled={!newAssignment.shiftTypeId && (!newAssignment.startTime || !newAssignment.endTime)}
                className="min-w-[120px]"
              >
                {selectedCell && getAssignment(selectedCell.staffId, selectedCell.date) 
                  ? 'Update Assignment' 
                  : 'Assign Shift'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 