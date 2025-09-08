import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchShopifyOrders } from '@/lib/shopify-client'

// One-off endpoint: return the raw data for the last N Shopify orders
// Usage: GET /api/orders/raw/latest?count=2
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const count = Math.min(parseInt(searchParams.get('count') || '2', 10) || 2, 10)

    // Find the last N orders by createdAt
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: count,
      select: {
        id: true,
        orderNumber: true,
        shopifyId: true,
        createdAt: true,
      },
    })

    if (orders.length === 0) {
      return NextResponse.json({ orders: [] })
    }

    // Fetch raw Shopify payloads if present in ShopifyOrder table; otherwise fetch directly from Shopify as a fallback
    const results = [] as any[]
    for (const o of orders) {
      const raw = await prisma.shopifyOrder.findUnique({
        where: { id: o.shopifyId },
        select: { rawData: true, syncedAt: true },
      })
      if (raw?.rawData) {
        results.push({ orderMeta: o, raw: raw.rawData, rawSyncedAt: raw.syncedAt })
      } else {
        // Fallback: pull recent orders from Shopify and try to match by shopifyId
        try {
          const recent = await fetchShopifyOrders(50)
          const match = recent.find(r => String(r.id) === o.shopifyId)
          results.push({ orderMeta: o, raw: match ?? null, rawSyncedAt: null })
        } catch (e) {
          results.push({ orderMeta: o, raw: null, rawSyncedAt: null, error: 'fallback_fetch_failed' })
        }
      }
    }

    return NextResponse.json({ count: results.length, orders: results })
  } catch (error) {
    console.error('Error fetching latest raw orders:', error)
    return NextResponse.json({ error: 'Failed to fetch raw orders' }, { status: 500 })
  }
}


