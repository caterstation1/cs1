"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

interface Shift {
  id: string
  staffId: string
  clockIn: Date
  clockOut: Date | null
  totalHours: number | null
  date: Date
}

interface EditShiftDialogProps {
  shift: Shift | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onShiftUpdated: () => void
}

export function EditShiftDialog({ shift, open, onOpenChange, onShiftUpdated }: EditShiftDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  
  // Format date for input fields
  const formatDateForInput = (date: Date) => {
    return new Date(date).toISOString().split('T')[0]
  }
  
  // Format time for input fields
  const formatTimeForInput = (date: Date) => {
    return new Date(date).toISOString().split('T')[1].substring(0, 5)
  }
  
  // State for form fields
  const [date, setDate] = useState('')
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')
  
  // Reset form when shift changes
  useEffect(() => {
    if (shift) {
      setDate(formatDateForInput(shift.date))
      setClockInTime(formatTimeForInput(shift.clockIn))
      setClockOutTime(shift.clockOut ? formatTimeForInput(shift.clockOut) : '')
    }
  }, [shift])
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!shift) return
    
    try {
      setLoading(true)
      
      // Combine date and time for clock in and clock out
      const clockIn = new Date(`${date}T${clockInTime}`)
      const clockOut = clockOutTime ? new Date(`${date}T${clockOutTime}`) : null
      
      // Validate that clock out is after clock in if provided
      if (clockOut && clockOut < clockIn) {
        toast({
          title: "Error",
          description: "Clock out time must be after clock in time",
          variant: "destructive",
        })
        return
      }
      
      // Send update request
      const response = await fetch(`/api/roster/${shift.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          clockIn: clockIn.toISOString(),
          clockOut: clockOut ? clockOut.toISOString() : null,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update shift')
      }
      
      // Close dialog and refresh shifts
      onOpenChange(false)
      onShiftUpdated()
      
      toast({
        title: "Success",
        description: "Shift updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update shift",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Shift</DialogTitle>
          <DialogDescription>
            Update the details of this shift. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="clockIn" className="text-right">
              Clock In
            </Label>
            <Input
              id="clockIn"
              type="time"
              value={clockInTime}
              onChange={(e) => setClockInTime(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="clockOut" className="text-right">
              Clock Out
            </Label>
            <Input
              id="clockOut"
              type="time"
              value={clockOutTime}
              onChange={(e) => setClockOutTime(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 