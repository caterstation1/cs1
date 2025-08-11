import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    
    console.log('📦 Fetching orders from PostgreSQL...')
    
    const orders = await withRetry(async () => {
      return await prisma.order.findMany({
        where: date ? {
          createdAt: {
            gte: new Date(date),
            lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
          }
        } : undefined,
        orderBy: {
          createdAt: 'desc'
        }
      })
    })
    
    console.log(`✅ Successfully fetched ${orders.length} orders`)
    return NextResponse.json(orders)
  } catch (error) {
    console.error('❌ Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
} 