import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get('month')
    const companyId = request.nextUrl.searchParams.get('companyId')
    const shopifyCustomerId = request.nextUrl.searchParams.get('shopifyCustomerId')
    const take = Math.min(Number(request.nextUrl.searchParams.get('take') || '200'), 1000)

    const where: any = {}
    if (month) where.month = new Date(`${month}-01T00:00:00.000Z`)
    if (companyId) where.companyId = companyId
    if (shopifyCustomerId) where.shopifyCustomerId = shopifyCustomerId

    const rows = await prisma.customerMetricsMonthly.findMany({
      where,
      orderBy: [{ month: 'desc' }, { revenue: 'desc' }],
      take,
    })

    return NextResponse.json({
      success: true,
      sourceOfTruth: 'company',
      rows,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to read customer metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
