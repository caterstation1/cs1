import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseAndUpsertCompanyForOrder } from '@/lib/company-matching'

const BATCH_SIZE = 200

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const batch = Number(searchParams.get('batch') || '1')
    const take = Math.min(Number(searchParams.get('take') || BATCH_SIZE), 500)
    const skip = Math.max(0, (batch - 1) * take)

    const [total, orders] = await Promise.all([
      prisma.order.count({ where: { source: 'shopify' } }),
      prisma.order.findMany({
        where: { source: 'shopify' },
        orderBy: { createdAt: 'asc' },
        take,
        skip,
      }),
    ])

    if (!orders.length) {
      return NextResponse.json({
        success: true,
        message: 'No more Shopify orders to backfill.',
        batch,
        processed: 0,
        remaining: Math.max(0, total - skip),
        hasMore: false,
      })
    }

    let processed = 0
    let failures = 0

    for (const order of orders) {
      try {
        await parseAndUpsertCompanyForOrder({
          shopifyOrder: {
            id: order.shopifyId,
            name: `#${order.orderNumber}`,
            note: order.note,
            customer: {
              id: order.customerEmail || undefined,
              email: order.customerEmail,
              first_name: order.customerFirstName,
              last_name: order.customerLastName,
            },
            shipping_address: order.shippingAddress,
            billing_address: order.billingAddress,
            line_items: order.lineItems,
            source_name: order.source,
            created_at: order.createdAt,
            updated_at: order.updatedAt,
          },
          transformedOrder: {
            shopifyId: order.shopifyId,
            orderNumber: String(order.orderNumber),
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            totalPrice: order.totalPrice,
            subtotalPrice: order.subtotalPrice,
            customerEmail: order.customerEmail,
            customerFirstName: order.customerFirstName,
            customerLastName: order.customerLastName,
            customerPhone: order.customerPhone,
            shippingAddress: order.shippingAddress,
            lineItems: order.lineItems,
            source: order.source,
            notes: order.note,
          },
        })
      } catch (error) {
        failures += 1
        console.error(`[backfill-company-normalization] Failed order ${order.shopifyId}:`, error)
      } finally {
        processed += 1
      }
    }

    const processedTotal = skip + processed
    const remaining = Math.max(0, total - processedTotal)

    return NextResponse.json({
      success: true,
      batch,
      processed,
      failures,
      total,
      processedTotal,
      remaining,
      hasMore: remaining > 0,
      nextBatch: remaining > 0 ? `/api/admin/backfill-company-normalization?batch=${batch + 1}&take=${take}` : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Backfill failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
