import { NextRequest, NextResponse } from 'next/server'
import { refreshCompanyAndCustomerMetrics } from '@/lib/company-metrics'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const monthsBack = Number(body?.monthsBack || 2)
    const full = Boolean(body?.full)

    const result = await refreshCompanyAndCustomerMetrics({
      full,
      monthsBack: Number.isFinite(monthsBack) ? monthsBack : 2,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh monthly metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
