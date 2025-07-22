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
    
    // Log the API key (first few characters only for security)
    console.log('Using API key:', apiKey.substring(0, 10) + '...')
    
    // Fetch travel time from Google Maps Distance Matrix API
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${apiKey}`
    console.log('Fetching travel time from:', url)
    
    // Use the global fetch API with proper headers
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CaterStation/1.0'
      }
    })
    
    const data = await response.json()
    
    // Log the API response for debugging
    console.log('Google Maps API response:', JSON.stringify(data, null, 2))
    
    if (!response.ok) {
      console.error('Google Maps API error:', data)
      return NextResponse.json(
        { error: `Google Maps API error: ${data.error_message || response.statusText}` },
        { status: response.status }
      )
    }
    
    // Check if the API returned valid results
    if (data.status !== 'OK') {
      console.error('Google Maps API status error:', data.status)
      return NextResponse.json(
        { error: `Google Maps API error: ${data.status}` },
        { status: 400 }
      )
    }
    
    if (!data.rows?.[0]?.elements?.[0]?.duration) {
      console.error('No duration data in response:', data)
      return NextResponse.json(
        { error: 'Could not calculate travel time for the given addresses. Please check if the addresses are valid.' },
        { status: 400 }
      )
    }
    
    // Extract duration in minutes
    const durationInMinutes = Math.ceil(data.rows[0].elements[0].duration.value / 60)
    console.log('Calculated duration in minutes:', durationInMinutes)
    
    return NextResponse.json({ durationInMinutes })
  } catch (error) {
    console.error('Error fetching travel time:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred while fetching travel time' },
      { status: 500 }
    )
  }
} 