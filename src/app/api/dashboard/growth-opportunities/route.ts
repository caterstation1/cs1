import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getGrowthOpportunities, parseExecutiveFilters, toCsv } from '@/lib/dashboard'

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin', 'manager'])
    const filters = parseExecutiveFilters(req.nextUrl.searchParams)
    if (filters.format === 'csv') {
      // CSV export always includes every row, not just the current page
      const data = await getGrowthOpportunities({ ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER })
      const csv = toCsv(data.rows)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=\"growth-opportunities.csv\"',
        },
      })
    }
    const data = await getGrowthOpportunities(filters)
    return NextResponse.json(data)
  } catch (error: any) {
    const status = error?.status === 403 ? 403 : 500
    return NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Failed to load growth opportunities' },
      { status }
    )
  }
}
