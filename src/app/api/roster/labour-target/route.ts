// Rostered labour cost per day against a target of 10% of that day's
// delivered sales. Payroll rates and revenue in one payload, so the route is
// gated as hard as the panel that draws it.

import { NextRequest, NextResponse } from 'next/server'
import { canViewRosterLabourCost } from '@/lib/authz'
import { YMD_PATTERN, buildRosterLabourReport } from '@/lib/roster/labour-target-report'

export type { RosterLabourDay } from '@/lib/roster/labour-target-report'

export async function GET(request: NextRequest) {
  if (!(await canViewRosterLabourCost())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = (searchParams.get('startDate') || '').slice(0, 10)
  const endDate = (searchParams.get('endDate') || '').slice(0, 10)

  if (!YMD_PATTERN.test(startDate) || !YMD_PATTERN.test(endDate) || endDate < startDate) {
    return NextResponse.json({ error: 'startDate and endDate must be YYYY-MM-DD, start first' }, { status: 400 })
  }

  try {
    return NextResponse.json(await buildRosterLabourReport(startDate, endDate))
  } catch (error) {
    console.error('Error building roster labour target:', error)
    return NextResponse.json({ error: 'Failed to build roster labour target' }, { status: 500 })
  }
}
