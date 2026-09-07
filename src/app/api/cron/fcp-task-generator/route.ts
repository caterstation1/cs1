import { NextRequest, NextResponse } from 'next/server'
import { formatNZYMD, getNZDateRangeForYmd } from '@/lib/date-utils'
import { isYmd } from '@/lib/fcp/bridge'
import { generateFcpTasksForDate } from '@/lib/fcp/task-generator'

function resolveTargetDate(dateParam: string | null): Date | null {
  if (!dateParam) {
    return getNZDateRangeForYmd(formatNZYMD(new Date())).start
  }
  if (!isYmd(dateParam)) return null
  return getNZDateRangeForYmd(dateParam).start
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dateParam = request.nextUrl.searchParams.get('date')
    const targetDate = resolveTargetDate(dateParam)
    if (!targetDate) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const result = await generateFcpTasksForDate(targetDate)

    return NextResponse.json({
      data: {
        targetDate: formatNZYMD(targetDate),
        createdTasks: result.createdTasks,
        skippedExisting: result.skippedExisting,
      },
      meta: {
        placeholders: result.placeholders,
        idempotentByDate: true,
        generator: 'generateFcpTasksForDate',
      },
    })
  } catch (error) {
    console.error('fcp task generator cron failed:', error)
    return NextResponse.json({ error: 'Failed to run FCP task generator cron' }, { status: 500 })
  }
}
