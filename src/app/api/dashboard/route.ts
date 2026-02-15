import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTodayLocal, createLocalDate, formatLocalDate, formatNZYMD, getNZDateRangeForYmd } from '@/lib/date-utils';

function parseLineItems(li: any): any[] {
  if (Array.isArray(li)) return li
  if (typeof li === 'string') {
    try { return JSON.parse(li) } catch {}
  }
  return []
}

function calcTotal(ings: any[]): number {
  if (!Array.isArray(ings)) return 0
  return Number(ings.reduce((s, ing) => {
    const q = Number(ing?.quantity || 0)
    const c = Number(ing?.cost || 0)
    return s + (isFinite(q) && isFinite(c) ? q * c : 0)
  }, 0).toFixed(2))
}

export async function GET() {
  try {
    console.log('📊 Fetching dashboard data...');
    
    // Get today's date in Auckland timezone (local time)
    const today = getTodayLocal();
    const todayString = formatLocalDate(today);
    
    // Get yesterday and tomorrow in local time
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = formatLocalDate(yesterday);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = formatLocalDate(tomorrow);
    
    // Calculate date ranges for week, month, year in local time
    // Week starts on Monday (1) in Auckland
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Monday=0
    startOfWeek.setDate(today.getDate() - daysToMonday);
    
    const startOfMonth = createLocalDate(today.getFullYear(), today.getMonth() + 1, 1);
    const startOfYear = createLocalDate(today.getFullYear(), 1, 1);
    const weekStartStr = formatLocalDate(startOfWeek);
    const monthStartStr = formatLocalDate(startOfMonth);
    const yearStartStr = formatLocalDate(startOfYear);
    
    // Helpers: fetch orders by delivery date (Out‑of‑Door)
    const fetchOutTheDoorForDate = async (dateStr: string) => {
      return prisma.order.findMany({ where: { deliveryDate: dateStr } });
    }
    const fetchOutTheDoorForRange = async (startStr: string, endStr: string) => {
      return prisma.order.findMany({
        where: {
          AND: [
            { deliveryDate: { gte: startStr } },
            { deliveryDate: { lte: endStr } }
          ]
        }
      })
    }
    
    // Sales Today = Orders we MADE today (by createdAt) in Auckland timezone
    // Create Auckland timezone date range
    const aucklandTodayStart = new Date(todayString + 'T00:00:00+12:00'); // Auckland timezone
    const aucklandTodayEnd = new Date(todayString + 'T23:59:59.999+12:00'); // Auckland timezone
    
    console.log('🌏 Auckland timezone date ranges:');
    console.log('  Today:', todayString, '(Auckland)');
    console.log('  Yesterday:', yesterdayString, '(Auckland)');
    console.log('  Tomorrow:', tomorrowString, '(Auckland)');
    console.log('  Week start:', formatLocalDate(startOfWeek), '(Auckland)');
    console.log('  Month start:', formatLocalDate(startOfMonth), '(Auckland)');
    console.log('  Year start:', formatLocalDate(startOfYear), '(Auckland)');
    console.log('  Auckland Today Start:', aucklandTodayStart.toISOString());
    console.log('  Auckland Today End:', aucklandTodayEnd.toISOString());
    
    // Sales Today (by createdAt in NZ local)
    const todayYmd = formatNZYMD(today);
    const { start: nzTodayStart, end: nzTodayEnd } = getNZDateRangeForYmd(todayYmd);
    const salesToday = await prisma.order.findMany({
      where: { createdAt: { gte: nzTodayStart, lte: nzTodayEnd } }
    });
    
    // Out the Door Today = Orders we DELIVERED today (by deliveryDate)
    const outTheDoorTodayOrders = await prisma.order.findMany({
      where: { deliveryDate: todayString },
      orderBy: { deliveryTime: 'asc' }
    });
    
    // Tomorrow's deliveries
    const tomorrowOrders = await prisma.order.findMany({
      where: {
        deliveryDate: tomorrowString
      },
      orderBy: {
        deliveryTime: 'asc' // Sort by delivery time, earliest first
      }
    });
    
    // Yesterday's data (orders made yesterday) in Auckland timezone
    const aucklandYesterdayStart = new Date(yesterdayString + 'T00:00:00+12:00'); // Auckland timezone
    const aucklandYesterdayEnd = new Date(yesterdayString + 'T23:59:59.999+12:00'); // Auckland timezone
    
    console.log('  Auckland Yesterday Start:', aucklandYesterdayStart.toISOString());
    console.log('  Auckland Yesterday End:', aucklandYesterdayEnd.toISOString());
    
    const yesterdayOrders = await fetchOutTheDoorForDate(yesterdayString);
    
    // Week to Date (orders made this week) in Auckland timezone
    const aucklandWeekStart = new Date(formatLocalDate(startOfWeek) + 'T00:00:00+12:00'); // Auckland timezone
    // Week to Date (by createdAt in NZ local)
    const weekStartYmd = formatNZYMD(startOfWeek);
    const { start: nzWeekStart } = getNZDateRangeForYmd(weekStartYmd);
    const { end: nzTodayEnd2 } = getNZDateRangeForYmd(todayYmd);
    const weekToDateOrders = await prisma.order.findMany({
      where: { createdAt: { gte: nzWeekStart, lte: nzTodayEnd2 } }
    });
    
    // Month to Date (orders made this month) in Auckland timezone
    const aucklandMonthStart = new Date(formatLocalDate(startOfMonth) + 'T00:00:00+12:00'); // Auckland timezone
    // Month to Date (by createdAt in NZ local)
    const monthStartYmd = formatNZYMD(startOfMonth);
    const { start: nzMonthStart } = getNZDateRangeForYmd(monthStartYmd);
    const monthToDateOrders = await prisma.order.findMany({
      where: { createdAt: { gte: nzMonthStart, lte: nzTodayEnd } }
    });
    
    // Year to Date (orders made this year) in Auckland timezone
    const aucklandYearStart = new Date(formatLocalDate(startOfYear) + 'T00:00:00+12:00'); // Auckland timezone
    // Year to Date (by createdAt in NZ local)
    const yearStartYmd = formatNZYMD(startOfYear);
    const { start: nzYearStart } = getNZDateRangeForYmd(yearStartYmd);
    const yearToDateOrders = await prisma.order.findMany({
      where: { createdAt: { gte: nzYearStart, lte: nzTodayEnd } }
    });
    
    // Historic periods (previous week and previous month) in Auckland timezone
    const previousWeekStart = new Date(startOfWeek);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const aucklandPreviousWeekStart = new Date(formatLocalDate(previousWeekStart) + 'T00:00:00+12:00');
    
    const previousWeekEnd = new Date(startOfWeek);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    const aucklandPreviousWeekEnd = new Date(formatLocalDate(previousWeekEnd) + 'T23:59:59.999+12:00');
    
    const previousMonthStart = createLocalDate(today.getFullYear(), today.getMonth(), 1);
    const aucklandPreviousMonthStart = new Date(formatLocalDate(previousMonthStart) + 'T00:00:00+12:00');
    
    const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const aucklandPreviousMonthEnd = new Date(formatLocalDate(previousMonthEnd) + 'T23:59:59.999+12:00');
    
    const historicPeriod1Orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: aucklandPreviousWeekStart,
          lte: aucklandPreviousWeekEnd
        }
      }
    });
    
    const historicPeriod2Orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: aucklandPreviousMonthStart,
          lte: aucklandPreviousMonthEnd
        }
      }
    });
    
    // Helper: compute staffing costs (NZ-local date range) using shifts * payRate
    const computeStaffCostsBetween = async (start: Date, end: Date): Promise<number> => {
      const shifts = await prisma.shift.findMany({
        where: {
          date: { gte: start, lte: end }
        },
        include: { staff: true }
      })
      let total = 0
      for (const s of shifts) {
        const pay = Number((s as any).staff?.payRate || 0)
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
      return Number(total.toFixed(2))
    }

    // Calculate metrics using full base+variant costs; prefer variantId, include bundle children
    const calculatePeriodData = async (orders: any[]) => {
      // Sales value GST‑exclusive must strictly be derived from Inc GST totals:
      // per order Ex GST = Inc GST / 1.15 (to avoid shipping/tax config inconsistencies).
      const salesValue = Number(orders.reduce((sum, order) => {
        const totInc = Number(order.totalPrice)
        const inc = isFinite(totInc) ? totInc : 0
        const ex = inc / 1.15
        return sum + (isFinite(ex) ? ex : 0)
      }, 0).toFixed(2));
      const orderCount = orders.length;

      // Gather all line items (including children) and extract IDs/SKUs
      const allLis = orders.flatMap((o:any) => parseLineItems(o.lineItems))
      const children = allLis.flatMap((li:any) => {
        const kids = Array.isArray(li?.bundle_children) ? li.bundle_children
          : (Array.isArray(li?.children) ? li.children : [])
        return kids || []
      })
      const allForLookup = [...allLis, ...children]
      const variantIds = Array.from(new Set(allForLookup.map((li:any)=> String(li?.variant_id || li?.variantId || '')).filter(Boolean)))
      const skus = Array.from(new Set(allForLookup.map((li:any)=> String(li?.sku || '')).filter(Boolean)))

      // Load variants by variantId (primary) and by sku (fallback), include ingredients + baseIngredients
      const variantsById = variantIds.length ? await prisma.productVariant.findMany({
        where: { variantId: { in: variantIds } },
        select: {
          variantId: true,
          shopifySku: true,
          shopifyName: true,
          totalCost: true,
          ingredients: true,
          product: { select: { baseIngredients: true } }
        }
      }) : []
      const variantsBySku = skus.length ? await prisma.productVariant.findMany({
        where: { shopifySku: { in: skus } },
        select: {
          variantId: true,
          shopifySku: true,
          shopifyName: true,
          totalCost: true,
          ingredients: true,
          product: { select: { baseIngredients: true } }
        }
      }) : []
      const allVariants = [...variantsById, ...variantsBySku]

      // Legacy fallback for missing totals
      const missingVariantIds = allVariants
        .filter(v => !(typeof v.totalCost === 'number') || !isFinite(Number(v.totalCost)) || Number(v.totalCost) === 0)
        .map(v => v.variantId)
      const legacy = missingVariantIds.length ? await prisma.productWithCustomData.findMany({
        where: { variantId: { in: Array.from(new Set(missingVariantIds)) } },
        select: { variantId: true, totalCost: true }
      }) : []
      const legacyCostByVariantId = new Map<string, number>(legacy.map(l => [String(l.variantId), Number(l.totalCost || 0)]))

      const byVariantId = new Map<string, number>()
      const bySku = new Map<string, number>()
      for (const v of allVariants as any[]) {
        const base = Array.isArray(v.product?.baseIngredients) ? v.product.baseIngredients : []
        const varIngs = Array.isArray(v.ingredients) ? v.ingredients : []
        const combined = calcTotal([...base, ...varIngs])
        const primary = Number(v.totalCost || 0)
        const fallback = legacyCostByVariantId.get(String(v.variantId)) || 0
        const unitCost = combined > 0 ? combined : (primary > 0 ? primary : fallback)
        byVariantId.set(String(v.variantId), unitCost)
        if (v.shopifySku) bySku.set(String(v.shopifySku), unitCost)
      }

      // Sum COGS including bundle children; prefer variantId then SKU
      const sumItems = (items: any[]): number => {
        let total = 0
        for (const li of items) {
          const qty = Number(li?.quantity || 0)
          const vId = String(li?.variant_id || li?.variantId || '')
          const sku = String(li?.sku || '')
          const unit = (vId && byVariantId.get(vId)) ?? (sku && bySku.get(sku)) ?? 0
          total += (isFinite(qty) && isFinite(Number(unit)) ? qty * Number(unit) : 0)
        }
        return total
      }

      const costOfSales = orders.reduce((sum, order) => {
        const items = parseLineItems(order.lineItems)
        const kids = items.flatMap((li:any) => {
          const arr = Array.isArray(li?.bundle_children) ? li.bundle_children
            : (Array.isArray(li?.children) ? li.children : [])
          return arr || []
        })
        const orderCost = sumItems(items) + sumItems(kids)
        return sum + orderCost
      }, 0)

      const totalGP = salesValue - costOfSales;
      const gpPercentage = salesValue > 0 ? (totalGP / salesValue) * 100 : 0;
      const staffCosts = 0;
      const totalGPWithStaffing = totalGP - staffCosts;
      const totalGPWithStaffingPercentage = salesValue > 0 ? (totalGPWithStaffing / salesValue) * 100 : 0;

      return {
        salesValue,
        costOfSales: Number(costOfSales.toFixed(2)),
        totalGP: Number(totalGP.toFixed(2)),
        gpPercentage: Number(gpPercentage.toFixed(1)),
        staffCosts,
        totalGPWithStaffing: Number(totalGPWithStaffing.toFixed(2)),
        totalGPWithStaffingPercentage: Number(totalGPWithStaffingPercentage.toFixed(1)),
        orderCount
      };
    };
    
    // Calculate all period data
    const [
      todayData,
      yesterdayData,
      weekToDate,
      monthToDate,
      yearToDate,
      historicPeriod1,
      historicPeriod2
    ] = await Promise.all([
      calculatePeriodData(salesToday),
      calculatePeriodData(yesterdayOrders),
      calculatePeriodData(weekToDateOrders),
      calculatePeriodData(monthToDateOrders),
      calculatePeriodData(yearToDateOrders),
      calculatePeriodData(historicPeriod1Orders),
      calculatePeriodData(historicPeriod2Orders)
    ]);
    
    console.log('📊 Out‑of‑Door (by delivery date) results:');
    console.log('  Today:', salesToday.length, 'orders, $', todayData.salesValue);
    console.log('  Yesterday:', yesterdayOrders.length, 'orders, $', yesterdayData.salesValue);
    console.log('  Week to Date:', weekToDateOrders.length, 'orders, $', weekToDate.salesValue);
    console.log('  Month to Date:', monthToDateOrders.length, 'orders, $', monthToDate.salesValue);
    console.log('  Year to Date:', yearToDateOrders.length, 'orders, $', yearToDate.salesValue);
    const outTheDoorTodayPreview = await calculatePeriodData(outTheDoorTodayOrders);
    console.log('  Out the Door Today:', outTheDoorTodayOrders.length, 'orders, $', outTheDoorTodayPreview.salesValue);
    
    // Out the door data
    const outTheDoorTodayCalc = await calculatePeriodData(outTheDoorTodayOrders);
    const outTheDoorToday = {
      salesValue: outTheDoorTodayCalc.salesValue,
      orderCount: outTheDoorTodayOrders.length,
      orders: outTheDoorTodayOrders.slice(0, 5)
    };
    
    const outTheDoorTomorrowCalc = await calculatePeriodData(tomorrowOrders);
    const outTheDoorTomorrow = {
      salesValue: outTheDoorTomorrowCalc.salesValue,
      orderCount: tomorrowOrders.length,
      orders: tomorrowOrders.slice(0, 5)
    };
    
    // Staff currently clocked in
    const activeShifts = await prisma.shift.findMany({
      where: {
        clockOut: null,
        status: 'active',
      },
      include: {
        staff: true,
      },
      orderBy: {
        clockIn: 'desc',
      },
      take: 50,
    })
    const staffClockedIn = activeShifts.map(s => ({
      id: s.staffId,
      name: s.staff ? `${s.staff.firstName} ${s.staff.lastName}` : 'Unknown',
      role: s.staff?.accessLevel || 'staff',
      clockInTime: new Date(s.clockIn).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }),
    }))
    
    // Delivery map data - geocode shipping address for accurate pins
    const geocodeCache = new Map<string, { lat: number; lng: number }>()
    const defaultNZ = { lat: -36.8485, lng: 174.7633 }

    const buildAddress = (sa: any): string => {
      if (!sa) return ''
      const parts = [sa.address1, sa.address2, sa.city, sa.province, sa.zip, sa.country].filter(Boolean)
      return parts.join(', ')
    }

    async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
      const key = address.trim()
      if (!key) return null
      if (geocodeCache.has(key)) return geocodeCache.get(key)! 
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY
        if (!apiKey) return null
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(key)}&key=${apiKey}`
        const resp = await fetch(url)
        if (!resp.ok) return null
        const data = await resp.json()
        if (data.status !== 'OK' || !data.results?.length) return null
        const loc = data.results[0].geometry.location
        const coords = { lat: Number(loc.lat), lng: Number(loc.lng) }
        geocodeCache.set(key, coords)
        return coords
      } catch {
        return null
      }
    }

    const mapOrders = outTheDoorTodayOrders.slice(0, 10)
    const deliveryMap = await Promise.all(
      mapOrders.map(async (order, index) => {
        const shippingAddress = order.shippingAddress as any
        const address = buildAddress(shippingAddress) || 'Unknown Address'
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
    
    // Compute staffing costs for key periods (NZ local)
    const nzStartOfDay = (d: Date) => new Date(formatLocalDate(d) + 'T00:00:00+12:00')
    const nzEndOfDay = (d: Date) => new Date(formatLocalDate(d) + 'T23:59:59.999+12:00')
    const yesterdayStaffCosts = await computeStaffCostsBetween(nzStartOfDay(yesterday), nzEndOfDay(yesterday))
    const weekToDateStaffCosts = await computeStaffCostsBetween(nzWeekStart, nzEndOfDay(today))
    const monthToDateStaffCosts = await computeStaffCostsBetween(nzMonthStart, nzEndOfDay(today))
    const yearToDateStaffCosts = await computeStaffCostsBetween(nzYearStart, nzEndOfDay(today))

    const todayWithStaff = todayData
    const yesterdayWithStaff = {
      ...yesterdayData,
      staffCosts: yesterdayStaffCosts,
      totalGPWithStaffing: Number((yesterdayData.totalGP - yesterdayStaffCosts).toFixed(2)),
      totalGPWithStaffingPercentage: Number(((yesterdayData.salesValue > 0 ? (yesterdayData.totalGP - yesterdayStaffCosts) / yesterdayData.salesValue * 100 : 0)).toFixed(1))
    }
    const weekToDateWithStaff = {
      ...weekToDate,
      staffCosts: weekToDateStaffCosts,
      totalGPWithStaffing: Number((weekToDate.totalGP - weekToDateStaffCosts).toFixed(2)),
      totalGPWithStaffingPercentage: Number(((weekToDate.salesValue > 0 ? (weekToDate.totalGP - weekToDateStaffCosts) / weekToDate.salesValue * 100 : 0)).toFixed(1))
    }
    const monthToDateWithStaff = {
      ...monthToDate,
      staffCosts: monthToDateStaffCosts,
      totalGPWithStaffing: Number((monthToDate.totalGP - monthToDateStaffCosts).toFixed(2)),
      totalGPWithStaffingPercentage: Number(((monthToDate.salesValue > 0 ? (monthToDate.totalGP - monthToDateStaffCosts) / monthToDate.salesValue * 100 : 0)).toFixed(1))
    }
    const yearToDateWithStaff = {
      ...yearToDate,
      staffCosts: yearToDateStaffCosts,
      totalGPWithStaffing: Number((yearToDate.totalGP - yearToDateStaffCosts).toFixed(2)),
      totalGPWithStaffingPercentage: Number(((yearToDate.salesValue > 0 ? (yearToDate.totalGP - yearToDateStaffCosts) / yearToDate.salesValue * 100 : 0)).toFixed(1))
    }

    const dashboardData = {
      today: todayWithStaff,
      yesterday: yesterdayWithStaff,
      weekToDate: weekToDateWithStaff,
      monthToDate: monthToDateWithStaff,
      yearToDate,
      historicPeriod1,
      historicPeriod2,
      outTheDoorToday,
      outTheDoorTomorrow,
      staffClockedIn,
      deliveryMap
    };
    
    console.log('✅ Dashboard data fetched successfully');
    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 