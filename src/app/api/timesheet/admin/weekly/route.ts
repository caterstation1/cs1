import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getNZDateRangeForYmd, addDaysNZ, formatNZYMD } from '@/lib/date-utils'

function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  const day = d.getDay() // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1 - day) // move to Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff, 0, 0, 0, 0)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const weekStartStr = searchParams.get('weekStart')
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    if (!weekStartStr) return NextResponse.json({ error: 'weekStart is required (YYYY-MM-DD)' }, { status: 400 })
    // Assume client provides Monday-aligned NZ date; trust it
    const days: string[] = []
    for (let i = 0; i < 7; i++) {
      days.push(i === 0 ? weekStartStr : addDaysNZ(weekStartStr, i))
    }
    const startDt = getNZDateRangeForYmd(weekStartStr).start
    const endDt = getNZDateRangeForYmd(addDaysNZ(weekStartStr, 6)).end

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

    type DayCell = {
      shifts: Array<{ id: string; clockIn: Date; clockOut: Date | null; totalHours: number | null; mileage: number | null; notes: string | null; reimbursementsTotal: number }>
      totals: { hours: number; mileage: number; reimbursed: number; notesCount: number }
    }
    const byStaff = new Map<string, {
      staffId: string
      name: string
      isActiveNow: boolean
      byDay: Record<string, DayCell>
      totals: { hours: number; mileage: number; reimbursed: number; notesCount: number }
    }>()
    for (const s of shifts) {
      const name = `${(s as any).staff?.firstName || ''} ${(s as any).staff?.lastName || ''}`.trim()
      if (q && !name.toLowerCase().includes(q)) continue
      const key = s.staffId
      const staffRow = byStaff.get(key) || {
        staffId: key,
        name,
        isActiveNow: activeSet.has(key),
        byDay: {},
        totals: { hours: 0, mileage: 0, reimbursed: 0, notesCount: 0 }
      }
      const ymd = formatNZYMD(new Date(s.date))
      const cell = staffRow.byDay[ymd] || {
        shifts: [],
        totals: { hours: 0, mileage: 0, reimbursed: 0, notesCount: 0 }
      }
      const reimb = Array.isArray(s.reimbursements) ? s.reimbursements.reduce((a, r) => a + (r.amount || 0), 0) : 0
      const hours = typeof s.totalHours === 'number' ? s.totalHours : 0
      const mileage = typeof s.mileage === 'number' ? s.mileage : 0
      const notesCount = s.notes && s.notes.trim().length > 0 ? 1 : 0
      cell.shifts.push({
        id: s.id,
        clockIn: s.clockIn,
        clockOut: s.clockOut,
        totalHours: s.totalHours,
        mileage: s.mileage,
        notes: s.notes,
        reimbursementsTotal: reimb
      })
      cell.totals.hours += hours
      cell.totals.mileage += mileage
      cell.totals.reimbursed += reimb
      cell.totals.notesCount += notesCount
      staffRow.byDay[ymd] = cell
      staffRow.totals.hours += hours
      staffRow.totals.mileage += mileage
      staffRow.totals.reimbursed += reimb
      staffRow.totals.notesCount += notesCount
      byStaff.set(key, staffRow)
    }

    const staff = Array.from(byStaff.values()).sort((a, b) => a.name.localeCompare(b.name))
    const overallTotals = staff.reduce((acc, r) => {
      acc.hours += r.totals.hours
      acc.mileage += r.totals.mileage
      acc.reimbursed += r.totals.reimbursed
      acc.notesCount += r.totals.notesCount
      return acc
    }, { hours: 0, mileage: 0, reimbursed: 0, notesCount: 0 })

    return NextResponse.json({
      weekStart: weekStartStr,
      days,
      staff,
      overallTotals
    })
  } catch (e) {
    console.error('weekly error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

