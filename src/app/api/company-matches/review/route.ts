import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'pending'
    const take = Math.min(Number(request.nextUrl.searchParams.get('take') || '100'), 500)

    const reviews = await prisma.companyMatchReview.findMany({
      where: status === 'all' ? {} : { status: status as any },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take,
      include: {
        proposedCompany: {
          select: {
            companyId: true,
            canonicalCompanyName: true,
            primaryDomain: true,
          },
        },
        existingCompany: {
          select: {
            companyId: true,
            canonicalCompanyName: true,
            primaryDomain: true,
          },
        },
      },
    })

    const orderIds = Array.from(
      new Set(
        reviews.flatMap((review) =>
          Array.isArray(review.orderIds)
            ? review.orderIds.map((orderId) => String(orderId))
            : []
        )
      )
    )

    const rawOrders = orderIds.length
      ? await prisma.rawShopifyOrder.findMany({
          where: { shopifyOrderId: { in: orderIds } },
          select: {
            shopifyOrderId: true,
            payload: true,
          },
        })
      : []

    const rawOrderById = new Map(rawOrders.map((row) => [row.shopifyOrderId, row.payload as any]))

    const enrichedReviews = reviews.map((review) => {
      const reviewOrderIds = Array.isArray(review.orderIds)
        ? review.orderIds.map((orderId) => String(orderId))
        : []
      const firstPayload = reviewOrderIds.length ? rawOrderById.get(reviewOrderIds[0]) : null
      const email = firstPayload?.customer?.email || null
      const shippingCompany = firstPayload?.shipping_address?.company || null
      const billingCompany = firstPayload?.billing_address?.company || null
      const shippingAddress = firstPayload?.shipping_address?.address1 || null
      const city = firstPayload?.shipping_address?.city || null
      const domain = email && String(email).includes('@') ? String(email).split('@').pop()?.toLowerCase() : null

      return {
        ...review,
        evidence: {
          email,
          domain: domain || null,
          shippingCompany,
          billingCompany,
          shippingAddress,
          city,
        },
      }
    })

    return NextResponse.json({ success: true, reviews: enrichedReviews })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load company match reviews',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
