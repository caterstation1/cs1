import { NextResponse } from 'next/server'
import type { FcpTaskStatus } from '@/generated/prisma'
import { addDaysNZ, formatNZYMD, getNZDateRangeForYmd } from '@/lib/date-utils'
import { requireRole } from '@/lib/authz'
import { parseRuleConfig } from '@/lib/fcp/bridge'
import { prisma } from '@/lib/prisma'

type GroupedTasks = Record<string, Partial<Record<FcpTaskStatus | 'UNKNOWN', unknown[]>>>

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const todayYmd = formatNZYMD(new Date())
  const { start, end } = getNZDateRangeForYmd(todayYmd)
  const weekStartYmd = addDaysNZ(todayYmd, -((new Date(start).getUTCDay() + 6) % 7))
  const { start: weekStart } = getNZDateRangeForYmd(weekStartYmd)

  try {
    const tasks = await prisma.fcpTask.findMany({
      where: {
        OR: [
          // Today's due window (all statuses)
          {
            dueAt: {
              gte: start,
              lte: end,
            },
          },
          // Weekly checks should stay visible Monday -> Sunday until completed.
          {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            dueAt: {
              gte: weekStart,
              lt: start,
            },
            rule: {
              frequency: 'WEEKLY',
            },
          },
        ],
      },
      include: {
        rule: {
          include: {
            card: true,
          },
        },
        asset: true,
        incident: true,
        records: {
          orderBy: [{ recordedAt: 'desc' }],
          take: 10,
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    })

    const grouped = tasks.reduce<GroupedTasks>((acc, task) => {
      const config = parseRuleConfig(task.rule.config)
      const category = config.dashboardCategory ?? 'Uncategorized'
      const status = task.status ?? 'UNKNOWN'

      if (!acc[category]) acc[category] = {}
      if (!acc[category][status]) acc[category][status] = []
      acc[category][status].push(task)
      return acc
    }, {})

    return NextResponse.json({
      data: {
        date: todayYmd,
        grouped,
      },
      meta: {
        totalTasks: tasks.length,
      },
    })
  } catch (error) {
    console.error('fcp tasks today GET error', error)
    return NextResponse.json({ error: 'Failed to fetch today FCP tasks' }, { status: 500 })
  }
}
