import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/date-utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const deliveryDateResolved = searchParams.get('deliveryDateResolved') // YYYY-MM-DD
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    console.log('📦 Fetching orders from PostgreSQL...', { search, limit, offset })
    
    // Build where clause
    let whereClause: any = {}
    
    if (date) {
      whereClause.createdAt = {
        gte: new Date(date),
        lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
      }
    }

    // Prefer server-side filtering by resolved delivery day when provided
    if (deliveryDateResolved) {
      // Use a local-day range (>= midnight, < next midnight) to avoid UTC shifts
      const base = parseLocalDate(deliveryDateResolved) || new Date(deliveryDateResolved)
      const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)
      whereClause.deliveryDateResolved = {
        gte: base,
        lt: next,
      } as any
    }
    
    // Add search functionality
    if (search && search.trim()) {
      const searchTerm = search.trim()
      whereClause.OR = [
        // Search by order number
        { orderNumber: { equals: parseInt(searchTerm) || 0 } },
        // Search by customer name (first or last)
        { customerFirstName: { contains: searchTerm, mode: 'insensitive' } },
        { customerLastName: { contains: searchTerm, mode: 'insensitive' } },
        // Search by email
        { customerEmail: { contains: searchTerm, mode: 'insensitive' } },
        // Search by phone
        { customerPhone: { contains: searchTerm, mode: 'insensitive' } },
        // Search by Shopify ID
        { shopifyId: { contains: searchTerm, mode: 'insensitive' } }
      ]
    }
    
    const orders = await withRetry(async () => {
      return await prisma.order.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      })
    })
    
    // Get total count for pagination
    const totalCount = await withRetry(async () => {
      return await prisma.order.count({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined
      })
    })
    
    console.log(`✅ Successfully fetched ${orders.length} orders (${totalCount} total)`)
    return NextResponse.json({
      orders,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('❌ Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
} 