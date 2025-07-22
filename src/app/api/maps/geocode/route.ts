import { NextRequest, NextResponse } from 'next/server';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 50; // Maximum requests per window
const requestTimestamps: number[] = [];

export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    // Remove old timestamps
    while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
      requestTimestamps.shift();
    }
    
    // Check if we've exceeded the rate limit
    if (requestTimestamps.length >= MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    // Add current request timestamp
    requestTimestamps.push(now);
    
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }
    
    // Get Google Maps API key from environment variables
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key is not configured' },
        { status: 500 }
      );
    }
    
    // Call Google Maps Geocoding API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch from Google Maps API');
    }
    
    const data = await response.json();
    
    // Check if the API returned valid results
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return NextResponse.json(
        { error: `Geocoding failed: ${data.status}` },
        { status: 400 }
      );
    }
    
    // Extract coordinates from the first result
    const location = data.results[0].geometry.location;
    
    return NextResponse.json({
      lat: location.lat,
      lng: location.lng,
      formattedAddress: data.results[0].formatted_address
    });
  } catch (error) {
    console.error('Error in geocode API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to geocode address' },
      { status: 500 }
    );
  }
} 