'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

// Create a shared geocoding cache at the module level
const geocodingCache: Record<string, {lat: number, lng: number, formattedAddress: string}> = {};

// Default origin address
const DEFAULT_ORIGIN_ADDRESS = '562 Richmond Road, Grey Lynn, Auckland 1021';
const ORIGIN_COORDINATES = {
  lat: -36.8675,
  lng: 174.7375,
  formattedAddress: DEFAULT_ORIGIN_ADDRESS
};

interface Stop {
  orderId: string
  orderNumber: number
  customerName: string
  deliveryTime: string
  address: string
}

interface DeliveryMapModalProps {
  isOpen: boolean
  onClose: () => void
  deliveryAddress: string
  orderId: string
  onUpdateTravelTime: (orderId: string, travelTime: number) => void
  hasManualTravelTime: boolean
  originAddressOverride?: string
  driverId?: string
  deliveryDate?: string
  deliveryTime?: string
  leaveTime?: string
  orderNumber?: number
  customerName?: string
}

export default function DeliveryMapModal({
  isOpen,
  onClose,
  deliveryAddress,
  orderId,
  onUpdateTravelTime,
  hasManualTravelTime,
  originAddressOverride,
  driverId,
  deliveryDate,
  deliveryTime,
  leaveTime,
  orderNumber,
  customerName
}: DeliveryMapModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [travelTime, setTravelTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Get coordinates for street view
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  
  // Calculate heading when both coordinates are available
  const [heading, setHeading] = useState<number>(210); // Default heading

  // Driver run mode state
  const [mode, setMode] = useState<'single' | 'run'>('single')
  const [driverRunStops, setDriverRunStops] = useState<Stop[]>([])
  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0)
  const [isLoadingDriverRun, setIsLoadingDriverRun] = useState(false)
  const [driverRunError, setDriverRunError] = useState<string | null>(null)

  // Compute the effective origin once per render
  const origin = originAddressOverride || DEFAULT_ORIGIN_ADDRESS;

  // Reset mode to 'single' when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('single')
      setDriverRunStops([])
      setSelectedStopIndex(0)
      setDriverRunError(null)
    }
  }, [isOpen])
  
  // Function to geocode an address to get coordinates
  const geocodeAddress = async (address: string) => {
    // Check cache first
    if (geocodingCache[address]) {
      return geocodingCache[address];
    }
    
    try {
      console.log('📍 Geocoding address:', address);
      
      const response = await fetch(`/api/maps/geocode?address=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (!response.ok) {
        // Check if it's a billing issue
        if (data.error && data.error.includes('REQUEST_DENIED')) {
          throw new Error('Google Maps API billing not enabled. Please contact your administrator to enable billing for the Google Maps API.');
        }
        throw new Error('Failed to geocode address');
      }
      
      // Cache the result
      geocodingCache[address] = data;
      
      console.log('✅ Geocoded address:', data);
      return data;
    } catch (error) {
      console.error('❌ Error geocoding address:', error);
      return null;
    }
  };

  // Function to calculate heading between two points
  const calculateHeading = (origin: {lat: number, lng: number}, destination: {lat: number, lng: number}) => {
    // Convert to radians
    const lat1 = origin.lat * Math.PI / 180;
    const lat2 = destination.lat * Math.PI / 180;
    const lng1 = origin.lng * Math.PI / 180;
    const lng2 = destination.lng * Math.PI / 180;
    
    // Calculate heading
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    
    // Normalize to 0-360
    heading = (heading + 360) % 360;
    
    return Math.round(heading);
  };

  // Helper function to build Google Directions URL with waypoints using Embed API
  const buildDirectionsUrl = (origin: string, stops: Stop[]): string => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (stops.length === 0) {
      return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(origin)}&mode=driving`
    }
    
    if (stops.length === 1) {
      // Single stop - no waypoints needed
      return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(stops[0].address)}&mode=driving`
    }
    
    // Multiple stops - use waypoints
    // For Embed API, waypoints should be pipe-separated and each address URL encoded
    const destination = stops[stops.length - 1].address
    const waypoints = stops.slice(0, -1).map(stop => encodeURIComponent(stop.address)).join('|')
    
    return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${waypoints}&mode=driving`
  }

  // Fetch driver run data
  const fetchDriverRun = async () => {
    if (!driverId || !deliveryDate || !leaveTime) {
      setDriverRunError('Missing driver, date, or dispatch time information')
      return
    }

    setIsLoadingDriverRun(true)
    setDriverRunError(null)

    try {
      const response = await fetch(
        `/api/orders/driver-run?date=${encodeURIComponent(deliveryDate)}&driverId=${encodeURIComponent(driverId)}&leaveTime=${encodeURIComponent(leaveTime)}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch driver run')
      }

      if (data.stops.length === 0) {
        setDriverRunError('No additional stops found for this driver run')
        setMode('single') // Stay in single mode
        return
      }

      // Limit to 10 stops (Google waypoint limit)
      const limitedStops = data.stops.slice(0, 10)
      setDriverRunStops(limitedStops)
      setSelectedStopIndex(0) // Select first stop

      // If more than 10 stops, show note (handled in UI)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch driver run'
      console.error('❌ Error fetching driver run:', err)
      setDriverRunError(errorMessage)
      setMode('single') // Fallback to single mode on error
    } finally {
      setIsLoadingDriverRun(false)
    }
  }

  // Handle mode switch
  const handleModeSwitch = (newMode: 'single' | 'run') => {
    setMode(newMode)
    if (newMode === 'run') {
      fetchDriverRun()
    } else {
      // Reset to single delivery view
      setDriverRunStops([])
      setSelectedStopIndex(0)
      setDriverRunError(null)
    }
  }

  useEffect(() => {
    if (coordinates) {
      const calculatedHeading = calculateHeading(ORIGIN_COORDINATES, coordinates);
      setHeading(calculatedHeading);
    }
  }, [coordinates]);

  // Get coordinates for street view - update based on mode and selected stop
  useEffect(() => {
    let isMounted = true;
    
    const getCoordinates = async () => {
      if (!isOpen) return

      let addressToUse = deliveryAddress
      
      // In run mode, use selected stop's address
      if (mode === 'run' && driverRunStops.length > 0 && selectedStopIndex < driverRunStops.length) {
        addressToUse = driverRunStops[selectedStopIndex].address
      }

      if (addressToUse) {
        const result = await geocodeAddress(addressToUse);
        if (isMounted && result && result.lat && result.lng) {
          setCoordinates(result);
        } else if (isMounted) {
          setError('Could not get coordinates for street view');
        }
      }
    };
    
    getCoordinates();
    
    return () => {
      isMounted = false;
    };
  }, [isOpen, deliveryAddress, mode, driverRunStops, selectedStopIndex]); // Update when mode or selected stop changes

  // Fetch travel time only when modal is opened and delivery address changes
  useEffect(() => {
    let isMounted = true;
    
    if (isOpen && deliveryAddress) {
      fetchTravelTime();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isOpen, deliveryAddress, originAddressOverride]);

  // Fetch travel time from Google Maps API
  const fetchTravelTime = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🛣️ Fetching travel time from', origin, 'to', deliveryAddress);
      
      const response = await fetch(`/api/maps/travel-time?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(deliveryAddress)}`);
      const data = await response.json();
      
      if (!response.ok) {
        // Check if it's a billing issue
        if (data.error && data.error.includes('REQUEST_DENIED')) {
          throw new Error('Google Maps API billing not enabled. Please contact your administrator to enable billing for the Google Maps API.');
        }
        throw new Error(data.error || 'Failed to fetch travel time');
      }
      
      if (!data.durationInMinutes) {
        throw new Error('Could not calculate travel time for the given addresses');
      }
      
      console.log('✅ Travel time calculated:', data.durationInMinutes, 'minutes');
      setTravelTime(data.durationInMinutes);
      
      // Update the order's travel time if it wasn't manually set
      if (!hasManualTravelTime) {
        onUpdateTravelTime(orderId, data.durationInMinutes);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching travel time';
      console.error('❌ Error in fetchTravelTime:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle manual travel time input
  const handleManualTravelTime = (minutes: number) => {
    setTravelTime(minutes)
    if (!hasManualTravelTime) {
      onUpdateTravelTime(orderId, minutes)
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Delivery Information</DialogTitle>
          <DialogDescription>
            View delivery route, street view, and travel time information
          </DialogDescription>
        </DialogHeader>

        {/* Toggle Button Group - Only show if driverId exists */}
        {driverId && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleModeSwitch('single')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              This delivery
            </button>
            <button
              onClick={() => handleModeSwitch('run')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'run'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Driver run
            </button>
          </div>
        )}
        
        <div className="flex flex-col gap-4 mt-4">
          {/* Google Maps Route View and Street View - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Maps Route View */}
            <div className="h-80 bg-gray-100 rounded-md overflow-hidden">
              {mode === 'run' && isLoadingDriverRun ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : mode === 'run' && driverRunError ? (
                <div className="flex items-center justify-center h-full p-4 text-center">
                  <div className="text-red-500">
                    <div className="font-semibold mb-2">Driver Run Unavailable</div>
                    <div className="text-sm text-gray-600">{driverRunError}</div>
                  </div>
                </div>
              ) : mode === 'run' && driverRunStops.length > 0 ? (
                <iframe
                  src={buildDirectionsUrl(origin, driverRunStops)}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full p-4 text-center">
                  <div className="text-red-500">
                    <div className="font-semibold mb-2">Maps Unavailable</div>
                    <div className="text-sm text-gray-600">
                      {error.includes('billing not enabled') ? (
                        <>
                          Google Maps API requires billing to be enabled.<br/>
                          Please contact your administrator to set up billing.
                        </>
                      ) : (
                        error
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <iframe
                  src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(deliveryAddress)}&mode=driving`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
            </div>
            
            {/* Google Street View */}
            <div className="h-80 bg-gray-100 rounded-md overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full p-4 text-center">
                  <div className="text-red-500">
                    <div className="font-semibold mb-2">Street View Unavailable</div>
                    <div className="text-sm text-gray-600">
                      {error.includes('billing not enabled') ? (
                        <>
                          Google Maps API requires billing to be enabled.<br/>
                          Please contact your administrator to set up billing.
                        </>
                      ) : (
                        error
                      )}
                    </div>
                  </div>
                </div>
              ) : coordinates ? (
                <iframe
                  src={`https://www.google.com/maps/embed/v1/streetview?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&location=${coordinates.lat},${coordinates.lng}&heading=${heading}&pitch=10&fov=90&radius=50`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Loading street view...
                </div>
              )}
            </div>
          </div>

          {/* Stop List - Only shown in run mode */}
          {mode === 'run' && driverRunStops.length > 0 && (
            <div className="bg-gray-50 rounded-md p-4 max-h-64 overflow-y-auto">
              <h3 className="text-lg font-medium mb-3">Driver Run Stops</h3>
              {driverRunStops.length > 10 && (
                <div className="mb-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  Showing first 10 stops (Google waypoint limit)
                </div>
              )}
              <div className="space-y-2">
                {driverRunStops.map((stop, index) => {
                  // Extract short address (address1 + city)
                  const addressParts = stop.address.split(',').map(s => s.trim())
                  const shortAddress = addressParts.length >= 2 
                    ? `${addressParts[0]}, ${addressParts[addressParts.length - 2]}` 
                    : stop.address

                  return (
                    <div
                      key={stop.orderId}
                      onClick={() => setSelectedStopIndex(index)}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${
                        selectedStopIndex === index
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-white border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold">Order #{stop.orderNumber}</span>
                            <span className="text-sm text-gray-600">{stop.deliveryTime}</span>
                          </div>
                          <div className="text-sm text-gray-700 mt-1">{shortAddress}</div>
                          {stop.customerName && stop.customerName !== 'Unknown Customer' && (
                            <div className="text-xs text-gray-500 mt-1">{stop.customerName}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Travel Time Estimate - Full Width Below */}
          {mode === 'single' && (
            <div className="h-40 bg-gray-100 rounded-md p-4 flex flex-col">
            <h3 className="text-lg font-medium mb-2">Travel Time Estimate</h3>
            <div className="flex-1 flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              ) : error ? (
                <div className="text-red-500">
                  <p>{error}</p>
                  <p className="text-sm mt-2">You can manually set the travel time:</p>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={travelTime || ''}
                    onChange={(e) => handleManualTravelTime(parseInt(e.target.value) || 0)}
                    className="mt-2 p-2 border rounded w-20 text-center"
                    placeholder="mins"
                  />
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">{travelTime}</div>
                  <div className="text-gray-600 mt-1">minutes</div>
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-500">
              <p>From: {origin}</p>
              <p>To: {deliveryAddress}</p>
            </div>
          </div>
          )}
          {mode === 'run' && driverRunStops.length > 0 && (
            <div className="bg-gray-100 rounded-md p-4">
              <h3 className="text-lg font-medium mb-2">Multi-Stop Route</h3>
              <div className="text-sm text-gray-600">
                <p>From: {origin}</p>
                <p>Stops: {driverRunStops.length} delivery{driverRunStops.length !== 1 ? 'ies' : 'y'}</p>
                <p className="mt-2 text-xs text-gray-500">Click on stops above to view Street View</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 