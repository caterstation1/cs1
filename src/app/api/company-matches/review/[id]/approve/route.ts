import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const forcedExistingCompanyId = body?.existingCompanyId ? String(body.existingCompanyId) : null

    const review = await prisma.companyMatchReview.findUnique({
      where: { reviewId: id },
      include: {
        proposedCompany: true,
        existingCompany: true,
      },
    })
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review item not found' }, { status: 404 })
    }

    if (review.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Review item already resolved' }, { status: 400 })
    }

    const targetExistingCompanyId = forcedExistingCompanyId || review.existingCompanyId || null

    await prisma.$transaction(async (tx) => {
      if (targetExistingCompanyId && review.proposedCompanyId && targetExistingCompanyId !== review.proposedCompanyId) {
        const [existing, proposed] = await Promise.all([
          tx.company.findUnique({ where: { companyId: targetExistingCompanyId } }),
          tx.company.findUnique({ where: { companyId: review.proposedCompanyId } }),
        ])

        if (existing && proposed) {
          await tx.companyOrder.updateMany({
            where: { companyId: proposed.companyId },
            data: { companyId: existing.companyId },
          })
          await tx.companyContact.updateMany({
            where: { companyId: proposed.companyId },
            data: { companyId: existing.companyId },
          })
          await tx.company.update({
            where: { companyId: existing.companyId },
            data: {
              companyNameVariants: Array.from(
                new Set([
                  ...(existing.companyNameVariants || []),
                  ...(proposed.companyNameVariants || []),
                  review.proposedCompanyName,
                ])
              ),
              alternateDomains: Array.from(
                new Set([...(existing.alternateDomains || []), ...(proposed.alternateDomains || [])])
              ),
              confidenceScore: Math.max(existing.confidenceScore, proposed.confidenceScore, review.confidenceScore),
            },
          })
        }
      }

      const winningCompanyId = targetExistingCompanyId || review.proposedCompanyId || null

      await tx.companyMatchReview.update({
        where: { reviewId: id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          existingCompanyId: winningCompanyId,
        },
      })

      if (winningCompanyId) {
        await refreshCompanyTotals(tx, winningCompanyId)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to approve match review',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
