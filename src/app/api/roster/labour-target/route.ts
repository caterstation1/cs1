// Rostered labour cost per day against a target of 10% of that day's
// delivered sales. Payroll rates and revenue in one payload, so the route is
// gated as hard as the panel that draws it.

import { NextRequest, NextResponse } from 'next/server'
import { canViewRosterLabourCost } from '@/lib/authz'
import { GST_RATE } from '@/lib/cogs'
import { formatNZYMD } from '@/lib/date-utils'
import { prisma } from '@/lib/prisma'
import {
  LABOUR_TARGET_RATE,
  type RosterShiftInput,
  type UncostedShift,
  labourTarget,
  labourTone,
  rosterDayCost,
} from '@/lib/roster/labour-target'

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Both RosterAssignment.date and Order.deliveryDateResolved sit at UTC midnight. */
function utcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function round2(n: number): number {
  return Number((Math.round(n * 100) / 100).toFixed(2))
}

function eachYmd(startYmd: string, endYmd: string): string[] {
  const out: string[] = []
  const cursor = utcMidnight(startYmd)
  const end = utcMidnight(endYmd)
  while (cursor <= end && out.length < 62) {
    out.push(ymdOf(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export interface RosterLabourDay {
  date: string
  cost: number
  hours: number
  shiftCount: number
  /** Ex-GST value delivered that day; null when the day has no orders yet. */
  salesExGst: number | null
  orderCount: number
  target: number | null
  variance: number | null
  tone: 'green' | 'amber' | 'red' | null
  uncosted: UncostedShift[]
}

export async function GET(request: NextRequest) {
  if (!(await canViewRosterLabourCost())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = (searchParams.get('startDate') || '').slice(0, 10)
  const endDate = (searchParams.get('endDate') || '').slice(0, 10)

  if (!YMD_PATTERN.test(startDate) || !YMD_PATTERN.test(endDate) || endDate < startDate) {
    return NextResponse.json({ error: 'startDate and endDate must be YYYY-MM-DD, start first' }, { status: 400 })
  }

  try {
    const rangeStart = utcMidnight(startDate)
    const rangeEnd = utcMidnight(endDate)

    const [assignments, orders] = await Promise.all([
      prisma.rosterAssignment.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        select: {
          id: true,
          staffId: true,
          date: true,
          startTime: true,
          endTime: true,
          staff: { select: { firstName: true, lastName: true, payRate: true } },
          shiftType: { select: { startTime: true, endTime: true } },
        },
      }),
      // Cancelled orders are not sales, and deliveryDateResolved is the only
      // delivery date that is populated on every order.
      prisma.order.findMany({
        where: { deliveryDateResolved: { gte: rangeStart, lte: rangeEnd }, cancelledAt: null },
        select: { deliveryDateResolved: true, totalPrice: true },
      }),
    ])

    const shiftsByDay = new Map<string, RosterShiftInput[]>()
    for (const a of assignments) {
      const key = ymdOf(a.date)
      const bucket = shiftsByDay.get(key) ?? []
      // A shift type, when attached, is what the grid displays, so it is what
      // we cost — the custom pair is only a fallback.
      bucket.push({
        id: a.id,
        staffId: a.staffId,
        staffName: `${a.staff.firstName} ${a.staff.lastName}`.trim(),
        payRate: a.staff.payRate,
        startTime: a.shiftType?.startTime ?? a.startTime,
        endTime: a.shiftType?.endTime ?? a.endTime,
      })
      shiftsByDay.set(key, bucket)
    }

    const salesByDay = new Map<string, { incGst: number; orderCount: number }>()
    for (const order of orders) {
      if (!order.deliveryDateResolved) continue
      const key = ymdOf(order.deliveryDateResolved)
      const bucket = salesByDay.get(key) ?? { incGst: 0, orderCount: 0 }
      bucket.incGst += Number(order.totalPrice || 0)
      bucket.orderCount += 1
      salesByDay.set(key, bucket)
    }

    const todayYmd = formatNZYMD(new Date())

    const days: RosterLabourDay[] = eachYmd(startDate, endDate).map((ymd) => {
      const day = rosterDayCost(shiftsByDay.get(ymd) ?? [])
      const sales = salesByDay.get(ymd)

      // A future day with nothing booked has not sold nothing — it has not
      // sold yet. Reporting a $0 target there would read as an instant
      // overspend on any day the roster is planned ahead of the orders.
      const pending = !sales && ymd > todayYmd
      const salesExGst = sales ? round2(sales.incGst / GST_RATE) : pending ? null : 0
      const target = salesExGst === null ? null : labourTarget(sales ? sales.incGst / GST_RATE : 0)

      return {
        date: ymd,
        cost: day.cost,
        hours: day.hours,
        shiftCount: day.shiftCount,
        salesExGst,
        orderCount: sales?.orderCount ?? 0,
        target,
        variance: target === null ? null : round2(day.cost - target),
        tone: labourTone(day.cost, target),
        uncosted: day.uncosted,
      }
    })

    const totalCost = round2(days.reduce((sum, d) => sum + d.cost, 0))
    const measured = days.filter((d) => d.target !== null)
    const totalTarget = measured.length > 0 ? round2(measured.reduce((sum, d) => sum + (d.target || 0), 0)) : null

    return NextResponse.json({
      startDate,
      endDate,
      targetRate: LABOUR_TARGET_RATE,
      days,
      total: {
        cost: totalCost,
        hours: round2(days.reduce((sum, d) => sum + d.hours, 0)),
        shiftCount: days.reduce((sum, d) => sum + d.shiftCount, 0),
        salesExGst: measured.length > 0 ? round2(measured.reduce((sum, d) => sum + (d.salesExGst || 0), 0)) : null,
        target: totalTarget,
        variance: totalTarget === null ? null : round2(totalCost - totalTarget),
        tone: labourTone(totalCost, totalTarget),
        // A week total that silently omits days nobody has ordered for yet
        // would flatter itself, so say how many days it covers.
        measuredDayCount: measured.length,
        uncostedCount: days.reduce((sum, d) => sum + d.uncosted.length, 0),
      },
    })
  } catch (error) {
    console.error('Error building roster labour target:', error)
    return NextResponse.json({ error: 'Failed to build roster labour target' }, { status: 500 })
  }
}
