import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseRangePreset, resolveBusinessDate } from '@/lib/accounting'

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

    const { start, end, bucket } = parseRangePreset(rangePreset)
    const dateKey: any = useBusinessDate ? 'deliveryDateResolved' : 'createdAt'
    const where: any = { [dateKey]: { gte: start, lte: end } }
    if (!includeCancelled) where.cancelledAt = null
    if (!includeUnpaid) where.financialStatus = { in: ['paid', 'partially_paid'] }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { [dateKey]: 'asc' },
      select: {
        id: true,
        customerEmail: true,
        totalPrice: true,
        createdAt: true,
        deliveryDateResolved: true,
        financialStatus: true,
        cancelledAt: true,
      },
    })

    // Monthly buckets between start..end (use week as month proxy if bucket=week)
    const buckets: string[] = []
    {
      const cur = new Date(start)
      cur.setDate(1)
      while (cur <= end) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        buckets.push(`${y}-${m}`)
        cur.setMonth(cur.getMonth() + 1)
      }
    }

    const withinRange = orders.filter(o => {
      if (o.cancelledAt && !includeCancelled) return false
      const fin = String(o.financialStatus || '').toLowerCase()
      const isUnpaid = !(fin === 'paid' || fin === 'partially_paid')
      if (isUnpaid && !includeUnpaid) return false
      return true
    })

    // Distinct emails in range
    const emails = Array.from(new Set(withinRange.map(o => String(o.customerEmail || '').toLowerCase()).filter(Boolean)))

    // First-ever order date per email (prefer business date, fallback createdAt)
    // Use groupBy to get min across all time for performance
    const minByEmailBusiness = await prisma.order.groupBy({
      by: ['customerEmail'],
      where: { customerEmail: { in: emails }, deliveryDateResolved: { not: null } },
      _min: { deliveryDateResolved: true },
    })
    const minBusMap = new Map<string, Date>(
      minByEmailBusiness.map(r => [String(r.customerEmail || '').toLowerCase(), r._min.deliveryDateResolved! as unknown as Date])
    )
    // Fallback: createdAt for those without deliveryDateResolved ever
    const missingBus = emails.filter(e => !minBusMap.has(e))
    if (missingBus.length > 0) {
      const minByCreated = await prisma.order.groupBy({
        by: ['customerEmail'],
        where: { customerEmail: { in: missingBus } },
        _min: { createdAt: true },
      })
      for (const r of minByCreated) {
        const k = String(r.customerEmail || '').toLowerCase()
        const d = r._min.createdAt as unknown as Date
        if (k && d) minBusMap.set(k, d)
      }
    }

    // New vs Returning per month
    const monthly = buckets.map(m => ({ month: m, newCustomers: 0, returningCustomers: 0, orders: 0, revenue: 0 }))
    const monthIndex = new Map<string, number>(monthly.map((m, i) => [m.month, i]))

    for (const o of withinRange) {
      const when = resolveBusinessDate(o)
      const mKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
      const idx = monthIndex.get(mKey)
      if (idx == null) continue
      monthly[idx].orders += 1
      monthly[idx].revenue += Number(o.totalPrice || 0)
      const email = String(o.customerEmail || '').toLowerCase()
      const firstEver = minBusMap.get(email)
      if (!firstEver) continue
      const isNew = firstEver.getFullYear() === when.getFullYear() && firstEver.getMonth() === when.getMonth()
      if (isNew) monthly[idx].newCustomers += 1
      else monthly[idx].returningCustomers += 1
    }

    // Repeat rates: customers whose first-ever order is within [start..end]
    const firstInRange = emails
      .map(e => ({ email: e, first: minBusMap.get(e) }))
      .filter(x => x.first && x.first! >= start && x.first! <= end) as { email: string; first: Date }[]

    // For these customers, check if they ordered again within 30/60/90 days after first
    let r30 = 0, r60 = 0, r90 = 0
    if (firstInRange.length > 0) {
      const byEmail = new Map<string, Date>(firstInRange.map(x => [x.email, x.first]))
      // Load all subsequent orders for these emails up to first+90d
      const minStart = new Date(Math.min(...firstInRange.map(x => x.first.getTime())))
      const maxEnd = new Date(Math.max(...firstInRange.map(x => x.first.getTime())))
      maxEnd.setDate(maxEnd.getDate() + 90)
      const more = await prisma.order.findMany({
        where: {
          customerEmail: { in: Array.from(byEmail.keys()) },
          // we use createdAt range to keep it broad; filtering per-customer below
          createdAt: { gte: minStart, lte: maxEnd },
        },
        select: { customerEmail: true, createdAt: true, deliveryDateResolved: true },
      })
      const ordersByEmail = new Map<string, Date[]>()
      for (const m of more) {
        const email = String(m.customerEmail || '').toLowerCase()
        const when = (m.deliveryDateResolved ? new Date(m.deliveryDateResolved as any) : new Date(m.createdAt as any))
        const list = ordersByEmail.get(email) || []
        list.push(when)
        ordersByEmail.set(email, list)
      }
      for (const { email, first } of firstInRange) {
        const list = (ordersByEmail.get(email) || []).filter(d => d.getTime() !== first.getTime())
        const within = (days: number) => list.some(d => (d.getTime() - first.getTime()) / (1000 * 60 * 60 * 24) <= days && d >= first)
        if (within(30)) r30++
        if (within(60)) r60++
        if (within(90)) r90++
      }
    }
    const denom = Math.max(1, firstInRange.length)
    const repeat30 = Number(((r30 / denom) * 100).toFixed(1))
    const repeat60 = Number(((r60 / denom) * 100).toFixed(1))
    const repeat90 = Number(((r90 / denom) * 100).toFixed(1))

    // AOV trend (monthly)
    const aov = monthly.map(m => {
      const orders = m.orders
      const value = orders > 0 ? Number((m.revenue / orders).toFixed(2)) : 0
      return { month: m.month, aov: value }
    })

    return NextResponse.json({
      params: { rangePreset, includeCancelled, includeUnpaid, useBusinessDate, bucket },
      monthly,
      repeatRates: { baseCustomers: firstInRange.length, repeat30, repeat60, repeat90 },
      aov,
    })
  } catch (error) {
    console.error('❌ Error in customer-cohorts:', error)
    return NextResponse.json({ error: 'Failed to compute customer cohorts' }, { status: 500 })
  }
}

