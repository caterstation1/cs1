import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, formatLocalDate, createLocalDate, getNZDateRangeForYmd } from '@/lib/date-utils'

function getPeriodRangeDates(period: string): { start: Date; end: Date } {
  const today = getTodayLocal()
  const todayStr = formatLocalDate(today)
  if (period === 'today') {
    const { start, end } = getNZDateRangeForYmd(todayStr)
    return { start, end }
  }
  if (period === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1)
    const ys = formatLocalDate(y)
    const { start, end } = getNZDateRangeForYmd(ys)
    return { start, end }
  }
  if (period === 'week') {
    const startOfWeek = new Date(today)
    const dow = today.getDay()
    const daysToMonday = dow === 0 ? 6 : dow - 1
    startOfWeek.setDate(today.getDate() - daysToMonday)
    const { start } = getNZDateRangeForYmd(formatLocalDate(startOfWeek))
    const { end } = getNZDateRangeForYmd(todayStr)
    return { start, end }
  }
  if (period === 'month') {
    const som = createLocalDate(today.getFullYear(), today.getMonth() + 1, 1)
    const { start } = getNZDateRangeForYmd(formatLocalDate(som))
    const { end } = getNZDateRangeForYmd(todayStr)
    return { start, end }
  }
  if (period === 'year') {
    const soy = createLocalDate(today.getFullYear(), 1, 1)
    const { start } = getNZDateRangeForYmd(formatLocalDate(soy))
    const { end } = getNZDateRangeForYmd(todayStr)
    return { start, end }
  }
  const { start, end } = getNZDateRangeForYmd(todayStr)
  return { start, end }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') || 'today').toLowerCase()
    const { start, end } = getPeriodRangeDates(period)

    const shifts = await prisma.shift.findMany({
      where: {
        date: { gte: start, lte: end }
      },
      include: { staff: true },
      orderBy: { date: 'asc' }
    })

    type StaffAgg = {
      staffId: string
      name: string
      payRate: number
      totalHours: number
      totalCost: number
      shifts: Array<{
        id: string
        date: string
        clockIn: string | null
        clockOut: string | null
        hours: number
        cost: number
        notes: string | null
      }>
    }

    const byStaff = new Map<string, StaffAgg>()
    for (const s of shifts) {
      const staffId = s.staffId
      const name = s.staff ? `${s.staff.firstName} ${s.staff.lastName}` : 'Unknown'
      const payRate = Number((s as any).staff?.payRate || 0)
      let hours = typeof s.totalHours === 'number' ? s.totalHours : null
      if (hours == null) {
        if (s.clockIn && s.clockOut) {
          const diffMs = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()
          hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0
        } else {
          hours = 0
        }
      }
      const cost = payRate * (hours || 0)
      const rec: StaffAgg = byStaff.get(staffId) || {
        staffId, name, payRate,
        totalHours: 0,
        totalCost: 0,
        shifts: []
      }
      rec.totalHours += (hours || 0)
      rec.totalCost += cost
      rec.shifts.push({
        id: s.id,
        date: formatLocalDate(new Date(s.date)),
        clockIn: s.clockIn ? new Date(s.clockIn).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }) : null,
        clockOut: s.clockOut ? new Date(s.clockOut).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }) : null,
        hours: Number((hours || 0).toFixed(2)),
        cost: Number(cost.toFixed(2)),
        notes: s.notes || null
      })
      byStaff.set(staffId, rec)
    }

    const staff = Array.from(byStaff.values()).sort((a, b) => b.totalCost - a.totalCost)
    const totals = {
      staffCount: staff.length,
      totalHours: Number(staff.reduce((s, it) => s + it.totalHours, 0).toFixed(2)),
      totalCost: Number(staff.reduce((s, it) => s + it.totalCost, 0).toFixed(2))
    }

    return NextResponse.json({ period, start, end, staff, totals })
  } catch (e) {
    console.error('❌ Staff breakdown error:', e)
    return NextResponse.json({ error: 'Failed to load staff breakdown' }, { status: 500 })
  }
}

