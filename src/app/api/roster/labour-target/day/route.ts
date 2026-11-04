// One day's rostered labour cost against target, for the calendar roster
// drawer. Same figures as the weekly roster page, narrower audience: this one
// answers only to the named people, not to every owner. The 403 is the access
// control — the drawer panel just hides itself off the back of it.

import { NextRequest, NextResponse } from 'next/server'
import { isRosterLabourCostNamedUser } from '@/lib/authz'
import { YMD_PATTERN, buildRosterLabourReport } from '@/lib/roster/labour-target-report'

export async function GET(request: NextRequest) {
  if (!(await isRosterLabourCostNamedUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date = (searchParams.get('date') || '').slice(0, 10)

  if (!YMD_PATTERN.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  try {
    const report = await buildRosterLabourReport(date, date)
    return NextResponse.json({ targetRate: report.targetRate, day: report.days[0] ?? null })
  } catch (error) {
    console.error('Error building roster labour target for day:', error)
    return NextResponse.json({ error: 'Failed to build roster labour target' }, { status: 500 })
  }
}
