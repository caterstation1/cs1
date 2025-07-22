import { NextRequest, NextResponse } from 'next/server'

interface TravelTimeResult {
  orderId: string
  durationInMinutes: number
}

export async function POST(request: NextRequest) {
  try {
    const { orders } = await request.json()
    
    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: 'Orders array is required' },
        { status: 400 }
      )
    }
    
    // Get Google Maps API key from environment variables
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key is not configured' },
        { status: 500 }
      )
    }
    
    // Origin address (fixed)
    const originAddress = '562 Richmond Road, Grey Lynn, Auckland'
    
    // Process orders in batches to avoid rate limiting
    const batchSize = 10
    const results: TravelTimeResult[] = []
    
    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize)
      
      // Skip orders that already have a manually set travel time
      const ordersToProcess = batch.filter(order => !order.hasManualTravelTime)
      
      if (ordersToProcess.length === 0) {
        continue
      }
      
      // Create a batch request for the Distance Matrix API
      const destinations = ordersToProcess.map(order => order.deliveryAddress)
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originAddress)}&destinations=${destinations.map(addr => encodeURIComponent(addr)).join('|')}&mode=driving&key=${apiKey}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch from Google Maps API')
      }
      
      const data = await response.json()
      
      // Check if the API returned valid results
      if (data.status !== 'OK') {
        console.error('Google Maps API error:', data.status)
        continue
      }
      
      // Process each result
      data.rows[0].elements.forEach((element: any, index: number) => {
        if (element.status === 'OK' && element.duration) {
          const durationInMinutes = Math.ceil(element.duration.value / 60)
          const orderId = ordersToProcess[index].id
          
          results.push({
            orderId,
            durationInMinutes
          })
        }
      })
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < orders.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error processing bulk travel time update:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk travel time update' },
      { status: 500 }
    )
  }
} 