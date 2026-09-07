import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import {
  getCompaniesTable,
  getCompanyBehaviour,
  getCustomerDashboard,
  getDataQualityMetrics,
  getExecutiveSummary,
  getGrowthOpportunities,
  getProductPerformance,
  getRevenueTrends,
  parseExecutiveFilters,
  sectionsToCsv,
} from '@/lib/dashboard'

const ALL_ROWS = Number.MAX_SAFE_INTEGER

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const filters = parseExecutiveFilters(req.nextUrl.searchParams)

    const [summary, trends, behaviour, companies, growth, customers, products, dataQuality] = await Promise.all([
      getExecutiveSummary(filters),
      getRevenueTrends(filters),
      getCompanyBehaviour(filters),
      getCompaniesTable({ ...filters, page: 1, pageSize: ALL_ROWS }),
      getGrowthOpportunities({ ...filters, page: 1, pageSize: ALL_ROWS }),
      getCustomerDashboard(filters),
      getProductPerformance(filters),
      getDataQualityMetrics(filters),
    ])

    const csv = sectionsToCsv([
      ['summary', summary],
      ['revenueTrends', trends],
      ['companyBehaviour', behaviour],
      ['companies', companies],
      ['growthOpportunities', growth],
      ['customers', customers],
      ['products', products],
      ['dataQuality', dataQuality],
    ])
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="executive-dashboard-export.csv"',
      },
    })
  } catch (error: any) {
    const status = error?.status === 403 ? 403 : 500
    return NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Failed to export executive dashboard' },
      { status }
    )
  }
}
