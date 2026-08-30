import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTodayLocal, formatLocalDate, formatNZYMD, getNZDateRangeForYmd, addDaysNZ } from '@/lib/date-utils';
import {
  buildCogsIndex,
  lineItemRefs,
  periodTotals,
  revenueExGst,
  round2,
  sumOrderCogs,
  type CogsIndex,
  type PeriodTotals,
} from '@/lib/cogs';
import { autoLockCompletedDays, getCogsLockFrom } from '@/lib/cogs-lock';

// Year-to-date orders on two date bases, plus the party-pack cost index.
export const maxDuration = 60

// Module-scope geocode cache: persists across warm invocations so repeat
// addresses don't re-hit the Google API on every dashboard request.
const geocodeCache = new Map<string, { lat: number; lng: number }>()
const GEOCODE_CACHE_MAX = 1000
const GEOCODE_TIMEOUT_MS = 3000

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim()
  if (!key) return null
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) return null
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(key)}&key=${apiKey}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) })
    if (!resp.ok) return null
    const data = await resp.json()
    if (data.status !== 'OK' || !data.results?.length) return null
    const loc = data.results[0].geometry.location
    const coords = { lat: Number(loc.lat), lng: Number(loc.lng) }
    if (geocodeCache.size >= GEOCODE_CACHE_MAX) geocodeCache.clear()
    geocodeCache.set(key, coords)
    return coords
  } catch {
    return null
  }
}

/** `deliveryDateResolved` is a DATE column, so it is addressed at UTC midnight. */
function utcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

function resolvedYmd(order: { deliveryDateResolved: Date | null }): string | null {
  return order.deliveryDateResolved ? order.deliveryDateResolved.toISOString().slice(0, 10) : null
}

type DeliveryOrder = {
  id: string
  orderNumber: number
  deliveryDate: string | null
  deliveryDateResolved: Date | null
  deliveryTime: string | null
  totalPrice: number
  lineItems: unknown
  customerFirstName: string
  customerLastName: string
  shippingAddress: unknown
}

/**
 * Totals for a set of delivery-day orders, substituting the signed-off cost for
 * any day that has been locked so historic days stop moving with supplier prices.
 */
function deliveryPeriodTotals(
  orders: DeliveryOrder[],
  index: CogsIndex,
  locksByYmd: Map<string, { costOfSales: number }>,
  staffCosts: number
): PeriodTotals {
  const byDay = new Map<string, DeliveryOrder[]>()
  for (const order of orders) {
    const ymd = resolvedYmd(order)
    if (!ymd) continue
    const bucket = byDay.get(ymd)
    if (bucket) bucket.push(order)
    else byDay.set(ymd, [order])
  }

  let salesValue = 0
  let costOfSales = 0
  let missingQty = 0
  let totalQty = 0
  let lockedDayCount = 0

  for (const [ymd, dayOrders] of byDay) {
    for (const order of dayOrders) salesValue += revenueExGst(order)

    const lock = locksByYmd.get(ymd)
    if (lock) {
      costOfSales += lock.costOfSales
      lockedDayCount++
      continue
    }
    for (const order of dayOrders) {
      const result = sumOrderCogs(order, index)
      costOfSales += result.cogs
      missingQty += result.missingQty
      totalQty += result.totalQty
    }
  }

  salesValue = round2(salesValue)
  costOfSales = round2(costOfSales)
  const totalGP = round2(salesValue - costOfSales)
  const totalGPWithStaffing = round2(totalGP - staffCosts)

  return {
    salesValue,
    costOfSales,
    totalGP,
    gpPercentage: salesValue > 0 ? Number(((totalGP / salesValue) * 100).toFixed(1)) : 0,
    staffCosts: round2(staffCosts),
    totalGPWithStaffing,
    totalGPWithStaffingPercentage:
      salesValue > 0 ? Number(((totalGPWithStaffing / salesValue) * 100).toFixed(1)) : 0,
    orderCount: orders.length,
    cogsCoveragePct: totalQty > 0 ? Math.round(((totalQty - missingQty) / totalQty) * 100) : 100,
    lockedDayCount,
    dayCount: byDay.size,
  }
}

