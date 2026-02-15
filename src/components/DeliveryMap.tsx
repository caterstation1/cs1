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
}

interface DeliveryMapProps {
  deliveryPoints: DeliveryPoint[]
  heightPx?: number
  allowAssignDriver?: boolean
  listHeightPx?: number
}

export default function DeliveryMap({ deliveryPoints, heightPx = 256, allowAssignDriver = false, listHeightPx }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryPoint | null>(null)
  const [assignFor, setAssignFor] = useState<string | null>(null) // orderId or orderNumber
  const [drivers, setDrivers] = useState<{ id: string; firstName: string; lastName: string; accessLevel: string }[]>([])
  const [driverForOrder, setDriverForOrder] = useState<Record<string, string>>({})
  const [savingDriver, setSavingDriver] = useState<string | null>(null)

  useEffect(() => {
    if (!allowAssignDriver) return
    const fetchDrivers = async () => {
      try {
        const res = await fetch('/api/staff')
        if (!res.ok) return
        const all = await res.json()
        const list = (Array.isArray(all) ? all : Array.isArray(all.staff) ? all.staff : []).filter((s: any) => {
          const acc = String(s.accessLevel || '').toLowerCase()
          return s.isDriver && acc !== 'wlg_team' && acc !== 'wlg_admin'
        }).map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, accessLevel: s.accessLevel }))
        setDrivers(list)
      } catch {}
    }
    fetchDrivers()
  }, [allowAssignDriver])

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-600" />
          Today&apos;s Deliveries Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Interactive Map */}
          <div 
            ref={mapRef} 
            className="w-full rounded-lg border bg-gray-50"
            style={{
              minHeight: `${Math.max(120, listHeightPx ? Math.max(120, heightPx - listHeightPx - 12) : heightPx)}px`,
              position: 'relative',
              height: `${Math.max(120, listHeightPx ? Math.max(120, heightPx - listHeightPx - 12) : heightPx)}px`
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
          <div className="space-y-2" style={listHeightPx ? { maxHeight: `${listHeightPx}px`, overflowY: 'auto' } : undefined}>
            <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-2">
              <span>Delivery Points ({deliveryPoints.length})</span>
              <span className="text-green-600">
                Total: {formatCurrency(deliveryPoints.reduce((sum, point) => sum + point.salesValue, 0))}
              </span>
            </div>
            
            {deliveryPoints.map((delivery, index) => (
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