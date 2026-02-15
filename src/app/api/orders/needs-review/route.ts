/**
 * Needs Review Orders API
 * 
 * Returns orders that need scheduling review (deliveryDateTime missing/invalid).
 * Critical safety feature to ensure no orders are missed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get('region') // AKL or WLG
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    
    if (!region) {
      return NextResponse.json(
        { error: 'Missing required parameter: region' },
        { status: 400 }
      )
    }
    
    if (region !== 'AKL' && region !== 'WLG') {
      return NextResponse.json(
        { error: 'Region must be AKL or WLG' },
        { status: 400 }
      )
    }
    
    // Query orders needing review
    const [orders, total] = await withRetry(async () => {
      return await Promise.all([
        prisma.order.findMany({
          where: {
            region,
            needsSchedulingReview: true
          },
          select: {
            id: true,
            orderNumber: true,
            customerFirstName: true,
            customerLastName: true,
            customerEmail: true,
            customerPhone: true,
            shippingAddress: true,
            deliveryDate: true,
            deliveryTime: true,
            tags: true,
            note: true,
            noteAttributes: true,
            createdAt: true,
            deliveryDateSource: true,
            fulfillmentStatus: true,
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.order.count({
          where: {
            region,
            needsSchedulingReview: true
          }
        })
      ])
    })
    
    return NextResponse.json({
      region,
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
    console.error('❌ Error fetching needs review orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch needs review orders' },
      { status: 500 }
    )
  }
}
