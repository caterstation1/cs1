import { prisma } from '@/lib/prisma'
import { addDaysNZ, formatNZYMD, getNZDateRangeForYmd } from '@/lib/date-utils'
import { ToolResult } from '../schemas'

export async function toolStaffOnShift(): Promise<ToolResult> {
  const activeShifts = await prisma.shift.findMany({
    where: { clockOut: null, status: 'active' },
    include: { staff: { select: { firstName: true, lastName: true, isDriver: true, accessLevel: true } } },
    orderBy: { clockIn: 'desc' },
    take: 20,
  })

  if (activeShifts.length === 0) {
    return { answer: 'Nobody is currently clocked in.', confidence: 0.9, evidence: { totals: { count: 0 } } }
  }

  const rows = activeShifts.map((s) => ({
    name: `${s.staff.firstName} ${s.staff.lastName}`.trim(),
    role: s.staff.accessLevel,
    driver: s.staff.isDriver ? 'yes' : 'no',
    clockedIn: s.clockIn ? new Date(s.clockIn).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' }) : '—',
  }))

  return {
    answer: `${activeShifts.length} staff member${activeShifts.length === 1 ? '' : 's'} currently clocked in.`,
    confidence: 0.92,
    evidence: {
      totals: { count: activeShifts.length },
      tables: [{ name: 'Clocked in now', rows }],
      links: [{ label: 'Timesheet', href: '/timesheet' }],
    },
  }
}

export async function toolFcpTasksToday(): Promise<ToolResult> {
  const todayYmd = formatNZYMD(new Date())
  const { start, end } = getNZDateRangeForYmd(todayYmd)
  const weekStartYmd = addDaysNZ(todayYmd, -((new Date(start).getUTCDay() + 6) % 7))
  const { start: weekStart } = getNZDateRangeForYmd(weekStartYmd)

  const tasks = await prisma.fcpTask.findMany({
    where: {
      OR: [
        { dueAt: { gte: start, lte: end } },
        {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueAt: { gte: weekStart, lt: start },
          rule: { frequency: 'WEEKLY' },
        },
      ],
    },
    include: {
      rule: { include: { card: { select: { title: true } } } },
      asset: { select: { name: true } },
    },
    orderBy: [{ dueAt: 'asc' }],
    take: 15,
  })

  const open = tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS')
  const rows = tasks.slice(0, 10).map((t) => ({
    task: t.rule?.card?.title || 'Task',
    status: t.status,
    due: t.dueAt ? new Date(t.dueAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' }) : '—',
    asset: t.asset?.name || '—',
  }))

  if (tasks.length === 0) {
    return {
      answer: 'No FCP tasks due today.',
      confidence: 0.88,
      evidence: {
        totals: { total: 0, open: 0 },
        links: [{ label: 'FCP dashboard', href: '/fcp' }],
      },
    }
  }

  return {
    answer: `${tasks.length} FCP task${tasks.length === 1 ? '' : 's'} due today (${open.length} still open).`,
    confidence: 0.9,
    evidence: {
      totals: { total: tasks.length, open: open.length },
      tables: [{ name: 'FCP tasks', rows }],
      links: [{ label: 'FCP dashboard', href: '/fcp' }],
    },
  }
}
