'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, DollarSign } from 'lucide-react'

interface DeliveryPoint {
  orderId?: string
  orderNumber: string
  deliveryTime: string
  address: string
  coordinates: [number, number]
  salesValue: number
  // Optional richer fields (returned by /api/dashboard/deliveries-map) used
  // by the detailed side list on the calendar deliveries map.
  company?: string | null
  products?: { title: string; quantity: number }[]
  travelTime?: string | null
  driverId?: string | null
}

interface DeliveryMapProps {
  deliveryPoints: DeliveryPoint[]
  heightPx?: number
  allowAssignDriver?: boolean
  listHeightPx?: number
  /** 'bottom' (default, dashboard) or 'right' (detailed tiles beside the map) */
  listPosition?: 'bottom' | 'right'
  /** Kitchen address used to compute live travel-time estimates for the detailed list */
  originAddress?: string
}

// Delivery time (HH:mm) minus travel minutes, formatted as h:mm AM/PM.
function computeDispatchTime(deliveryTime: string, travelMinutes: number): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(deliveryTime || '').trim())
  if (!m || !Number.isFinite(travelMinutes)) return null
  let total = Number(m[1]) * 60 + Number(m[2]) - travelMinutes
  while (total < 0) total += 24 * 60
  const h = Math.floor(total / 60) % 24
  const min = total % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function DeliveryMap({ deliveryPoints, heightPx = 256, allowAssignDriver = false, listHeightPx, listPosition = 'bottom', originAddress }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryPoint | null>(null)
  const [assignFor, setAssignFor] = useState<string | null>(null) // orderId or orderNumber
  const [drivers, setDrivers] = useState<{ id: string; firstName: string; lastName: string; accessLevel: string }[]>([])
  const [driverForOrder, setDriverForOrder] = useState<Record<string, string>>({})
  const [savingDriver, setSavingDriver] = useState<string | null>(null)
  // Detailed-list state: live travel estimates + editable travel time drafts
  const [liveEstimates, setLiveEstimates] = useState<Record<string, number>>({})
  const [travelDrafts, setTravelDrafts] = useState<Record<string, string>>({})
  const [savedTravel, setSavedTravel] = useState<Record<string, string>>({})
  const [savingTravelFor, setSavingTravelFor] = useState<string | null>(null)

  const detailedList = listPosition === 'right'
  const pointKey = (p: DeliveryPoint) => p.orderId || p.orderNumber

  useEffect(() => {
    if (!allowAssignDriver) return
    const isWlg = !!originAddress && originAddress.toLowerCase().includes('wellington')
    const fetchDrivers = async () => {
      try {
        const res = await fetch('/api/staff')
        if (!res.ok) return
        const all = await res.json()
        const list = (Array.isArray(all) ? all : Array.isArray(all.staff) ? all.staff : []).filter((s: any) => {
          const acc = String(s.accessLevel || '').toLowerCase()
          const isWlgStaff = acc === 'wlg_team' || acc === 'wlg_admin'
          return s.isDriver && (isWlg ? isWlgStaff : !isWlgStaff)
        }).map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, accessLevel: s.accessLevel }))
        setDrivers(list)
      } catch {}
    }
    fetchDrivers()
  }, [allowAssignDriver, originAddress])

  // Seed driver selections and travel drafts from the loaded points
  useEffect(() => {
    if (!detailedList) return
    const driverSeed: Record<string, string> = {}
    const travelSeed: Record<string, string> = {}
    for (const p of deliveryPoints) {
      const key = pointKey(p)
      if (p.driverId) driverSeed[key] = p.driverId
      if (p.travelTime) travelSeed[key] = String(p.travelTime)
    }
    setDriverForOrder(prev => ({ ...driverSeed, ...prev }))
    setTravelDrafts(prev => ({ ...travelSeed, ...prev }))
    setSavedTravel(prev => ({ ...travelSeed, ...prev }))
  }, [detailedList, deliveryPoints])

  // Fetch live traffic-aware travel estimates for the detailed list
  useEffect(() => {
    if (!detailedList || !originAddress || deliveryPoints.length === 0) return
    let cancelled = false
    const queue = deliveryPoints.filter(p => p.address && p.address !== 'Unknown Address')
    const run = async () => {
      const workers = Array.from({ length: 4 }, async () => {
        while (queue.length > 0 && !cancelled) {
          const point = queue.shift()
          if (!point) break
          try {
            const res = await fetch(
              `/api/maps/travel-time?origin=${encodeURIComponent(originAddress)}&destination=${encodeURIComponent(point.address)}`
            )
            const data = await res.json().catch(() => ({}))
            if (!cancelled && res.ok && Number(data.durationInMinutes) > 0) {
              setLiveEstimates(prev => ({ ...prev, [pointKey(point)]: Number(data.durationInMinutes) }))
            }
          } catch {}
        }
      })
      await Promise.all(workers)
    }
    run()
    return () => { cancelled = true }
  }, [detailedList, originAddress, deliveryPoints])

  const assignDriver = async (point: DeliveryPoint, driverId: string) => {
    if (!point.orderId) return
    const key = pointKey(point)
    setDriverForOrder(prev => ({ ...prev, [key]: driverId }))
    if (!driverId) return
    try {
      setSavingDriver(key)
      const res = await fetch(`/api/orders/${point.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId })
      })
      if (!res.ok) alert('Failed to assign driver')
    } finally {
      setSavingDriver(null)
    }
  }

  const saveTravelTime = async (point: DeliveryPoint) => {
    if (!point.orderId) return
    const key = pointKey(point)
    const value = String(travelDrafts[key] ?? '').trim()
    if (!value || value === (savedTravel[key] || '')) return
    try {
      setSavingTravelFor(key)
      const res = await fetch(`/api/orders/${point.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ travelTime: value })
      })
      if (res.ok) {
        setSavedTravel(prev => ({ ...prev, [key]: value }))
      } else {
        alert('Failed to save travel time')
      }
    } finally {
      setSavingTravelFor(null)
    }
  }

  useEffect(() => {
    // Load Google Maps API
    const loadGoogleMaps = () => {
      console.log('🗺️ Loading Google Maps...')
      console.log('🔑 API Key:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Set' : 'NOT SET')
      
      if ((window as any).google && (window as any).google.maps) {
        console.log('✅ Google Maps already loaded')
        initializeMap()
        return
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        console.log('⏳ Google Maps script already loading')
        return
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.error('❌ Google Maps API key not found!')
        console.log('💡 Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables')
        // Show fallback content
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div class="flex items-center justify-center h-full bg-gray-100 rounded-lg">
              <div class="text-center">
                <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p class="text-gray-600">Map unavailable</p>
                <p class="text-sm text-gray-500">Google Maps API key not configured</p>
              </div>
            </div>
          `
        }
        return
      }

      console.log('📡 Loading Google Maps script...')
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta`
      script.async = true
      script.defer = true
      script.onload = () => {
        console.log('✅ Google Maps script loaded successfully')
        initializeMap()
      }
      script.onerror = () => {
        console.error('❌ Failed to load Google Maps script')
        // Show fallback content
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div class="flex items-center justify-center h-full bg-gray-100 rounded-lg">
              <div class="text-center">
                <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p class="text-gray-600">Map unavailable</p>
                <p class="text-sm text-gray-500">Please check your Google Maps API key</p>
              </div>
            </div>
          `
        }
      }
      document.head.appendChild(script)
    }

    const initializeMap = () => {
      console.log('🗺️ Initializing map...')
      if (!mapRef.current) {
        console.error('❌ Map ref not found')
        return
      }
      if (!(window as any).google) {
        console.error('❌ Google Maps not loaded')
        // Show fallback content
        mapRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full bg-gray-100 rounded-lg">
            <div class="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p class="text-gray-600">Map unavailable</p>
              <p class="text-sm text-gray-500">Google Maps failed to load</p>
            </div>
          </div>
        `
        return
      }

      // Default to Auckland if no delivery points
      const defaultCenter = deliveryPoints.length > 0 
        ? { lat: deliveryPoints[0].coordinates[0], lng: deliveryPoints[0].coordinates[1] }
        : { lat: -36.8485, lng: 174.7633 }

      console.log('📍 Map center:', defaultCenter)
      console.log('📊 Delivery points:', deliveryPoints.length)

      // Clear any existing content
      if (mapRef.current) {
        mapRef.current.innerHTML = ''
      }

      const mapInstance = new (window as any).google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 11,
        mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })
      
      // Force map resize after initialization
      setTimeout(() => {
        if (mapInstance) {
          (window as any).google.maps.event.trigger(mapInstance, 'resize')
          mapInstance.setCenter(defaultCenter)
          console.log('✅ Map resized and centered')
          
          // Additional debugging
          console.log('🗺️ Map container dimensions:', {
            width: mapRef.current?.offsetWidth,
            height: mapRef.current?.offsetHeight,
            clientWidth: mapRef.current?.clientWidth,
            clientHeight: mapRef.current?.clientHeight
          })
        }
      }, 200)

      console.log('✅ Map initialized successfully')
      setMap(mapInstance)
    }

    loadGoogleMaps()
  }, [deliveryPoints])

  useEffect(() => {
    if (!map || deliveryPoints.length === 0) {
      console.log('⚠️ Map or delivery points not ready:', { map: !!map, points: deliveryPoints.length })
      return
    }

    console.log('📍 Creating markers for', deliveryPoints.length, 'delivery points')

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null))

    const newMarkers: any[] = []

    deliveryPoints.forEach((point, index) => {
      console.log(`📍 Creating marker ${index + 1} for order #${point.orderNumber} at`, point.coordinates)
      const marker = new (window as any).google.maps.Marker({
        position: { lat: point.coordinates[0], lng: point.coordinates[1] },
        map: map,
        title: `Order #${point.orderNumber}`,
        label: {
          text: `${index + 1}`,
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      })

      const infoWindow = new (window as any).google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: bold;">
              Order #${point.orderNumber}
            </h3>
            <p style="margin: 4px 0; color: #6B7280; font-size: 12px;">
              <strong>Time:</strong> ${point.deliveryTime}
            </p>
            <p style="margin: 4px 0; color: #6B7280; font-size: 12px;">
              <strong>Address:</strong> ${point.address}
            </p>
            <p style="margin: 4px 0; color: #059669; font-size: 12px; font-weight: bold;">
              <strong>Value:</strong> $${point.salesValue.toFixed(2)}
            </p>
          </div>
        `
      })

      marker.addListener('click', () => {
        infoWindow.open(map, marker)
        setSelectedDelivery(point)
      })

      newMarkers.push(marker)
    })

    setMarkers(newMarkers)

    // Fit bounds to show all markers
    if (newMarkers.length > 0) {
      const bounds = new (window as any).google.maps.LatLngBounds()
      newMarkers.forEach(marker => bounds.extend(marker.getPosition()!))
      map.fitBounds(bounds)
    }
  }, [map, deliveryPoints])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount)
  }

  const mapHeightPx = detailedList
    ? Math.max(240, heightPx)
    : Math.max(120, listHeightPx ? Math.max(120, heightPx - listHeightPx - 12) : heightPx)

  const renderDetailedTile = (delivery: DeliveryPoint, index: number) => {
    const key = pointKey(delivery)
    const estimate = liveEstimates[key]
    const draft = travelDrafts[key] ?? ''
    const travelMinutes = parseInt(draft, 10)
    const dispatchTime = Number.isFinite(travelMinutes) && travelMinutes > 0
      ? computeDispatchTime(delivery.deliveryTime, travelMinutes)
      : null
    const isDirty = String(draft).trim() !== (savedTravel[key] || '')
    return (
      <div
        key={key}
        className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-2 ${
          selectedDelivery && pointKey(selectedDelivery) === key
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
        onClick={() => setSelectedDelivery(delivery)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs shrink-0">
              {index + 1}
            </Badge>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate" title={delivery.company || undefined}>
                {delivery.company || `Order #${delivery.orderNumber}`}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                #{delivery.orderNumber}
                <Clock className="h-3 w-3 ml-1" />
                {delivery.deliveryTime}
              </div>
            </div>
          </div>
          <div className="font-medium text-green-600 text-sm shrink-0">
            {formatCurrency(delivery.salesValue)}
          </div>
        </div>

        {Array.isArray(delivery.products) && delivery.products.length > 0 && (
          <div className="text-xs text-gray-700 max-h-20 overflow-y-auto space-y-0.5 border-l-2 border-gray-200 pl-2">
            {delivery.products.map((product, i) => (
              <div key={i} className="truncate" title={product.title}>
                {product.quantity}&times; {product.title}
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-600">{delivery.address}</div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1" onClick={e => e.stopPropagation()}>
          {allowAssignDriver && (
            <label className="flex items-center gap-1 text-xs text-gray-600">
              Driver
              <select
                className="border rounded px-1.5 py-1 text-xs max-w-[130px]"
                value={driverForOrder[key] || ''}
                disabled={savingDriver === key}
                onChange={(e) => void assignDriver(delivery, e.target.value)}
              >
                <option value="">Select…</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                ))}
              </select>
              {savingDriver === key && <span className="text-gray-400">…</span>}
            </label>
          )}
          <span className="text-xs text-gray-600">
            Est:{' '}
            {estimate ? (
              <button
                className="font-medium text-blue-700 underline decoration-dotted underline-offset-2"
                title="Use this estimate as the travel time"
                onClick={() => setTravelDrafts(prev => ({ ...prev, [key]: String(estimate) }))}
              >
                {estimate} min
              </button>
            ) : (
              <span className="text-gray-400">…</span>
            )}
          </span>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            Travel
            <input
              type="number"
              min={0}
              className={`border rounded px-1.5 py-1 text-xs w-14 ${isDirty ? 'border-amber-400 bg-amber-50' : ''}`}
              value={draft}
              placeholder="min"
              disabled={savingTravelFor === key}
              onChange={(e) => setTravelDrafts(prev => ({ ...prev, [key]: e.target.value }))}
              onBlur={() => void saveTravelTime(delivery)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
            min
            {savingTravelFor === key && <span className="text-gray-400">…</span>}
          </label>
          <span className="text-xs text-gray-600">
            Dispatch: <span className="font-semibold text-gray-800">{dispatchTime || '—'}</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-600" />
          Today&apos;s Deliveries Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={detailedList ? 'flex gap-4 items-start' : 'space-y-4'}>
          {/* Interactive Map */}
          <div 
            ref={mapRef} 
            className={`rounded-lg border bg-gray-50 ${detailedList ? 'flex-1' : 'w-full'}`}
            style={{
              minHeight: `${mapHeightPx}px`,
              position: 'relative',
              height: `${mapHeightPx}px`
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading map...</p>
              </div>
            </div>
          </div>
          
          {/* Delivery List */}
          <div
            className={detailedList ? 'w-[400px] shrink-0 space-y-2 overflow-y-auto pr-1' : 'space-y-2'}
            style={detailedList
              ? { maxHeight: `${mapHeightPx}px` }
              : (listHeightPx ? { maxHeight: `${listHeightPx}px`, overflowY: 'auto' } : undefined)}
          >
            <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-2">
              <span>Delivery Points ({deliveryPoints.length})</span>
              <span className="text-green-600">
                Total: {formatCurrency(deliveryPoints.reduce((sum, point) => sum + point.salesValue, 0))}
              </span>
            </div>
            
            {detailedList
              ? deliveryPoints.map((delivery, index) => renderDetailedTile(delivery, index))
              : deliveryPoints.map((delivery, index) => (
              <div 
                key={delivery.orderNumber}
                className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDelivery?.orderNumber === delivery.orderNumber 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => setSelectedDelivery(delivery)}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                    {index + 1}
                  </Badge>
                  <div>
                    <div className="font-medium text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (allowAssignDriver) {
                            const key = delivery.orderId || delivery.orderNumber
                            setAssignFor(prev => prev === key ? null : key)
                          }
                        }}
                        className="underline underline-offset-2 decoration-dotted hover:text-blue-700"
                        title={allowAssignDriver ? 'Assign driver' : undefined}
                      >
                        #{delivery.orderNumber}
                      </button>
                    </div>
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {delivery.deliveryTime}
                    </div>
                    {allowAssignDriver && (assignFor === (delivery.orderId || delivery.orderNumber)) && (
                      <div className="mt-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <select
                          className="border rounded px-2 py-1 text-xs"
                          value={driverForOrder[delivery.orderId || delivery.orderNumber] || ''}
                          onChange={(e) => {
                            const key = delivery.orderId || delivery.orderNumber
                            setDriverForOrder(prev => ({ ...prev, [key]: e.target.value }))
                          }}
                        >
                          <option value="">Select driver…</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                          ))}
                        </select>
                        <button
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                          disabled={!driverForOrder[delivery.orderId || delivery.orderNumber] || !!savingDriver}
                          onClick={async () => {
                            const key = delivery.orderId || delivery.orderNumber
                            const chosen = driverForOrder[key]
                            if (!chosen) return
                            if (!delivery.orderId) {
                              alert('Order ID not available for assignment')
                              return
                            }
                            try {
                              setSavingDriver(key)
                              const res = await fetch(`/api/orders/${delivery.orderId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ driverId: chosen })
                              })
                              if (!res.ok) {
                                alert('Failed to assign driver')
                              } else {
                                setAssignFor(null)
                              }
                            } finally {
                              setSavingDriver(null)
                            }
                          }}
                        >
                          {savingDriver ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-green-600 text-sm">
                    {formatCurrency(delivery.salesValue)}
                  </div>
                  <div className="text-xs text-gray-500 truncate max-w-[120px]">
                    {delivery.address}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 