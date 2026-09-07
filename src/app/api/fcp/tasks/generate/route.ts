import { NextRequest, NextResponse } from 'next/server'
import { formatNZYMD, getNZDateRangeForYmd } from '@/lib/date-utils'
import { requireRole } from '@/lib/authz'
import { isYmd } from '@/lib/fcp/bridge'
import { generateFcpTasksForDate } from '@/lib/fcp/task-generator'

function toTargetDate(value?: string | null): Date | null {
  if (!value) return new Date()
  if (!isYmd(value)) return null
  return getNZDateRangeForYmd(value).start
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const queryDate = request.nextUrl.searchParams.get('date')
  let bodyDate: string | null = null

  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { date?: string }
      bodyDate = body.date ?? null
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const selectedDate = bodyDate ?? queryDate
  const targetDate = toTargetDate(selectedDate)
  if (!targetDate) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  try {
    const result = await generateFcpTasksForDate(targetDate)
    return NextResponse.json({
      data: {
        targetDate: formatNZYMD(targetDate),
        createdTasks: result.createdTasks,
        skippedExisting: result.skippedExisting,
      },
      meta: {
        placeholders: result.placeholders,
      },
    })
  } catch (error) {
    console.error('fcp tasks generate POST error', error)
    return NextResponse.json({ error: 'Failed to generate FCP tasks' }, { status: 500 })
  }
}
