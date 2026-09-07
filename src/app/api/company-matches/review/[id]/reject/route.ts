import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.companyMatchReview.findUnique({
      where: { reviewId: id },
      select: { reviewId: true, status: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Review item not found' }, { status: 404 })
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Review item already resolved' }, { status: 400 })
    }

    await prisma.companyMatchReview.update({
      where: { reviewId: id },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reject match review',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
