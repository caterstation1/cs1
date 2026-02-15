/**
 * Calendar Summary API
 * 
 * Returns order counts by day for a date range, filtered by region.
 * Fast endpoint for calendar grid rendering without fetching full orders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'

// Simple in-memory cache (5 minute TTL)
const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCacheKey(region: string, start: string, end: string): string {
  return `calendar_summary_${region}_${start}_${end}`
}

function getCached(key: string): any | null {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }
  if (cached) {
    cache.delete(key)
  }
  return null
}

function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get('region') // AKL or WLG
    const start = searchParams.get('start') // YYYY-MM-DD
    const end = searchParams.get('end') // YYYY-MM-DD
    
    if (!region || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: region, start, end' },
        { status: 400 }
      )
    }
    
    if (region !== 'AKL' && region !== 'WLG') {
      return NextResponse.json(
        { error: 'Region must be AKL or WLG' },
        { status: 400 }
      )
    }
    
    // Check cache
    const cacheKey = getCacheKey(region, start, end)
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
    
    // Parse dates (half-open range: [start, end))
    const startDate = new Date(start + 'T00:00:00.000Z')
    const endDate = new Date(end + 'T00:00:00.000Z')
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }
    
    // Query orders using Prisma $queryRaw for GROUP BY performance
    const result = await withRetry(async () => {
      return await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT 
          DATE("deliveryDateTime" AT TIME ZONE 'UTC') as date,
          COUNT(*)::int as count
        FROM "Order"
        WHERE 
          "region" = ${region}
          AND "deliveryDateTime" >= ${startDate}
          AND "deliveryDateTime" < ${endDate}
          AND "deliveryDateTime" IS NOT NULL
        GROUP BY DATE("deliveryDateTime" AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `
    })
    
    // Convert to array of { date: string, count: number }
    const countsByDay = result.map(row => ({
      date: row.date.toISOString().split('T')[0], // YYYY-MM-DD
      count: Number(row.count)
    }))
    
    // Get needs review count
    const needsReviewCount = await withRetry(async () => {
      return await prisma.order.count({
        where: {
          region,
          needsSchedulingReview: true
        }
      })
    })
    
    const response = {
      region,
      start,
      end,
      countsByDay,
      needsReviewCount,
      cached: false
    }
    
    // Cache the result
    setCache(cacheKey, response)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error fetching calendar summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar summary' },
      { status: 500 }
    )
  }
}

// Clear cache endpoint (call after Shopify sync)
export async function DELETE() {
  cache.clear()
  return NextResponse.json({ message: 'Cache cleared' })
}
