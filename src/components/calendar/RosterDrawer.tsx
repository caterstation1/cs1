"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { CalendarClock, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DAY_START_MINUTES = 6 * 60
const DAY_END_MINUTES = 20 * 60
const SLOT_MINUTES = 15
const SLOT_COUNT = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES
const SLOT_HEIGHT = 18

// Wellington staff are identified by access level; there is no region column on Staff.
const WLG_ACCESS_LEVELS = ['wlg_team', 'wlg_admin']

interface StaffOption {
  id: string
  firstName: string
  lastName: string
  isActive?: boolean
  accessLevel?: string
}

interface RosterAssignment {
  id: string
  staffId: string
  startTime?: string | null
  endTime?: string | null
  date: string
  notes?: string | null
  staff?: { firstName: string; lastName: string }
  shiftType?: { name: string; startTime: string; endTime: string; color: string } | null
}

interface PlacedShift {
  assignment: RosterAssignment
  startMinutes: number
  endMinutes: number
  lane: number
}

function parseClock(value?: string | null): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function assignmentRange(assignment: RosterAssignment): { startMinutes: number; endMinutes: number } | null {
  const start = parseClock(assignment.startTime) ?? parseClock(assignment.shiftType?.startTime)
  const end = parseClock(assignment.endTime) ?? parseClock(assignment.shiftType?.endTime)
  if (start == null || end == null) return null
  // Overnight shifts are stored as end < start; treat them as running to midnight
  // so they still occupy the visible part of the grid.
  return { startMinutes: start, endMinutes: end <= start ? 24 * 60 : end }
}

function slotToMinutes(slot: number): number {
  return DAY_START_MINUTES + slot * SLOT_MINUTES
}

