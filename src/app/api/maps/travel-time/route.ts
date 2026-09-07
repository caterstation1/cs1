import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')
  
  if (!origin || !destination) {
    return NextResponse.json(
      { error: 'Origin and destination addresses are required' },
      { status: 400 }
    )
  }
  
  try {
    // Get Google Maps API key from environment variables
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    
    if (!apiKey) {
      console.error('Google Maps API key is not configured')
      return NextResponse.json(
        { error: 'Google Maps API key is not configured. Please check your environment variables.' },
        { status: 500 }
      )
    }
    
    // Use the Directions API (not Distance Matrix) so the estimate comes from
    // the same routing engine as the embedded directions map in the delivery
    // modal. departure_time=now makes Google include duration_in_traffic.
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&departure_time=now&key=${apiKey}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CaterStation/1.0'
      }
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error('Google Maps API error:', data)
      return NextResponse.json(
        { error: `Google Maps API error: ${data.error_message || response.statusText}` },
        { status: response.status }
      )
    }
    
    // Check if the API returned valid results
    if (data.status !== 'OK') {
      console.error('Google Maps API status error:', data.status, data.error_message)
      return NextResponse.json(
        { error: `Google Maps API error: ${data.status}` },
        { status: 400 }
      )
    }
    
    // Directions returns the best route first; sum legs (single leg for A->B).
    const legs = data.routes?.[0]?.legs
    if (!Array.isArray(legs) || legs.length === 0 || !legs[0]?.duration) {
      console.error('No route legs in response:', data)
      return NextResponse.json(
        { error: 'Could not calculate travel time for the given addresses. Please check if the addresses are valid.' },
        { status: 400 }
      )
    }

    let baseSeconds = 0
    let trafficSeconds = 0
    let hasTraffic = true
    for (const leg of legs) {
      baseSeconds += Number(leg.duration?.value || 0)
      if (typeof leg.duration_in_traffic?.value === 'number') {
        trafficSeconds += leg.duration_in_traffic.value
      } else {
        hasTraffic = false
      }
    }

    // Round to nearest minute (like Google's own display) rather than ceil,
    // so the number matches the ETA shown on the embedded map.
    const toMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))
    const baseDurationInMinutes = toMinutes(baseSeconds)
    const withTraffic = hasTraffic && trafficSeconds > 0
    const durationInMinutes = withTraffic ? toMinutes(trafficSeconds) : baseDurationInMinutes
    console.log('Calculated duration in minutes:', durationInMinutes, withTraffic ? '(with traffic)' : '(no traffic data)')
    
    return NextResponse.json({ durationInMinutes, baseDurationInMinutes, withTraffic })
  } catch (error) {
    console.error('Error fetching travel time:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred while fetching travel time' },
      { status: 500 }
    )
  }
}
