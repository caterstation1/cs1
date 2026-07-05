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
  toCsv,
} from '@/lib/dashboard'

type Row = Record<string, unknown>

function pushRows(rows: Row[], section: string, payload: unknown, parentKey?: string) {
  if (payload == null) {
    rows.push({ section, key: parentKey || '', value: '' })
    return
  }
  if (Array.isArray(payload)) {
    payload.forEach((entry, index) => {
      if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
        Object.entries(entry as Record<string, unknown>).forEach(([k, v]) => {
          rows.push({ section, key: `${parentKey || 'item'}[${index}].${k}`, value: typeof v === 'object' ? JSON.stringify(v) : v })
        })
      } else {
        rows.push({ section, key: `${parentKey || 'item'}[${index}]`, value: String(entry) })
      }
    })
    return
  }
  if (typeof payload === 'object') {
    Object.entries(payload as Record<string, unknown>).forEach(([k, v]) => {
      if (v != null && typeof v === 'object') {
        pushRows(rows, section, v, parentKey ? `${parentKey}.${k}` : k)
      } else {
        rows.push({ section, key: parentKey ? `${parentKey}.${k}` : k, value: v ?? '' })
      }
    })
    return
  }
  rows.push({ section, key: parentKey || '', value: String(payload) })
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const filters = parseExecutiveFilters(req.nextUrl.searchParams)

    const [summary, trends, behaviour, companies, growth, customers, products, dataQuality] = await Promise.all([
      getExecutiveSummary(filters),
      getRevenueTrends(filters),
      getCompanyBehaviour(filters),
      getCompaniesTable({ ...filters, page: 1, pageSize: 5000 }),
      getGrowthOpportunities({ ...filters, page: 1, pageSize: 5000 }),
      getCustomerDashboard(filters),
      getProductPerformance(filters),
      getDataQualityMetrics(filters),
    ])

    const rows: Row[] = []
    pushRows(rows, 'summary', summary)
    pushRows(rows, 'revenueTrends', trends)
    pushRows(rows, 'companyBehaviour', behaviour)
    pushRows(rows, 'companies', companies)
    pushRows(rows, 'growthOpportunities', growth)
    pushRows(rows, 'customers', customers)
    pushRows(rows, 'products', products)
    pushRows(rows, 'dataQuality', dataQuality)

    const csv = toCsv(rows, ['section', 'key', 'value'])
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=\"executive-dashboard-export.csv\"',
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
