import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'

const PRIVATE_COMPANY_NAME = 'Private Customer'

async function refreshCompanyTotals(tx: Prisma.TransactionClient, companyId: string) {
  const [aggregate, minMax] = await Promise.all([
    tx.companyOrder.aggregate({
      where: { companyId },
      _count: { _all: true },
      _sum: { orderTotal: true },
    }),
    tx.companyOrder.aggregate({
      where: { companyId },
      _min: { orderDate: true },
      _max: { orderDate: true },
    }),
  ])
  await tx.company.update({
    where: { companyId },
    data: {
      totalOrders: aggregate._count._all || 0,
      totalRevenue: aggregate._sum.orderTotal || 0,
      firstOrderDate: minMax._min.orderDate || null,
      lastOrderDate: minMax._max.orderDate || null,
    },
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const review = await prisma.companyMatchReview.findUnique({
      where: { reviewId: id },
      select: {
        reviewId: true,
        status: true,
        orderIds: true,
      },
    })
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review item not found' }, { status: 404 })
    }
    if (review.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Review item already resolved' }, { status: 400 })
    }

    const orderIds = Array.isArray(review.orderIds)
      ? review.orderIds.map((orderId) => String(orderId)).filter(Boolean)
      : []

    await prisma.$transaction(async (tx) => {
      let privateCompany = await tx.company.findFirst({
        where: { canonicalCompanyName: PRIVATE_COMPANY_NAME },
        select: { companyId: true },
      })
      if (!privateCompany) {
        privateCompany = await tx.company.create({
          data: {
            canonicalCompanyName: PRIVATE_COMPANY_NAME,
            companyNameVariants: [PRIVATE_COMPANY_NAME, 'Private'],
            confidenceScore: 100,
          },
          select: { companyId: true },
        })
      }

      const impacted = orderIds.length
        ? await tx.companyOrder.findMany({
            where: { shopifyOrderId: { in: orderIds } },
            select: { companyId: true },
          })
        : []
      const impactedCompanyIds = Array.from(new Set(impacted.map((row) => row.companyId)))

      if (orderIds.length) {
        await tx.companyOrder.updateMany({
          where: { shopifyOrderId: { in: orderIds } },
          data: {
            companyId: privateCompany.companyId,
            matchMethod: 'MANUAL_OVERRIDE',
            confidenceScore: 100,
            matchReason: 'Marked as private customer by reviewer',
          },
        })
      }

      await tx.companyMatchReview.update({
        where: { reviewId: id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          existingCompanyId: privateCompany.companyId,
          existingCompanyName: PRIVATE_COMPANY_NAME,
          matchReason: 'Manually marked as private customer',
        },
      })

      await refreshCompanyTotals(tx, privateCompany.companyId)
      for (const companyId of impactedCompanyIds) {
        if (companyId !== privateCompany.companyId) {
          await refreshCompanyTotals(tx, companyId)
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to mark customer as private',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
