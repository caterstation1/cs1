import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getExecutiveSummary, parseExecutiveFilters, sectionsToCsv } from '@/lib/dashboard'

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin', 'manager'])
    const filters = parseExecutiveFilters(req.nextUrl.searchParams)
    const data = await getExecutiveSummary(filters)
    if (filters.format === 'csv') {
      return new NextResponse(sectionsToCsv([['summary', data]]), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="executive-summary.csv"',
        },
      })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    const status = error?.status === 403 ? 403 : 500
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Failed to load summary' }, { status })
  }
}
