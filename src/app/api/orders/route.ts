import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/date-utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const {
      customerFirstName,
      customerLastName,
      customerEmail,
      customerPhone,
      shippingAddress,
      deliveryDate,
      deliveryTime,
      note,
      lineItems = []
    } = body

    // Validate required fields
    if (!customerFirstName || !customerLastName || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: customerFirstName, customerLastName, customerEmail' },
        { status: 400 }
      )
    }

    // Get the next order number
    const lastOrder = await withRetry(async () => {
      return await prisma.order.findFirst({
        orderBy: { orderNumber: 'desc' }
      })
    })
    
    const nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1000

    // Create the order
    const newOrder = await withRetry(async () => {
      return await prisma.order.create({
        data: {
          shopifyId: `manual-${Date.now()}`,
          orderNumber: nextOrderNumber,
          createdAt: new Date(),
          updatedAt: new Date(),
          totalPrice: 0,
          subtotalPrice: 0,
          totalTax: 0,
          currency: 'NZD',
          financialStatus: 'paid',
          fulfillmentStatus: 'unfulfilled',
          tags: '',
          note: note || '',
          customerEmail,
          customerFirstName,
          customerLastName,
          customerPhone: customerPhone || '',
          shippingAddress: shippingAddress ? JSON.parse(JSON.stringify(shippingAddress)) : null,
          lineItems: JSON.parse(JSON.stringify(lineItems)),
          source: 'manual',
          hasLocalEdits: true,
          deliveryDate: deliveryDate || null,
          deliveryTime: deliveryTime || null,
          deliveryDateResolved: deliveryDate ? parseLocalDate(deliveryDate) : null
        }
      })
    })

    console.log('✅ Successfully created new order:', newOrder.orderNumber)
    return NextResponse.json(newOrder)
  } catch (error) {
    console.error('❌ Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    // Ensure carId column exists (idempotent)
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "carId" TEXT');
    } catch {}
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