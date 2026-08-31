'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type LiveMapOrder = {
  orderId: string
  orderNumber: number
  deliveryTime: string | null
  customerName: string
  address: string
}

type LiveMapStaff = {
  staffUserId: string
  shiftId: string
  staffName: string
  staffEmail: string
  shiftStart: string
  deliveryRunStartedAt: string | null
  distanceFromBaseMeters: number | null
  lastSeen: string
  location: {
    latitude: number
    longitude: number
    accuracy: number | null
    speed: number | null
    heading: number | null
  }
  assignedOrders: LiveMapOrder[]
  currentDelivery: LiveMapOrder | null
}

type LiveMapResponse = {
  staff: LiveMapStaff[]
  fetchedAt: string
  minRefreshSeconds: number
}

type LiveMapModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const REFRESH_INTERVAL_MS = 90_000
const MAP_SCRIPT_ID = 'staff-live-map-google-script'
const STALE_AFTER_MS = 3 * 60_000
const RETURNING_TO_BASE_METERS = 1_000

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`
  return `${Math.round(meters)}m`
}

function getLastSeenAgeMs(lastSeen: string): number {
  const timestamp = new Date(lastSeen).getTime()
  if (!Number.isFinite(timestamp)) return Number.MAX_SAFE_INTEGER
  return Math.max(0, Date.now() - timestamp)
}

async function loadGoogleMapsJs(): Promise<void> {
  if (typeof window === 'undefined') return
  if ((window as any).google?.maps) return

  const existing = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps JS')), { once: true })
    })
    return
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured')
  }

  const script = document.createElement('script')
  script.id = MAP_SCRIPT_ID
  script.async = true
  script.defer = true
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=beta`
  document.head.appendChild(script)

  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps JS'))
  })
}

export default function LiveMapModal({ open, onOpenChange }: LiveMapModalProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staff, setStaff] = useState<LiveMapStaff[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)

  const selectedStaff = useMemo(
    () => staff.find((member) => member.staffUserId === selectedStaffId) || staff[0] || null,
    [selectedStaffId, staff]
  )

  const fetchLiveLocations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/live-map/staff', { cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load live map data')
      }
      const data = (await response.json()) as LiveMapResponse
      setStaff(Array.isArray(data.staff) ? data.staff : [])
      setFetchedAt(data.fetchedAt || new Date().toISOString())
      if (Array.isArray(data.staff) && data.staff.length > 0) {
        setSelectedStaffId((prev) => prev || data.staff[0].staffUserId)
      } else {
        setSelectedStaffId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live map data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        await loadGoogleMapsJs()
        if (cancelled) return
        if (!mapRef.current) return
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: -36.8485, lng: 174.7633 },
            zoom: 10,
            mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize map')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    fetchLiveLocations().catch(() => null)
    const timer = setInterval(() => {
      fetchLiveLocations().catch(() => null)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [open, fetchLiveLocations])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!open || !map || !(window as any).google?.maps) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    if (!staff.length) return

    const bounds = new (window as any).google.maps.LatLngBounds()
    for (const member of staff) {
      const initial = (member.staffName || '?').trim().charAt(0).toUpperCase() || '?'
      const marker = new (window as any).google.maps.Marker({
        map,
        position: {
          lat: member.location.latitude,
          lng: member.location.longitude,
        },
        title: member.staffName,
        label: {
          text: initial,
          color: '#ffffff',
          fontWeight: '700',
          fontSize: '12px',
        },
      })
      marker.addListener('click', () => {
        setSelectedStaffId(member.staffUserId)
      })
      markersRef.current.push(marker)
      bounds.extend(marker.getPosition())
    }
    map.fitBounds(bounds)
  }, [open, staff])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[88vw]">
        <DialogHeader>
          <DialogTitle>Delivery Run Live Map</DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex items-center justify-between gap-2 text-sm">
          <div>
            {fetchedAt ? `Last updated ${new Date(fetchedAt).toLocaleTimeString('en-NZ')}` : 'No delivery location data loaded yet'}
          </div>
          <Button variant="outline" onClick={() => fetchLiveLocations()} disabled={loading}>
            Refresh locations
          </Button>
        </div>

        {error ? <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div>
            <div ref={mapRef} className="h-[55vh] w-full rounded-lg border bg-slate-100" />
            {!staff.length && !loading ? (
              <p className="mt-2 text-sm text-muted-foreground">No drivers on an active delivery run right now.</p>
            ) : null}
          </div>
          <div className="space-y-3 overflow-auto">
            {selectedStaff ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">{selectedStaff.staffName}</p>
                <p className="text-xs font-medium text-blue-700">Active delivery run</p>
                <p>Last delivery location update: {new Date(selectedStaff.lastSeen).toLocaleString('en-NZ')}</p>
                <p>
                  Status:{' '}
                  <span className={getLastSeenAgeMs(selectedStaff.lastSeen) > STALE_AFTER_MS ? 'text-amber-700 font-medium' : 'text-green-700 font-medium'}>
                    {getLastSeenAgeMs(selectedStaff.lastSeen) > STALE_AFTER_MS
                      ? 'Stale (no update in 3+ min — open app or check Location → Always)'
                      : 'Live'}
                  </span>
                </p>
                {selectedStaff.deliveryRunStartedAt ? (
                  <p>Delivery run started: {new Date(selectedStaff.deliveryRunStartedAt).toLocaleString('en-NZ')}</p>
                ) : null}
                {selectedStaff.distanceFromBaseMeters !== null && selectedStaff.distanceFromBaseMeters !== undefined ? (
                  <p>
                    Distance from base: {formatDistance(selectedStaff.distanceFromBaseMeters)}
                    {selectedStaff.distanceFromBaseMeters <= RETURNING_TO_BASE_METERS ? (
                      <span className="ml-1 font-medium text-emerald-700">• Returning to base</span>
                    ) : null}
                  </p>
                ) : null}
                <p>Accuracy: {selectedStaff.location.accuracy ? `${Math.round(selectedStaff.location.accuracy)}m` : 'Unknown'}</p>
                <a
                  className="mt-2 inline-block text-blue-600 underline"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStaff.location.latitude},${selectedStaff.location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open directions
                </a>
              </div>
            ) : null}

            <div className="space-y-2">
              {staff.map((member) => (
                <button
                  key={member.staffUserId}
                  className={`w-full rounded-lg border p-2 text-left text-sm ${
                    selectedStaffId === member.staffUserId ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedStaffId(member.staffUserId)}
                >
                  <p className="font-medium">{member.staffName}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(member.lastSeen).toLocaleTimeString('en-NZ')} • {member.assignedOrders.length} assigned
                  </p>
                  <p className={`text-xs ${getLastSeenAgeMs(member.lastSeen) > STALE_AFTER_MS ? 'text-amber-700' : 'text-green-700'}`}>
                    {getLastSeenAgeMs(member.lastSeen) > STALE_AFTER_MS ? 'Stale update' : 'Live delivery update'}
                  </p>
                  {member.distanceFromBaseMeters !== null &&
                  member.distanceFromBaseMeters !== undefined &&
                  member.distanceFromBaseMeters <= RETURNING_TO_BASE_METERS ? (
                    <p className="text-xs font-medium text-emerald-700">Returning to base</p>
                  ) : null}
                  {member.currentDelivery ? (
                    <p className="text-xs text-muted-foreground">
                      Next: #{member.currentDelivery.orderNumber} {member.currentDelivery.deliveryTime || ''}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
