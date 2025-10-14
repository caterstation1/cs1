import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'

// Returns orders that have changed since a given timestamp, based on `dbUpdatedAt`
// Query params:
// - since: number (ms since epoch) or ISO string
// - limit: number (optional, default 500)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')
    const limitParam = searchParams.get('limit')

    let sinceDate: Date | null = null
    if (sinceParam) {
      // Allow both ms timestamp and ISO string
      const ms = Number(sinceParam)
      if (!Number.isNaN(ms) && ms > 0) {
        sinceDate = new Date(ms)
      } else {
        const parsed = new Date(sinceParam)
        if (!Number.isNaN(parsed.getTime())) {
          sinceDate = parsed
        }
      }
    }

    const take = Math.min(Math.max(parseInt(limitParam || '500', 10) || 500, 1), 2000)

    // If since not provided, just return nothing (client should do an initial full fetch)
    if (!sinceDate) {
      return NextResponse.json({ orders: [], maxUpdatedAt: null, hasMore: false })
    }

    const changedOrders = await withRetry(async () => {
      return await prisma.order.findMany({
        where: {
          dbUpdatedAt: {
            gt: sinceDate,
          },
        },
        orderBy: {
          dbUpdatedAt: 'asc',
        },
        take,
      })
    })

    const maxUpdatedAt = changedOrders.length > 0
      ? Math.max(...changedOrders.map(o => new Date(o.dbUpdatedAt as unknown as string).getTime()))
      : null

    // Determine if there might be more beyond the limit
    let hasMore = false
    if (changedOrders.length === take) {
      const countBeyond = await withRetry(async () => {
        return await prisma.order.count({
          where: {
            dbUpdatedAt: {
              gt: sinceDate!,
            },
          },
        })
      })
      hasMore = countBeyond > take
    }

    return NextResponse.json({ orders: changedOrders, maxUpdatedAt, hasMore })
  } catch (error) {
    console.error('❌ Error fetching order changes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order changes' },
      { status: 500 }
    )
  }
}