function toStorageClock(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function toDisplayClock(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  const suffix = hours24 < 12 ? 'am' : 'pm'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(mins).padStart(2, '0')}${suffix}`
}

function toDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function RosterDrawerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="sm"
      className="hidden xl:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
    >
      <CalendarClock className="w-4 h-4" />
      Roster
    </Button>
  )
}

export function RosterDrawer({
  open,
  onClose,
  selectedDate,
}: {
  open: boolean
  onClose: () => void
  selectedDate: Date
}) {
  const [mounted, setMounted] = useState(false)
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [assignments, setAssignments] = useState<RosterAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [staffId, setStaffId] = useState('')
  const [selection, setSelection] = useState<{ startSlot: number; endSlot: number } | null>(null)
  const [drag, setDrag] = useState<{ anchorSlot: number; cursorSlot: number } | null>(null)

  const trackRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ anchorSlot: number; cursorSlot: number } | null>(null)
  const pointerYRef = useRef(0)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    // Removing the page scrollbar would shift the content behind the drawer, which
    // is exactly what an overlay must not do, so pad by the width it occupied.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
    }
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const fetchAssignments = useCallback(async () => {
    const params = new URLSearchParams({
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
    })
    const response = await fetch(`/api/roster/assignments?${params.toString()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load rostered shifts')
    const data = await response.json()
    setAssignments(Array.isArray(data) ? data : [])
  }, [dateStr])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const [staffResponse] = await Promise.all([
          fetch('/api/staff', { cache: 'no-store' }),
          fetchAssignments(),
        ])
        if (!staffResponse.ok) throw new Error('Failed to load staff')
        const staffData = (await staffResponse.json()) as StaffOption[]
        if (cancelled) return
        const auckland = (Array.isArray(staffData) ? staffData : []).filter(
          (member) =>
            member.isActive !== false &&
            !WLG_ACCESS_LEVELS.includes(String(member.accessLevel || '').toLowerCase())
        )
        setStaff(auckland)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load roster data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, fetchAssignments])

  useEffect(() => {
    if (open) return
    setSelection(null)
    dragRef.current = null
    setDrag(null)
    setStaffId('')
    setSaveError(null)
    setSavedMessage(null)
  }, [open])

  const slotFromClientY = useCallback((clientY: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const raw = Math.floor((clientY - rect.top) / SLOT_HEIGHT)
    return Math.min(SLOT_COUNT - 1, Math.max(0, raw))
  }, [])

  // dragRef, not the drag state, is the source of truth during a drag: the pointer
  // stream has to be read synchronously, before React has re-rendered.
  const moveCursor = useCallback(
    (clientY: number) => {
      pointerYRef.current = clientY
      const active = dragRef.current
      if (!active) return
      const cursorSlot = slotFromClientY(clientY)
      if (cursorSlot === active.cursorSlot) return
      dragRef.current = { ...active, cursorSlot }
      setDrag(dragRef.current)
    },
    [slotFromClientY]
  )

  const finishDrag = useCallback(() => {
    const active = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!active) return
    setSelection({
      startSlot: Math.min(active.anchorSlot, active.cursorSlot),
      endSlot: Math.max(active.anchorSlot, active.cursorSlot) + 1,
    })
  }, [])

  const dragging = drag !== null

  useEffect(() => {
    if (!dragging) return

    const handleMove = (event: PointerEvent) => moveCursor(event.clientY)

    // The full 6am-8pm grid is taller than the drawer, so a drag has to be able
    // to pull the panel along with it to reach times below the fold.
    let frame = requestAnimationFrame(function autoScroll() {
      const container = scrollRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const edge = 48
        const y = pointerYRef.current
        let delta = 0
        if (y < rect.top + edge) delta = -Math.min(20, (rect.top + edge - y) / 2)
        else if (y > rect.bottom - edge) delta = Math.min(20, (y - (rect.bottom - edge)) / 2)
        if (delta !== 0) {
          container.scrollTop += delta
          const cursorSlot = slotFromClientY(y)
          if (dragRef.current && dragRef.current.cursorSlot !== cursorSlot) {
            dragRef.current = { ...dragRef.current, cursorSlot }
            setDrag(dragRef.current)
          }
        }
      }
      frame = requestAnimationFrame(autoScroll)
    })

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    // A drag that ends while the window is not focused never delivers pointerup.
    window.addEventListener('blur', finishDrag)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
      window.removeEventListener('blur', finishDrag)
    }
  }, [dragging, moveCursor, finishDrag, slotFromClientY])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    // Capture retargets the rest of the gesture to the grid, so the element's own
    // handlers keep working when the pointer leaves it.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture is best-effort; the window listeners still finish the drag.
    }
    pointerYRef.current = event.clientY
    const slot = slotFromClientY(event.clientY)
    setSelection(null)
    setSaveError(null)
    setSavedMessage(null)
    dragRef.current = { anchorSlot: slot, cursorSlot: slot }
    setDrag(dragRef.current)
  }

  const activeRange = useMemo(() => {
    if (drag) {
      const startSlot = Math.min(drag.anchorSlot, drag.cursorSlot)
      const endSlot = Math.max(drag.anchorSlot, drag.cursorSlot) + 1
      return { startSlot, endSlot }
    }
    return selection
  }, [drag, selection])

  const adjustSelection = (edge: 'start' | 'end', deltaSlots: number) => {
    setSelection((current) => {
      if (!current) return current
      if (edge === 'start') {
        const startSlot = Math.min(Math.max(0, current.startSlot + deltaSlots), current.endSlot - 1)
        return { ...current, startSlot }
      }
      const endSlot = Math.max(Math.min(SLOT_COUNT, current.endSlot + deltaSlots), current.startSlot + 1)
      return { ...current, endSlot }
    })
    setSaveError(null)
    setSavedMessage(null)
  }

  const placedShifts = useMemo<PlacedShift[]>(() => {
    const laneEnds: number[] = []
    return assignments
      .map((assignment) => {
        const range = assignmentRange(assignment)
        return range ? { assignment, ...range } : null
      })
      .filter((item): item is { assignment: RosterAssignment; startMinutes: number; endMinutes: number } => item !== null)
      .filter((item) => item.endMinutes > DAY_START_MINUTES && item.startMinutes < DAY_END_MINUTES)
      .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
      .map((item) => {
        let lane = laneEnds.findIndex((end) => end <= item.startMinutes)
        if (lane === -1) {
          lane = laneEnds.length
          laneEnds.push(item.endMinutes)
        } else {
          laneEnds[lane] = item.endMinutes
        }
        return { ...item, lane }
      })
  }, [assignments])

  const laneCount = Math.max(1, ...placedShifts.map((shift) => shift.lane + 1))

  const shiftsOutsideGrid = useMemo(
    () =>
      assignments.filter((assignment) => {
        const range = assignmentRange(assignment)
        if (!range) return true
        return range.endMinutes <= DAY_START_MINUTES || range.startMinutes >= DAY_END_MINUTES
      }),
    [assignments]
  )

  const overlaps = useMemo(() => {
    if (!selection || !staffId) return []
    const startMinutes = slotToMinutes(selection.startSlot)
    const endMinutes = slotToMinutes(selection.endSlot)
    return assignments.filter((assignment) => {
      if (assignment.staffId !== staffId) return false
      const range = assignmentRange(assignment)
      if (!range) return false
      return range.startMinutes < endMinutes && range.endMinutes > startMinutes
    })
  }, [assignments, selection, staffId])

  const handleConfirm = async () => {
    if (!selection || !staffId) return
    setSaving(true)
    setSaveError(null)
    setSavedMessage(null)
    const startTime = toStorageClock(slotToMinutes(selection.startSlot))
    const endTime = toStorageClock(slotToMinutes(selection.endSlot))
    try {
      const response = await fetch('/api/roster/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          shiftTypeId: null,
          startTime,
          endTime,
          date: dateStr,
          notes: null,
          tasks: [],
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Failed to create shift (${response.status})`)
      }
      const created = (await response.json()) as RosterAssignment
      await fetchAssignments()
      const name = created.staff
        ? `${created.staff.firstName} ${created.staff.lastName}`
        : staff.find((member) => member.id === staffId)?.firstName || 'Staff'
      setSelection(null)
      setStaffId('')
      setSavedMessage(
        `Rostered ${name} ${toDisplayClock(slotToMinutes(selection.startSlot))} – ${toDisplayClock(
          slotToMinutes(selection.endSlot)
        )}. Saved to the roster.`
      )
    } catch (error) {
      // The selection is deliberately left in place so a failed save can be retried.
      setSaveError(error instanceof Error ? error.message : 'Failed to create shift')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted || !open) return null

  const hourMarks = Array.from(
    { length: (DAY_END_MINUTES - DAY_START_MINUTES) / 60 + 1 },
    (_, index) => DAY_START_MINUTES + index * 60
  )

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Roster shifts"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="h-5 w-5 text-indigo-600" />
              Roster
            </div>
            <div className="text-sm font-medium text-gray-900">
              {format(selectedDate, 'EEEE, d MMMM yyyy')}
            </div>
            <div className="text-xs text-muted-foreground">
              Drag down the grid to select a time, then choose an Auckland staff member.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close roster"
            className="rounded px-2 py-1 text-lg leading-none hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loadError && (
            <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {loadError}
            </div>
          )}
          {loading && (
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading roster…
            </div>
          )}

          <div className="flex select-none">
            <div className="relative w-14 shrink-0" style={{ height: SLOT_COUNT * SLOT_HEIGHT }}>
              {hourMarks.map((minutes) => (
                <div
                  key={minutes}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-gray-500"
                  style={{ top: ((minutes - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT }}
                >
                  {toDisplayClock(minutes)}
                </div>
              ))}
            </div>

            <div
              ref={trackRef}
              onPointerDown={handlePointerDown}
              onPointerMove={(event) => moveCursor(event.clientY)}
              onPointerUp={finishDrag}
              className="relative flex-1 cursor-crosshair border-y border-l border-gray-300 bg-white"
              style={{ height: SLOT_COUNT * SLOT_HEIGHT, touchAction: 'none' }}
            >
              {Array.from({ length: SLOT_COUNT }, (_, slot) => (
                <div
                  key={slot}
                  className={`absolute inset-x-0 border-t ${
                    slot === 0
                      ? 'border-transparent'
                      : slot % 4 === 0
                        ? 'border-gray-300'
                        : 'border-gray-100'
                  }`}
                  style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                />
              ))}

              {placedShifts.map(({ assignment, startMinutes, endMinutes, lane }) => {
                const top =
                  ((Math.max(startMinutes, DAY_START_MINUTES) - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT
                const bottom =
                  ((Math.min(endMinutes, DAY_END_MINUTES) - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT
                return (
                  <div
                    key={assignment.id}
                    className="absolute overflow-hidden rounded border border-emerald-400 bg-emerald-100/90 px-1 py-0.5 text-[10px] leading-tight text-emerald-900"
                    style={{
                      top,
                      height: Math.max(SLOT_HEIGHT, bottom - top),
                      left: `${(lane * 100) / laneCount}%`,
                      width: `calc(${100 / laneCount}% - 2px)`,
                    }}
                    title={`${assignment.staff?.firstName ?? ''} ${assignment.staff?.lastName ?? ''} ${toDisplayClock(
                      startMinutes
                    )} – ${toDisplayClock(endMinutes)}`}
                  >
                    <div className="truncate font-semibold">
                      {assignment.staff?.firstName} {assignment.staff?.lastName?.charAt(0)}
                    </div>
                    <div className="truncate">
                      {toDisplayClock(startMinutes)}–{toDisplayClock(endMinutes)}
                    </div>
                  </div>
                )
              })}

              {activeRange && (
                <div
                  className="pointer-events-none absolute inset-x-0 rounded border-2 border-indigo-500 bg-indigo-500/25"
                  style={{
                    top: activeRange.startSlot * SLOT_HEIGHT,
                    height: (activeRange.endSlot - activeRange.startSlot) * SLOT_HEIGHT,
                  }}
                >
                  <div className="whitespace-nowrap px-1 text-[11px] font-semibold text-indigo-900">
                    {toDisplayClock(slotToMinutes(activeRange.startSlot))} –{' '}
                    {toDisplayClock(slotToMinutes(activeRange.endSlot))} (
                    {toDurationLabel((activeRange.endSlot - activeRange.startSlot) * SLOT_MINUTES)})
                  </div>
                </div>
              )}
            </div>
          </div>

          {shiftsOutsideGrid.length > 0 && (
            <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <div className="font-medium">Also rostered, outside 6:00am–8:00pm</div>
              {shiftsOutsideGrid.map((assignment) => (
                <div key={assignment.id}>
                  {assignment.staff?.firstName} {assignment.staff?.lastName}
                  {assignment.startTime && assignment.endTime
                    ? ` ${assignment.startTime}–${assignment.endTime}`
                    : ' (no time set)'}
                </div>
              ))}
            </div>
          )}

          {!loading && assignments.length === 0 && (
            <div className="mt-3 text-xs text-muted-foreground">Nobody is rostered on this day yet.</div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t px-4 py-3">
          {selection ? (
            <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-indigo-900">
                  {toDisplayClock(slotToMinutes(selection.startSlot))} –{' '}
                  {toDisplayClock(slotToMinutes(selection.endSlot))} (
                  {toDurationLabel((selection.endSlot - selection.startSlot) * SLOT_MINUTES)})
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelection(null)}>
                  Clear
                </Button>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-indigo-900">
                <div className="flex items-center gap-1">
                  <span>Start</span>
                  <button
                    type="button"
                    className="rounded border border-indigo-300 px-1.5 hover:bg-indigo-100"
                    onClick={() => adjustSelection('start', -1)}
                  >
                    −15m
                  </button>
                  <button
                    type="button"
                    className="rounded border border-indigo-300 px-1.5 hover:bg-indigo-100"
                    onClick={() => adjustSelection('start', 1)}
                  >
                    +15m
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span>End</span>
                  <button
                    type="button"
                    className="rounded border border-indigo-300 px-1.5 hover:bg-indigo-100"
                    onClick={() => adjustSelection('end', -1)}
                  >
                    −15m
                  </button>
                  <button
                    type="button"
                    className="rounded border border-indigo-300 px-1.5 hover:bg-indigo-100"
                    onClick={() => adjustSelection('end', 1)}
                  >
                    +15m
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              No time selected. Drag on the grid above to pick a start and finish.
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="roster-staff" className="text-xs font-medium text-gray-700">
              Auckland staff
            </label>
            <select
              id="roster-staff"
              value={staffId}
              onChange={(event) => {
                setStaffId(event.target.value)
                setSaveError(null)
                setSavedMessage(null)
              }}
              disabled={!selection || staff.length === 0}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">
                {staff.length === 0 ? 'No Auckland staff found' : 'Select staff member…'}
              </option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </div>

          {overlaps.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="font-semibold">Overlaps an existing shift</div>
              {overlaps.map((assignment) => {
                const range = assignmentRange(assignment)
                return (
                  <div key={assignment.id}>
                    Already rostered{' '}
                    {range ? `${toDisplayClock(range.startMinutes)} – ${toDisplayClock(range.endMinutes)}` : 'this day'}
                  </div>
                )
              })}
            </div>
          )}

          {saveError && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{saveError}</div>
          )}
          {savedMessage && (
            <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {savedMessage}
            </div>
          )}

          <Button
            onClick={handleConfirm}
            disabled={!selection || !staffId || saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? 'Creating shift…' : overlaps.length > 0 ? 'Confirm anyway' : 'Confirm shift'}
          </Button>
        </div>
      </aside>
    </div>,
    document.body
  )
}
