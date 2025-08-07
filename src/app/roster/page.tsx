"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

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
}

export default function RosterPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [staff, setStaff] = useState<Staff[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [assignments, setAssignments] = useState<RosterAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ staffId: string; date: string } | null>(null)
  const [newAssignment, setNewAssignment] = useState({ shiftTypeId: '', startTime: '', endTime: '', notes: '' })
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
        notes: existingAssignment.notes || ''
      })
    } else {
      // Clear form for new assignment
      setNewAssignment({ shiftTypeId: '', startTime: '', endTime: '', notes: '' })
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
        notes: newAssignment.notes
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
          notes: newAssignment.notes
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
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Roster Management</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={previousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-semibold">
            {weekDates[0].toLocaleDateString('en-NZ', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-NZ', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <Button variant="outline" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Roster Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-4 text-left font-semibold min-w-[200px]">Staff</th>
                  {weekDates.map((date, index) => (
                    <th key={index} className="p-4 text-center font-semibold min-w-[150px]">
                      <div className="flex flex-col">
                        <div className="text-sm text-gray-600">
                          {date.toLocaleDateString('en-NZ', { weekday: 'short' })}
                        </div>
                        <div className="text-lg">
                          {date.getDate()}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">
                      {member.firstName} {member.lastName}
                    </td>
                    {weekDates.map((date, index) => {
                      const dateStr = date.toISOString().split('T')[0]
                      const assignment = getAssignment(member.id, dateStr)
                      
                      return (
                        <td key={index} className="p-2">
                          <div 
                            className="h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                            onClick={() => handleCellClick(member.id, dateStr)}
                          >
                            {assignment ? (
                              <div className="text-center">
                                <Badge 
                                  style={{ backgroundColor: assignment.shiftType?.color || '#6B7280' }}
                                  className="text-white mb-1"
                                >
                                  {assignment.shiftType?.name || 'Custom Shift'}
                                </Badge>
                                <div className="text-xs text-gray-600">
                                  {assignment.shiftType ? 
                                    `${assignment.shiftType.startTime} - ${assignment.shiftType.endTime}` :
                                    assignment.startTime && assignment.endTime ?
                                    `${assignment.startTime} - ${assignment.endTime}` :
                                    'No time set'
                                  }
                                </div>
                                {assignment.notes && (
                                  <div className="text-xs text-gray-500 mt-1 truncate max-w-[120px]">
                                    {assignment.notes}
                                  </div>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-1 h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteAssignment(assignment.id)
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ) : (
                              <Plus className="h-6 w-6 text-gray-400" />
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

      {/* Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCell && getAssignment(selectedCell.staffId, selectedCell.date) 
                ? 'Edit Shift Assignment' 
                : 'Assign Shift'
              }
            </DialogTitle>
            <DialogDescription>
              Select a shift type or enter custom start and end times for this staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shiftType">Shift Type (Optional)</Label>
              <div className="flex gap-2">
                <Select value={newAssignment.shiftTypeId} onValueChange={(value) => setNewAssignment(prev => ({ ...prev, shiftTypeId: value, startTime: '', endTime: '' }))}>
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
                          {shiftType.name} ({shiftType.startTime} - {shiftType.endTime})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newAssignment.shiftTypeId && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setNewAssignment(prev => ({ ...prev, shiftTypeId: '', startTime: '', endTime: '' }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {!newAssignment.shiftTypeId && (
                <p className="text-sm text-muted-foreground mt-1">
                  No shift type selected. You can enter custom start and end times below.
                </p>
              )}
            </div>
            
            {!newAssignment.shiftTypeId && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={newAssignment.startTime}
                      onChange={(e) => setNewAssignment(prev => ({ ...prev, startTime: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={newAssignment.endTime}
                      onChange={(e) => setNewAssignment(prev => ({ ...prev, endTime: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </>
            )}
            
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this shift..."
                value={newAssignment.notes}
                onChange={(e) => setNewAssignment(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssignment} disabled={!newAssignment.shiftTypeId && (!newAssignment.startTime || !newAssignment.endTime)}>
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