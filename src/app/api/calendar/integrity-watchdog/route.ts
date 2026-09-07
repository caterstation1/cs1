import { NextRequest, NextResponse } from 'next/server'
import { parseCalendarRegion, type CalendarRegion } from '@/lib/calendar-query'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'
import { runCalendarIntegrityWatchdog } from '@/lib/calendar-integrity-watchdog'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const regionParam = searchParams.get('region')
    const daysAhead = Math.min(180, Math.max(1, parseInt(searchParams.get('daysAhead') || '45', 10)))
    const daysBack = Math.min(30, Math.max(0, parseInt(searchParams.get('daysBack') || '1', 10)))
    const strict = searchParams.get('strict') === '1'

    const todayYmd = formatNZYMD(new Date())
    const start = addDaysNZ(todayYmd, -daysBack)
    const endExclusive = addDaysNZ(todayYmd, daysAhead + 1)

    let regions: CalendarRegion[] = ['AKL', 'WLG']
    if (regionParam) {
      const parsed = parseCalendarRegion(regionParam)
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid region. Use AKL or WLG' }, { status: 400 })
      }
      regions = [parsed]
    }

    const result = await runCalendarIntegrityWatchdog({
      start,
      endExclusive,
      regions,
    })

    if (strict && result.totalMismatchCount > 0) {
      return NextResponse.json(result, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Calendar integrity watchdog failed:', error)
    return NextResponse.json({ error: 'Failed to run calendar integrity watchdog' }, { status: 500 })
  }
}
