"use client"

// Staffing notes for one roster day — "Ollie off", "Jack can't work past 1pm".
// Admin and owner only: the API answers 403 to everyone else and this panel
// renders nothing at all when it does, so the section never hints at itself.

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CalendarRegion } from '@/lib/calendar-query'

interface SavedNote {
  id: string
  note: string
  updatedAt: string
  updatedByName: string | null
}

export function RosterAdminNote({
  selectedDate,
  region = 'AKL',
}: {
  selectedDate: Date
  region?: CalendarRegion
}) {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<SavedNote | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // The draft is the source of truth while typing, so a reload must not stomp
  // on unsaved edits — only the date changing resets it.
  const loadedDateRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/roster/admin-notes?region=${region}&date=${dateStr}`,
        { cache: 'no-store' }
      )
      if (response.status === 401 || response.status === 403) {
        setAllowed(false)
        setSaved(null)
        setDraft('')
        return
      }
      if (!response.ok) throw new Error('Failed to load note')
      const data = await response.json()
      setAllowed(true)
      setSaved(data.note ?? null)
      if (loadedDateRef.current !== dateStr) {
        setDraft(data.note?.note ?? '')
        loadedDateRef.current = dateStr
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load note')
    } finally {
      setLoading(false)
    }
  }, [region, dateStr])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setConfirmation(null)
    try {
      const response = await fetch('/api/roster/admin-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, date: dateStr, note: draft }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Failed to save note (${response.status})`)
      }
      const data = await response.json()
      setSaved(data.note ?? null)
      setDraft(data.note?.note ?? '')
      setConfirmation(data.note ? 'Note saved.' : 'Note cleared.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  if (!allowed) return null

  const dirty = draft.trim() !== (saved?.note ?? '')

  return (
    <div className="mt-4 rounded border border-amber-200 bg-amber-50/70 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
        <Lock className="h-3.5 w-3.5" />
        Admin notes
        <span className="font-normal text-amber-700/80">· admin and owners only</span>
      </div>

      <Textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setConfirmation(null)
          setError(null)
        }}
        placeholder="Ollie off. Jack can't work past 1pm."
        className="mt-2 min-h-[72px] bg-white text-sm"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[11px] text-amber-800">
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </span>
          ) : error ? (
            <span className="text-red-700">{error}</span>
          ) : confirmation ? (
            <span className="text-emerald-700">{confirmation}</span>
          ) : saved ? (
            <span className="truncate">
              Last updated {format(new Date(saved.updatedAt), 'd MMM, h:mma')}
              {saved.updatedByName ? ` by ${saved.updatedByName}` : ''}
            </span>
          ) : (
            <span>No note for this day.</span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"
        >
          {saving ? 'Saving…' : 'Save note'}
        </Button>
      </div>
    </div>
  )
}
