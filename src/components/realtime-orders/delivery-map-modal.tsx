'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

// Create a shared geocoding cache at the module level
const geocodingCache: Record<string, {lat: number, lng: number, formattedAddress: string}> = {};

// Static origin address and coordinates
const ORIGIN_ADDRESS = '562 Richmond Road, Grey Lynn, Auckland';
const ORIGIN_COORDINATES = {
  lat: -36.8675,
  lng: 174.7375,
  formattedAddress: ORIGIN_ADDRESS
};

interface DeliveryMapModalProps {
  isOpen: boolean
  onClose: () => void
  deliveryAddress: string
  orderId: string
  onUpdateTravelTime: (orderId: string, travelTime: number) => void
  hasManualTravelTime: boolean
}

export default function DeliveryMapModal({
  isOpen,
  onClose,
  deliveryAddress,
  orderId,
  onUpdateTravelTime,
  hasManualTravelTime
}: DeliveryMapModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [travelTime, setTravelTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Get coordinates for street view
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  
  // Calculate heading when both coordinates are available
  const [heading, setHeading] = useState<number>(210); // Default heading
  
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

  useEffect(() => {
    if (coordinates) {
      const calculatedHeading = calculateHeading(ORIGIN_COORDINATES, coordinates);
      setHeading(calculatedHeading);
    }
  }, [coordinates]);

  // Get coordinates for street view - only when modal is opened and delivery address changes
  useEffect(() => {
    let isMounted = true;
    
    const getCoordinates = async () => {
      if (isOpen && deliveryAddress && !coordinates) {
        const result = await geocodeAddress(deliveryAddress);
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
  }, [isOpen, deliveryAddress]); // Remove coordinates from dependencies

  // Fetch travel time only when modal is opened and delivery address changes
  useEffect(() => {
    let isMounted = true;
    
    if (isOpen && deliveryAddress) {
      fetchTravelTime();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isOpen, deliveryAddress]);

  // Fetch travel time from Google Maps API
  const fetchTravelTime = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🛣️ Fetching travel time from', ORIGIN_ADDRESS, 'to', deliveryAddress);
      
      const response = await fetch(`/api/maps/travel-time?origin=${encodeURIComponent(ORIGIN_ADDRESS)}&destination=${encodeURIComponent(deliveryAddress)}`);
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
        
        <div className="flex flex-col gap-4 mt-4">
          {/* Google Maps Route View and Street View - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Maps Route View */}
            <div className="h-80 bg-gray-100 rounded-md overflow-hidden">
              {isLoading ? (
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
                  src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(ORIGIN_ADDRESS)}&destination=${encodeURIComponent(deliveryAddress)}&mode=driving`}
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
          
          {/* Travel Time Estimate - Full Width Below */}
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
              <p>From: {ORIGIN_ADDRESS}</p>
              <p>To: {deliveryAddress}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 