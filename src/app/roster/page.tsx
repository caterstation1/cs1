"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { EditShiftDialog } from '@/components/EditShiftDialog'
import { PencilIcon } from 'lucide-react'

interface Shift {
  id: string
  staffId: string
  clockIn: Date
  clockOut: Date | null
  totalHours: number | null
  date: Date
}

export default function RosterPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  
  // State for edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [shiftToEdit, setShiftToEdit] = useState<Shift | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Fetch current user's shifts
  const fetchShifts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/roster', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })
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

  // Clock in
  const handleClockIn = async () => {
    try {
      const response = await fetch('/api/roster/clock-in', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
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
      const response = await fetch('/api/roster/clock-out', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
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
  
  // Open edit dialog
  const handleEditShift = (shift: Shift) => {
    setShiftToEdit(shift)
    setEditDialogOpen(true)
  }

  // Format date for display
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-NZ', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Format time for display
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-NZ', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Calculate hours worked
  const calculateHours = (clockIn: Date, clockOut: Date | null) => {
    if (!clockOut) return null
    
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchShifts()
    }
  }, [status])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Roster</h1>
        <div className="flex gap-4">
          {!currentShift ? (
            <Button onClick={handleClockIn}>Clock In</Button>
          ) : (
            <Button onClick={handleClockOut}>Clock Out</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Hours</TableHead>
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
                  {shift.totalHours ? `${shift.totalHours} hrs` : '-'}
                </TableCell>
                <TableCell>
                  {shift.clockOut ? 'Completed' : 'In Progress'}
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleEditShift(shift)}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      
      {/* Edit Shift Dialog */}
      <EditShiftDialog
        shift={shiftToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onShiftUpdated={fetchShifts}
      />
    </div>
  )
} 