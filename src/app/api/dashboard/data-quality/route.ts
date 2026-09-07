import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getDataQualityMetrics, parseExecutiveFilters, sectionsToCsv } from '@/lib/dashboard'

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const filters = parseExecutiveFilters(req.nextUrl.searchParams)
    const data = await getDataQualityMetrics(filters)
    if (filters.format === 'csv') {
      return new NextResponse(sectionsToCsv([['dataQuality', data]]), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="data-quality.csv"',
        },
      })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    const status = error?.status === 403 ? 403 : 500
    return NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Failed to load data quality metrics' },
      { status }
    )
  }
}
