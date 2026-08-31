"use client"

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CalendarRegion } from '@/lib/calendar-query'

interface CalendarDayAlert {
  id: string
  message: string
  createdAt: string
  createdByName: string | null
}

interface UseCalendarDayAlertOptions {
  region: CalendarRegion
  selectedDate: Date
  refreshToken?: number
}

export function useCalendarDayAlert({
  region,
  selectedDate,
  refreshToken = 0,
}: UseCalendarDayAlertOptions) {
  const [alert, setAlert] = useState<CalendarDayAlert | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  const fetchAlert = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/calendar/alerts?region=${region}&date=${dateStr}`,
        { cache: 'no-store' }
      )
      if (!response.ok) throw new Error('Failed to fetch alert')
      const data = await response.json()
      setAlert(data.alert ?? null)
    } catch (error) {
      console.error('Error fetching calendar alert:', error)
    } finally {
      setLoading(false)
    }
  }, [region, dateStr])

  useEffect(() => {
    fetchAlert()
  }, [fetchAlert, refreshToken])

  const handlePost = async () => {
    const message = note.trim()
    if (!message) return

    setPosting(true)
    try {
      const response = await fetch('/api/calendar/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, date: dateStr, message }),
      })
      if (!response.ok) throw new Error('Failed to post alert')
      const data = await response.json()
      setAlert(data.alert)
      setNote('')
      setModalOpen(false)
    } catch (error) {
      console.error('Error posting calendar alert:', error)
      window.alert('Failed to post alert. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  const handleDismiss = async () => {
    if (!alert) return

    setDismissing(true)
    try {
      const response = await fetch(`/api/calendar/alerts/${alert.id}/dismiss`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to dismiss alert')
      setAlert(null)
    } catch (error) {
      console.error('Error dismissing calendar alert:', error)
      window.alert('Failed to dismiss alert. Please try again.')
    } finally {
      setDismissing(false)
    }
  }

  return {
    alert,
    loading,
    modalOpen,
    setModalOpen,
    note,
    setNote,
    posting,
    dismissing,
    handlePost,
    handleDismiss,
    selectedDate,
  }
}

export function CalendarDayAlertButton({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <Button
      onClick={onClick}
      size="sm"
      className="hidden xl:flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
    >
      <AlertTriangle className="w-4 h-4" />
      Alert
    </Button>
  )
}

export function CalendarDayAlertBanner({
  alert,
  dismissing,
  onDismiss,
}: {
  alert: CalendarDayAlert | null
  dismissing: boolean
  onDismiss: () => void
}) {
  if (!alert) return null

  return (
    <div className="hidden xl:flex mb-3 items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-900">
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
        <div className="min-w-0">
          <div className="font-semibold text-red-800">Alert for this day</div>
          <div className="text-sm whitespace-pre-wrap break-words">{alert.message}</div>
          {alert.createdByName && (
            <div className="text-xs text-red-700/80 mt-1">Posted by {alert.createdByName}</div>
          )}
        </div>
      </div>
      <Button
        onClick={onDismiss}
        size="sm"
        variant="outline"
        disabled={dismissing}
        className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
      >
        <X className="w-4 h-4 mr-1" />
        Dismiss
      </Button>
    </div>
  )
}

export function CalendarDayAlertModal({
  open,
  onOpenChange,
  selectedDate,
  note,
  onNoteChange,
  posting,
  onPost,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date
  note: string
  onNoteChange: (value: string) => void
  posting: boolean
  onPost: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Post calendar alert</DialogTitle>
          <DialogDescription>
            Add an alert for {format(selectedDate, 'EEE, MMM d, yyyy')}. Everyone viewing this day will see it until dismissed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="calendar-alert-note">Alert note</Label>
          <Textarea
            id="calendar-alert-note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Write the alert message..."
            className="min-h-[120px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={posting}>
            Cancel
          </Button>
          <Button
            onClick={onPost}
            disabled={posting || !note.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {posting ? 'Posting...' : 'Post alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
