import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchShopifyOrders, fetchAllShopifyOrders, ShopifyOrder } from '@/lib/shopify-client'
import { transformShopifyOrder } from '@/lib/data-transformer'
import { resolveDeliveryDateResolved } from '@/lib/delivery-date-resolver'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const orderNumber: number | undefined = Number(body?.orderNumber)
    if (!orderNumber || Number.isNaN(orderNumber)) {
      return NextResponse.json({ error: 'orderNumber required' }, { status: 400 })
    }

    // If already in DB, return early
    const existing = await prisma.order.findFirst({ where: { orderNumber } })
    if (existing) {
      return NextResponse.json({ status: 'exists', orderNumber, id: existing.id })
    }

    // Fast path: recent 250
    let candidate: ShopifyOrder | undefined
    const recent = await fetchShopifyOrders(250).catch(() => [])
    candidate = recent.find(o => Number(o.order_number) === orderNumber)

    // Slow path: full pagination
    if (!candidate) {
      const all = await fetchAllShopifyOrders()
      candidate = all.find(o => Number(o.order_number) === orderNumber)
    }

    if (!candidate) {
      return NextResponse.json({ error: 'Order not found on Shopify', orderNumber }, { status: 404 })
    }

    const transformed = transformShopifyOrder(candidate)
    const resolved = resolveDeliveryDateResolved({
      deliveryDate: transformed.deliveryDate,
      tags: transformed.tags,
      createdAt: transformed.createdAt,
    })

    // Upsert by shopifyId
    const saved = await prisma.order.upsert({
      where: { shopifyId: String(transformed.shopifyId) },
      create: {
        shopifyId: transformed.shopifyId.toString(),
        orderNumber: parseInt(transformed.orderNumber),
        createdAt: new Date(transformed.createdAt),
        updatedAt: new Date(transformed.updatedAt),
        totalPrice: transformed.totalPrice,
        subtotalPrice: transformed.subtotalPrice,
        totalTax: transformed.totalTax,
        currency: transformed.currency,
        financialStatus: transformed.financialStatus,
        fulfillmentStatus: transformed.fulfillmentStatus ?? null,
        tags: transformed.tags,
        note: transformed.notes ?? null,
        customerEmail: transformed.customerEmail,
        customerFirstName: transformed.customerFirstName,
        customerLastName: transformed.customerLastName,
        customerPhone: transformed.customerPhone,
        shippingAddress: transformed.shippingAddress as any,
        lineItems: transformed.lineItems as any,
        source: 'shopify',
        hasLocalEdits: false,
        syncedAt: new Date(transformed.syncedAt),
        deliveryDate: transformed.deliveryDate,
        deliveryTime: transformed.deliveryTime,
        isDispatched: transformed.isDispatched,
        deliveryDateResolved: (resolved.date as unknown as Date) ?? null,
        deliveryDateResolvedSource: (resolved.source as any) ?? null,
        deliveryDateResolvedAt: new Date(),
      },
      update: {
        updatedAt: new Date(transformed.updatedAt),
        tags: transformed.tags,
        note: transformed.notes ?? null,
        customerEmail: transformed.customerEmail,
        customerFirstName: transformed.customerFirstName,
        customerLastName: transformed.customerLastName,
        customerPhone: transformed.customerPhone,
        shippingAddress: transformed.shippingAddress as any,
        lineItems: transformed.lineItems as any,
        syncedAt: new Date(transformed.syncedAt),
        deliveryDate: transformed.deliveryDate,
        deliveryTime: transformed.deliveryTime,
        deliveryDateResolved: (resolved.date as unknown as Date) ?? null,
        deliveryDateResolvedSource: (resolved.source as any) ?? null,
        deliveryDateResolvedAt: new Date(),
      },
    })

    return NextResponse.json({ status: 'inserted', orderNumber, id: saved.id })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to refetch order' }, { status: 500 })
  }
}

