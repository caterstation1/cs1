'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, DollarSign } from 'lucide-react'

interface DeliveryPoint {
  orderNumber: string
  deliveryTime: string
  address: string
  coordinates: [number, number]
  salesValue: number
}

interface DeliveryMapProps {
  deliveryPoints: DeliveryPoint[]
}

export default function DeliveryMap({ deliveryPoints }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryPoint | null>(null)

  useEffect(() => {
    // Load Google Maps API with proper async pattern
    const loadGoogleMaps = async () => {
      if ((window as any).google && (window as any).google.maps) {
        initializeMap()
        return
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        return
      }

      return new Promise<void>((resolve) => {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`
        script.async = true
        script.defer = true
        
        // Set up global callback
        ;(window as any).initMap = () => {
          initializeMap()
          resolve()
        }
        
        script.onerror = () => {
          console.error('Failed to load Google Maps API')
          resolve()
        }
        
        document.head.appendChild(script)
      })
    }

    const initializeMap = () => {
      if (!mapRef.current || !(window as any).google) return

      // Default to Auckland if no delivery points
      const defaultCenter = deliveryPoints.length > 0 
        ? { lat: deliveryPoints[0].coordinates[0], lng: deliveryPoints[0].coordinates[1] }
        : { lat: -36.8485, lng: 174.7633 }

      const mapInstance = new (window as any).google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 11,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })

      setMap(mapInstance)
    }

    loadGoogleMaps()
  }, [deliveryPoints])

  useEffect(() => {
    if (!map || deliveryPoints.length === 0) return

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null))

    const newMarkers: any[] = []

    deliveryPoints.forEach((point, index) => {
      // Create marker element
      const markerElement = document.createElement('div')
      markerElement.innerHTML = `
        <div style="
          width: 32px; 
          height: 32px; 
          background: #EF4444; 
          border: 2px solid white; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          color: white; 
          font-weight: bold; 
          font-size: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${index + 1}
        </div>
      `

      const marker = new (window as any).google.maps.marker.AdvancedMarkerElement({
        position: { lat: point.coordinates[0], lng: point.coordinates[1] },
        map: map,
        title: `Order #${point.orderNumber}`,
        content: markerElement
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
      newMarkers.forEach(marker => bounds.extend(marker.position))
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
            className="h-64 w-full rounded-lg border"
            style={{ minHeight: '256px' }}
          />
          
          {/* Delivery List */}
          <div className="space-y-2">
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
                    <div className="font-medium text-sm">#{delivery.orderNumber}</div>
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {delivery.deliveryTime}
                    </div>
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