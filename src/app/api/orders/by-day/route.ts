/**
 * Orders by Day API
 * 
 * Returns orders for a specific day, filtered by region.
 * Lightweight endpoint for day click drilldown.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get('region') // AKL or WLG
    const date = searchParams.get('date') // YYYY-MM-DD
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    
    if (!region || !date) {
      return NextResponse.json(
        { error: 'Missing required parameters: region, date' },
        { status: 400 }
      )
    }
    
    if (region !== 'AKL' && region !== 'WLG') {
      return NextResponse.json(
        { error: 'Region must be AKL or WLG' },
        { status: 400 }
      )
    }
    
    // Parse date (half-open range: [date 00:00, date+1 00:00))
    const dateObj = new Date(date + 'T00:00:00.000Z')
    const nextDate = new Date(dateObj)
    nextDate.setDate(nextDate.getDate() + 1)
    
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }
    
    // Query orders for the day
    const [orders, total] = await withRetry(async () => {
      return await Promise.all([
        prisma.order.findMany({
          where: {
            region,
            deliveryDateTime: {
              gte: dateObj,
              lt: nextDate
            }
          },
          select: {
            id: true,
            orderNumber: true,
            customerFirstName: true,
            customerLastName: true,
            customerEmail: true,
            customerPhone: true,
            shippingAddress: true,
            deliveryDateTime: true,
            deliveryTime: true,
            tags: true,
            fulfillmentStatus: true,
            isDispatched: true,
            needsSchedulingReview: true,
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
            deliveryDateTime: {
              gte: dateObj,
              lt: nextDate
            }
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