export async function GET() {
  try {
    console.log('📊 Fetching dashboard data...');

    const today = getTodayLocal();
    const todayYmd = formatLocalDate(today);
    const yesterdayYmd = addDaysNZ(todayYmd, -1);
    const tomorrowYmd = addDaysNZ(todayYmd, 1);

    // Week starts Monday in Auckland
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartYmd = addDaysNZ(todayYmd, -daysToMonday);
    const monthStartYmd = `${todayYmd.slice(0, 7)}-01`;
    const yearStartYmd = `${todayYmd.slice(0, 4)}-01-01`;

    // Order-date ("sales") boundaries follow the NZ local day.
    const { start: nzTodayStart, end: nzTodayEnd } = getNZDateRangeForYmd(todayYmd);
    const { start: nzWeekStart } = getNZDateRangeForYmd(weekStartYmd);
    const { start: nzMonthStart } = getNZDateRangeForYmd(monthStartYmd);
    const { start: nzYearStart } = getNZDateRangeForYmd(yearStartYmd);

    // Freeze any completed day the owner's lock-from date now covers. Bounded
    // so a dashboard load stays quick; the nightly cron does the bulk of it and
    // this is only a safety net for a missed run.
    let lockFrom: string | null = null
    try {
      lockFrom = (await autoLockCompletedDays({ limit: 5 })).lockFrom
    } catch (e) {
      console.error('⚠️  auto cost lock skipped:', e)
      lockFrom = await getCogsLockFrom().catch(() => null)
    }

    const deliveryOrderSelect = {
      id: true,
      orderNumber: true,
      deliveryDate: true,
      deliveryDateResolved: true,
      deliveryTime: true,
      totalPrice: true,
      lineItems: true,
      customerFirstName: true,
      customerLastName: true,
      shippingAddress: true,
    } as const

    const [salesOrders, deliveryOrders, activeShifts, staffCostShifts, locks] = await Promise.all([
      // Above the graph: what was SOLD, by order creation date. Cancelled excluded.
      prisma.order.findMany({
        where: { createdAt: { gte: nzYearStart, lte: nzTodayEnd }, cancelledAt: null },
        select: { createdAt: true, totalPrice: true, lineItems: true },
      }),
      // Below the graph: what went OUT THE DOOR, by resolved delivery day.
      // Runs to tomorrow so the Out the Door Tomorrow card shares this query.
      prisma.order.findMany({
        where: {
          deliveryDateResolved: { gte: utcMidnight(yearStartYmd), lte: utcMidnight(tomorrowYmd) },
          cancelledAt: null,
        },
        orderBy: { deliveryTime: 'asc' },
        select: deliveryOrderSelect,
      }),
      prisma.shift.findMany({
        where: { clockOut: null, status: 'active' },
        select: {
          staffId: true,
          clockIn: true,
          staff: { select: { firstName: true, lastName: true, accessLevel: true } },
        },
        orderBy: { clockIn: 'desc' },
        take: 50,
      }),
      prisma.shift.findMany({
        where: { date: { gte: nzYearStart, lte: nzTodayEnd } },
        select: { date: true, totalHours: true, clockIn: true, clockOut: true, staff: { select: { payRate: true } } },
      }),
      prisma.dailyCogsLock.findMany({
        where: { date: { gte: utcMidnight(yearStartYmd), lte: utcMidnight(todayYmd) } },
        select: { date: true, costOfSales: true },
      }),
    ])

    const locksByYmd = new Map(
      locks.map((l) => [l.date.toISOString().slice(0, 10), { costOfSales: Number(l.costOfSales || 0) }])
    )

    // One cost index for every variant either set of orders references, with
    // party-pack children resolved so packs cost their contents.
    const refs = lineItemRefs([...salesOrders, ...deliveryOrders])
    const [cogsIndex, deliveryMap] = await Promise.all([
      buildCogsIndex(refs.variantIds, refs.skus),
      (async () => {
        const defaultNZ = { lat: -36.8485, lng: 174.7633 }
        const buildAddress = (sa: any): string => {
          if (!sa) return ''
          const parts = [sa.address1, sa.address2, sa.city, sa.province, sa.zip, sa.country].filter(Boolean)
          return parts.join(', ')
        }
        const mapOrders = deliveryOrders.filter((o) => resolvedYmd(o) === todayYmd).slice(0, 10)
        return Promise.all(
          mapOrders.map(async (order, index) => {
            const address = buildAddress(order.shippingAddress as any) || 'Unknown Address'
            const resolved = await geocode(address)
            const coords = resolved ?? defaultNZ
            const coordinates: [number, number] = [coords.lat, coords.lng]
            return {
              orderNumber: order.orderNumber?.toString() || `Order ${index + 1}`,
              deliveryTime: order.deliveryTime || '12:00',
              address,
              coordinates,
              salesValue: order.totalPrice || 0,
            }
          })
        )
      })(),
    ])

    // ---- Staff costs, bucketed from a single shift scan (NZ-local day) ----
    const staffCostsBetween = (startYmd: string, endYmd: string): number => {
      let total = 0
      for (const s of staffCostShifts) {
        const ymd = formatNZYMD(new Date(s.date))
        if (ymd < startYmd || ymd > endYmd) continue
        const pay = Number(s.staff?.payRate || 0)
        let hours = typeof s.totalHours === 'number' ? s.totalHours : null
        if (hours == null) {
          if (s.clockIn && s.clockOut) {
            const diffMs = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()
            hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0
          } else {
            hours = 0
          }
        }
        total += pay * (hours || 0)
      }
      return round2(total)
    }

    // ---- Above the graph: sales by order date ----
    const inCreatedRange = (o: { createdAt: Date }, from: Date, to: Date) => {
      const t = o.createdAt.getTime()
      return t >= from.getTime() && t <= to.getTime()
    }
    const sales = {
      today: periodTotals(salesOrders.filter((o) => inCreatedRange(o, nzTodayStart, nzTodayEnd)), cogsIndex),
      weekToDate: periodTotals(salesOrders.filter((o) => inCreatedRange(o, nzWeekStart, nzTodayEnd)), cogsIndex),
      monthToDate: periodTotals(salesOrders.filter((o) => inCreatedRange(o, nzMonthStart, nzTodayEnd)), cogsIndex),
      yearToDate: periodTotals(salesOrders.filter((o) => inCreatedRange(o, nzYearStart, nzTodayEnd)), cogsIndex),
    }

    // ---- Below the graph: out the door by delivery date ----
    const deliveredBetween = (startYmd: string, endYmd: string) =>
      deliveryOrders.filter((o) => {
        const ymd = resolvedYmd(o)
        return !!ymd && ymd >= startYmd && ymd <= endYmd
      })

    const deliveryToday = deliveredBetween(todayYmd, todayYmd)
    const deliveryTomorrow = deliveredBetween(tomorrowYmd, tomorrowYmd)

    const delivery = {
      today: deliveryPeriodTotals(deliveryToday, cogsIndex, locksByYmd, staffCostsBetween(todayYmd, todayYmd)),
      yesterday: deliveryPeriodTotals(
        deliveredBetween(yesterdayYmd, yesterdayYmd),
        cogsIndex,
        locksByYmd,
        staffCostsBetween(yesterdayYmd, yesterdayYmd)
      ),
      weekToDate: deliveryPeriodTotals(
        deliveredBetween(weekStartYmd, todayYmd),
        cogsIndex,
        locksByYmd,
        staffCostsBetween(weekStartYmd, todayYmd)
      ),
      monthToDate: deliveryPeriodTotals(
        deliveredBetween(monthStartYmd, todayYmd),
        cogsIndex,
        locksByYmd,
        staffCostsBetween(monthStartYmd, todayYmd)
      ),
      yearToDate: deliveryPeriodTotals(
        deliveredBetween(yearStartYmd, todayYmd),
        cogsIndex,
        locksByYmd,
        staffCostsBetween(yearStartYmd, todayYmd)
      ),
    }

    const outTheDoorToday = {
      salesValue: round2(deliveryToday.reduce((s, o) => s + revenueExGst(o), 0)),
      orderCount: deliveryToday.length,
      orders: deliveryToday.slice(0, 5),
    }
    const outTheDoorTomorrow = {
      salesValue: round2(deliveryTomorrow.reduce((s, o) => s + revenueExGst(o), 0)),
      orderCount: deliveryTomorrow.length,
      orders: deliveryTomorrow.slice(0, 5),
    }

    const staffClockedIn = activeShifts.map((s) => ({
      id: s.staffId,
      name: s.staff ? `${s.staff.firstName} ${s.staff.lastName}` : 'Unknown',
      role: s.staff?.accessLevel || 'staff',
      clockInTime: new Date(s.clockIn).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }),
    }))

    console.log(
      '📊 Dashboard periods:',
      'sales-today', sales.today.orderCount,
      '| ood-today', delivery.today.orderCount,
      '| ood-yesterday', delivery.yesterday.orderCount,
      '| ood-ytd', delivery.yearToDate.orderCount,
      '| locked days', locksByYmd.size
    )

    return NextResponse.json({
      // Above the graph — order date
      sales,
      // Below the graph — delivery date ("out the door")
      delivery,
      lockedDates: Array.from(locksByYmd.keys()).sort(),
      lockFrom,
      periodDates: {
        today: todayYmd,
        yesterday: yesterdayYmd,
        weekStart: weekStartYmd,
        monthStart: monthStartYmd,
        yearStart: yearStartYmd,
      },
      outTheDoorToday,
      outTheDoorTomorrow,
      staffClockedIn,
      deliveryMap,
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
