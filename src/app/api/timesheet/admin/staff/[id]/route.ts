import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getNZDateRangeForYmd, formatNZYMD } from '@/lib/date-utils'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await context.params
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const staffId = paramId
    const { searchParams } = new URL(req.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }
    const startDt = getNZDateRangeForYmd(startDateStr).start
    const endDt = getNZDateRangeForYmd(endDateStr).end

    const staff = await prisma.staff.findUnique({ where: { id: staffId } })
    const shifts = await prisma.shift.findMany({
      where: { staffId, date: { gte: startDt, lte: endDt } },
      include: { reimbursements: true },
      orderBy: { date: 'asc' },
    })

    const byDayMap = new Map<string, any>()
    let totals = { hours: 0, shifts: 0, mileage: 0, reimbursements: 0, notesCount: 0 }
    for (const s of shifts) {
        const ymd = formatNZYMD(new Date(s.date))
      const hours = typeof s.totalHours === 'number' ? s.totalHours : 0
      const mileage = typeof s.mileage === 'number' ? s.mileage : 0
      const reimb = Array.isArray(s.reimbursements) ? s.reimbursements.reduce((a, r) => a + (r.amount || 0), 0) : 0
      const notesCount = s.notes && s.notes.trim().length > 0 ? 1 : 0
      totals.hours += hours
      totals.shifts += 1
      totals.mileage += mileage
      totals.reimbursements += reimb
      totals.notesCount += notesCount
      const day = byDayMap.get(ymd) || { date: ymd, hours: 0, shiftsCount: 0, mileage: 0, reimbursements: 0, notesCount: 0, shiftIds: [] }
      day.hours += hours
      day.shiftsCount += 1
      day.mileage += mileage
      day.reimbursements += reimb
      day.notesCount += notesCount
      day.shiftIds.push(s.id)
      byDayMap.set(ymd, day)
    }
    const byDay = Array.from(byDayMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date))

    const payload = {
      staff: {
        id: staff?.id,
        name: `${(staff as any)?.firstName || ''} ${(staff as any)?.lastName || ''}`.trim(),
        phone: (staff as any)?.phone || '',
      },
      totals,
      byDay,
      shifts: shifts.map(s => ({
        id: s.id,
        clockIn: s.clockIn,
        clockOut: s.clockOut,
        totalHours: s.totalHours,
        date: s.date,
        mileage: s.mileage,
        notes: s.notes,
        reimbursements: s.reimbursements?.map(r => ({ id: r.id, amount: r.amount, description: r.description, createdAt: r.createdAt })) || [],
      })),
    }
    return NextResponse.json(payload)
  } catch (e) {
    console.error('admin/staff/[id] error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

