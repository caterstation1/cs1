import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseRangePreset, resolveBusinessDate, bucketKey } from '@/lib/accounting'

function toBool(v: string | null, def = true): boolean {
  if (v == null) return def
  const s = v.toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rangePreset = (searchParams.get('rangePreset') || '12M') as any
    const includeCancelled = toBool(searchParams.get('includeCancelled'), false)
    const includeUnpaid = toBool(searchParams.get('includeUnpaid'), false)
    const useBusinessDate = toBool(searchParams.get('useBusinessDate'), true)
    const bucketParam = (searchParams.get('bucket') || 'week') as 'day' | 'week'

    const { start, end } = parseRangePreset(rangePreset)
    const bucket = bucketParam

    // Orders revenue inc-GST by bucket
    const dateKey: any = useBusinessDate ? 'deliveryDateResolved' : 'createdAt'
    const where: any = { [dateKey]: { gte: start, lte: end } }
    if (!includeCancelled) where.cancelledAt = null
    if (!includeUnpaid) where.financialStatus = { in: ['paid', 'partially_paid'] }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true, totalPrice: true, createdAt: true, deliveryDateResolved: true
      }
    })

    const revenueByBucket = new Map<string, number>()
    for (const o of orders) {
      const when = useBusinessDate ? resolveBusinessDate(o) : new Date(o.createdAt as any)
      const key = bucketKey(when, bucket)
      const r = Number(o.totalPrice || 0)
      revenueByBucket.set(key, (revenueByBucket.get(key) || 0) + r)
    }

    // Shifts: hours and labour cost
    const shifts = await prisma.shift.findMany({
      where: { date: { gte: start, lte: end } },
      include: { staff: true },
      orderBy: { date: 'asc' }
    })

    const labourByBucket = new Map<string, { hours: number; cost: number }>()
    for (const s of shifts as any[]) {
      const when = new Date(s.date)
      const key = bucketKey(when, bucket)
      let hours: number | null = typeof s.totalHours === 'number' ? s.totalHours : null
      if (hours == null) {
        if (s.clockIn && s.clockOut) {
          const diffMs = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()
          hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0
        } else {
          hours = 0
        }
      }
      const pay = Number(s?.staff?.payRate || 0)
      const cost = pay * (hours || 0)
      const got = labourByBucket.get(key) || { hours: 0, cost: 0 }
      got.hours += hours || 0
      got.cost += cost
      labourByBucket.set(key, got)
    }

    // Merge keys
    const keys = Array.from(new Set([...revenueByBucket.keys(), ...labourByBucket.keys()])).sort()
    const series = keys.map(k => {
      const revenue = Number((revenueByBucket.get(k) || 0).toFixed(2))
      const hours = Number((labourByBucket.get(k)?.hours || 0).toFixed(2))
      const labourCost = Number((labourByBucket.get(k)?.cost || 0).toFixed(2))
      const labourPct = revenue > 0 ? Number(((labourCost / revenue) * 100).toFixed(1)) : 0
      const salesPerHour = hours > 0 ? Number((revenue / hours).toFixed(2)) : 0
      return { date: k, revenue, labourHours: hours, labourCost, labourPct, salesPerHour }
    })

    const totals = series.reduce(
      (acc, p) => {
        acc.revenue += p.revenue
        acc.hours += p.labourHours
        acc.cost += p.labourCost
        return acc
      },
      { revenue: 0, hours: 0, cost: 0 }
    )
    const labourPct = totals.revenue > 0 ? Number(((totals.cost / totals.revenue) * 100).toFixed(1)) : 0
    const salesPerHour = totals.hours > 0 ? Number((totals.revenue / totals.hours).toFixed(2)) : 0

    return NextResponse.json({
      params: { rangePreset, includeCancelled, includeUnpaid, useBusinessDate, bucket },
      kpis: {
        labourPct,
        totalLabourHours: Number(totals.hours.toFixed(2)),
        salesPerHour,
      },
      series,
    })
  } catch (error) {
    console.error('❌ Error in labour-efficiency:', error)
    return NextResponse.json({ error: 'Failed to compute labour efficiency' }, { status: 500 })
  }
}

