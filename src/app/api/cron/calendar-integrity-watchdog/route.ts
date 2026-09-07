import { NextRequest, NextResponse } from 'next/server'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'
import { runCalendarIntegrityWatchdog } from '@/lib/calendar-integrity-watchdog'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todayYmd = formatNZYMD(new Date())
    const start = addDaysNZ(todayYmd, -1)
    const endExclusive = addDaysNZ(todayYmd, 46) // today + next 45 days

    const result = await runCalendarIntegrityWatchdog({
      start,
      endExclusive,
      regions: ['AKL', 'WLG'],
    })

    if (result.totalMismatchCount > 0) {
      console.error('❌ Calendar integrity watchdog found mismatches', {
        mismatchCount: result.totalMismatchCount,
        start,
        endExclusive,
      })
      return NextResponse.json(result, { status: 500 })
    }

    console.log('✅ Calendar integrity watchdog passed', {
      start,
      endExclusive,
      generatedAt: result.generatedAt,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Calendar integrity watchdog cron failed:', error)
    return NextResponse.json({ error: 'Failed to run calendar integrity watchdog cron' }, { status: 500 })
  }
}
