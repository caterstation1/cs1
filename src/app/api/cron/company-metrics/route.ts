import { NextResponse } from 'next/server'
import { refreshCompanyAndCustomerMetrics } from '@/lib/company-metrics'

export async function GET() {
  try {
    const result = await refreshCompanyAndCustomerMetrics({ monthsBack: 2 })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Cron metrics refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
