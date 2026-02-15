import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getNZDateRangeForYmd, formatNZYMD } from '@/lib/date-utils'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }
    const startDt = getNZDateRangeForYmd(startDateStr).start
    const endDt = getNZDateRangeForYmd(endDateStr).end

    const shifts = await prisma.shift.findMany({
      where: { date: { gte: startDt, lte: endDt } },
      include: { staff: true, reimbursements: true },
      orderBy: { date: 'asc' },
    })

    const active = await prisma.shift.findMany({
      where: { clockOut: null, status: 'active' },
      select: { staffId: true },
    })
    const activeSet = new Set(active.map(a => a.staffId))

    type StaffAgg = {
      staffId: string
      name: string
      isActiveNow: boolean
      totals: { hours: number; shifts: number; mileage: number; reimbursements: number; notesCount: number }
      byDay: Array<{ date: string; hours: number; shiftsCount: number; mileage: number; reimbursements: number; notesCount: number; shiftIds: string[] }>
    }
    const byStaff = new Map<string, StaffAgg>()
    for (const s of shifts) {
      const name = `${(s as any).staff?.firstName || ''} ${(s as any).staff?.lastName || ''}`.trim()
      if (q && !name.toLowerCase().includes(q)) continue
      const key = s.staffId
      const row = byStaff.get(key) || {
        staffId: key,
        name,
        isActiveNow: activeSet.has(key),
        totals: { hours: 0, shifts: 0, mileage: 0, reimbursements: 0, notesCount: 0 },
        byDay: [],
      }
          const ymd = formatNZYMD(new Date(s.date))
      let day = row.byDay.find(d => d.date === ymd)
      if (!day) {
        day = { date: ymd, hours: 0, shiftsCount: 0, mileage: 0, reimbursements: 0, notesCount: 0, shiftIds: [] }
        row.byDay.push(day)
      }
      const hours = typeof s.totalHours === 'number' ? s.totalHours : 0
      const mileage = typeof s.mileage === 'number' ? s.mileage : 0
      const reimb = Array.isArray(s.reimbursements) ? s.reimbursements.reduce((a, r) => a + (r.amount || 0), 0) : 0
      const notesCount = s.notes && s.notes.trim().length > 0 ? 1 : 0
      row.totals.hours += hours
      row.totals.shifts += 1
      row.totals.mileage += mileage
      row.totals.reimbursements += reimb
      row.totals.notesCount += notesCount
      day.hours += hours
      day.shiftsCount += 1
      day.mileage += mileage
      day.reimbursements += reimb
      day.notesCount += notesCount
      day.shiftIds.push(s.id)
      byStaff.set(key, row)
    }

    const result = Array.from(byStaff.values()).sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(result)
  } catch (e) {
    console.error('admin/staff error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

