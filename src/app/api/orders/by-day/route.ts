/**
 * Orders by Day API
 * 
 * Returns orders for a specific day, filtered by region.
 * Lightweight endpoint for day click drilldown.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { getDayWindowForYmd, parseCalendarRegion } from '@/lib/calendar-query'
import { parseLocalDate } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = parseCalendarRegion(searchParams.get('region'))
    const date = searchParams.get('date') // YYYY-MM-DD
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(5000, Math.max(1, parseInt(searchParams.get('pageSize') || '5000')))
    
    if (!region || !date) {
      return NextResponse.json(
        { error: 'Missing required parameters: region, date' },
        { status: 400 }
      )
    }
    
    if (!region) {
      return NextResponse.json(
        { error: 'Region must be AKL or WLG' },
        { status: 400 }
      )
    }

    let dateObj: Date
    let nextDate: Date
    try {
      const range = getDayWindowForYmd(date)
      dateObj = range.start
      nextDate = range.endExclusive
    } catch {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }
    
    // Query orders for the day
    const [orders, total] = await withRetry(async () => {
      const fallbackResolvedStart = parseLocalDate(date) || new Date(date)
      const fallbackResolvedEnd = new Date(
        fallbackResolvedStart.getFullYear(),
        fallbackResolvedStart.getMonth(),
        fallbackResolvedStart.getDate() + 1
      )
      const fallbackResolvedRange = {
        gte: fallbackResolvedStart,
        lt: fallbackResolvedEnd,
      }
      return await Promise.all([
        prisma.order.findMany({
          where: {
            region,
            cancelledAt: null,
            OR: [
              {
                deliveryDateTime: {
                  gte: dateObj,
                  lt: nextDate // Half-open: [dateObj, nextDate)
                }
              },
              {
                deliveryDateTime: null,
                deliveryDateResolved: fallbackResolvedRange as any,
              }
            ]
          },
          orderBy: {
            deliveryDateTime: 'asc'
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.order.count({
          where: {
            region,
            cancelledAt: null,
            OR: [
              {
                deliveryDateTime: {
                  gte: dateObj,
                  lt: nextDate // Half-open: [dateObj, nextDate)
                }
              },
              {
                deliveryDateTime: null,
                deliveryDateResolved: fallbackResolvedRange as any,
              }
            ]
          }
        })
      ])
    })
    
    return NextResponse.json({
      region,
      date,
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total
      }
    })
  } catch (error) {
    console.error('❌ Error fetching orders by day:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
