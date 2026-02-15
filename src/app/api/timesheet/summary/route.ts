import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getNZDateRangeForYmd } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Admin/Owner only
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const staffIdsParam = searchParams.get('staffIds') // comma-separated
    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: 'startDate and endDate are required (YYYY-MM-DD)' }, { status: 400 })
    }

        const startDt = getNZDateRangeForYmd(startDateStr).start
        const endDt = getNZDateRangeForYmd(endDateStr).end

    const staffFilter = staffIdsParam
      ? { staffId: { in: staffIdsParam.split(',').filter(Boolean) } }
      : {}

    const shifts = await prisma.shift.findMany({
      where: {
        date: { gte: startDt, lte: endDt },
        ...staffFilter,
      },
      include: {
        staff: true,
        reimbursements: true,
      },
      orderBy: { date: 'asc' },
    })

    type Row = {
      staffId: string
      name: string
      totalHours: number
      totalMileage: number
      reimbursementsTotal: number
      shiftsCount: number
      notesCount: number
    }
    const byStaff = new Map<string, Row>()
    for (const s of shifts) {
      const key = s.staffId
      const name = `${(s as any).staff?.firstName || ''} ${(s as any).staff?.lastName || ''}`.trim()
      const existing = byStaff.get(key) || {
        staffId: key,
        name,
        totalHours: 0,
        totalMileage: 0,
        reimbursementsTotal: 0,
        shiftsCount: 0,
        notesCount: 0,
      }
      const hours = typeof s.totalHours === 'number' ? s.totalHours : 0
      const mileage = typeof s.mileage === 'number' ? s.mileage : 0
      const reimbursements = Array.isArray(s.reimbursements)
        ? s.reimbursements.reduce((acc, r) => acc + (r.amount || 0), 0)
        : 0
      const notesCount = s.notes && s.notes.trim().length > 0 ? 1 : 0
      existing.totalHours += hours
      existing.totalMileage += mileage
      existing.reimbursementsTotal += reimbursements
      existing.shiftsCount += 1
      existing.notesCount += notesCount
      byStaff.set(key, existing)
    }

    const rows = Array.from(byStaff.values()).sort((a, b) => a.name.localeCompare(b.name))
    const overall = {
      staffId: 'ALL',
      name: 'All Staff',
      totalHours: rows.reduce((a, r) => a + r.totalHours, 0),
      totalMileage: rows.reduce((a, r) => a + r.totalMileage, 0),
      reimbursementsTotal: rows.reduce((a, r) => a + r.reimbursementsTotal, 0),
      shiftsCount: rows.reduce((a, r) => a + r.shiftsCount, 0),
      notesCount: rows.reduce((a, r) => a + r.notesCount, 0),
    }

    return NextResponse.json({ startDate: startDateStr, endDate: endDateStr, rows, overall })
  } catch (error) {
    console.error('❌ Error generating timesheet summary:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}

