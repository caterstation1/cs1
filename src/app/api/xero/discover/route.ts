import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import {
  getEmployees,
  getEarningsRates,
  getReimbursements,
  getPayRunCalendars,
} from '@/lib/xero/payroll'

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }
  try {
    const [employees, earningsRates, reimbursements, calendars] = await Promise.all([
      getEmployees(tenantId),
      getEarningsRates(tenantId),
      getReimbursements(tenantId),
      getPayRunCalendars(tenantId),
    ])
    return NextResponse.json({
      employees: employees?.employees ?? [],
      earningsRates: earningsRates?.earningsRates ?? [],
      reimbursements: reimbursements?.reimbursements ?? [],
      payRunCalendars: calendars?.payRunCalendars ?? [],
    })
  } catch (e: unknown) {
    console.error('Xero discover error:', e)
    const err = e as { response?: { body?: unknown }; message?: string }
    return NextResponse.json(
      {
        error: 'Xero API error',
        details: err.response?.body ?? err.message ?? String(e),
      },
      { status: 502 }
    )
  }
}
