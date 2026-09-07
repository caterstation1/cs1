/**
 * Calendar Summary API
 * 
 * Returns order counts by day for a date range, filtered by region.
 * Fast endpoint for calendar grid rendering without fetching full orders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { getRangeWindowForYmd, parseCalendarRegion } from '@/lib/calendar-query'

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
    const region = parseCalendarRegion(searchParams.get('region')) // AKL or WLG
    const start = searchParams.get('start') // YYYY-MM-DD
    const end = searchParams.get('end') // YYYY-MM-DD
    const fresh = searchParams.get('fresh') === '1'
    
    if (!region || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: region, start, end' },
        { status: 400 }
      )
    }
    
    if (!region) {
      return NextResponse.json(
        { error: 'Region must be AKL or WLG' },
        { status: 400 }
      )
    }
    
    // Check cache unless explicitly bypassed.
    const cacheKey = getCacheKey(region, start, end)
    if (!fresh) {
      const cached = getCached(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    }
    
    let startDate: Date
    let endDate: Date
    try {
      const range = getRangeWindowForYmd({
        startYmd: start,
        endYmdExclusive: end,
      })
      startDate = range.start
      endDate = range.endExclusive
    } catch {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }
    
    // Query orders using Prisma $queryRaw for GROUP BY performance
    // Group by Auckland date (Pacific/Auckland timezone) to ensure correct day grouping
    const result = await withRetry(async () => {
      return await prisma.$queryRaw<
        Array<{
          ymd: string
          total_count: number
          morning_count: number
          needs_review_count: number
          dispatched_count: number
        }>
      >`
        SELECT 
          TO_CHAR(
            COALESCE(
              DATE("deliveryDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland'),
              "deliveryDateResolved"
            ),
            'YYYY-MM-DD'
          ) as ymd,
          COUNT(*)::int as total_count,
          COUNT(*) FILTER (
            WHERE "deliveryDateTime" IS NOT NULL
              AND EXTRACT(HOUR FROM ("deliveryDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland')) < 12
          )::int AS morning_count,
          COUNT(*) FILTER (WHERE "needsSchedulingReview" = true)::int AS needs_review_count,
          COUNT(*) FILTER (WHERE "isDispatched" = true)::int AS dispatched_count
        FROM "Order"
        WHERE 
          "region" = ${region}
          AND "cancelledAt" IS NULL
          AND (
            (
              "deliveryDateTime" IS NOT NULL
              AND "deliveryDateTime" >= ${startDate}
              AND "deliveryDateTime" < ${endDate}
            )
            OR (
              "deliveryDateTime" IS NULL
              AND "deliveryDateResolved" IS NOT NULL
              AND "deliveryDateResolved" >= CAST(${start} AS DATE)
              AND "deliveryDateResolved" < CAST(${end} AS DATE)
            )
          )
        GROUP BY COALESCE(
          DATE("deliveryDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland'),
          "deliveryDateResolved"
        )
        ORDER BY COALESCE(
          DATE("deliveryDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland'),
          "deliveryDateResolved"
        ) ASC
      `
    })
    
    const days = result.map((row) => {
      return {
        date: row.ymd,
        totalCount: Number(row.total_count || 0),
        morningCount: Number(row.morning_count || 0),
        needsReviewCount: Number(row.needs_review_count || 0),
        dispatchedCount: Number(row.dispatched_count || 0),
      }
    })

    // Backward compatibility for existing clients.
    const countsByDay = days.map((d) => ({
      date: d.date,
      count: d.totalCount,
    }))
    
    // Get needs review count
    const needsReviewCount = await withRetry(async () => {
      return await prisma.order.count({
        where: {
          region,
          needsSchedulingReview: true,
          cancelledAt: null,
        }
      })
    })
    
    const response = {
      region,
      start,
      end,
      days,
      countsByDay,
      needsReviewCount,
      cached: false
    }
    
    // Cache the result only for non-fresh requests.
    if (!fresh) {
      setCache(cacheKey, response)
    }
    
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
