import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTodayLocal, createLocalDate, formatLocalDate } from '@/lib/date-utils';

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
    
    const salesTodayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: aucklandTodayStart,
          lt: aucklandTodayEnd
        }
      }
    });
    
    // Out the Door Today = Orders we DELIVERED today (by deliveryDate)
    const outTheDoorTodayOrders = await prisma.order.findMany({
      where: {
        deliveryDate: todayString
      },
      orderBy: {
        deliveryTime: 'asc' // Sort by delivery time, earliest first
      }
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
    
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: aucklandYesterdayStart,
          lt: aucklandYesterdayEnd
        }
      }
    });
    
    // Week to Date (orders made this week) in Auckland timezone
    const aucklandWeekStart = new Date(formatLocalDate(startOfWeek) + 'T00:00:00+12:00'); // Auckland timezone
    
    const weekToDateOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: aucklandWeekStart
        }
      }
    });
    
    // Month to Date (orders made this month) in Auckland timezone
    const aucklandMonthStart = new Date(formatLocalDate(startOfMonth) + 'T00:00:00+12:00'); // Auckland timezone
    
    const monthToDateOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: aucklandMonthStart
        }
      }
    });
    
    // Year to Date (orders made this year) in Auckland timezone
    const aucklandYearStart = new Date(formatLocalDate(startOfYear) + 'T00:00:00+12:00'); // Auckland timezone
    
    const yearToDateOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: aucklandYearStart
        }
      }
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
    
    // Calculate metrics using product totalCost as COGS proxy
    const calculatePeriodData = async (orders: any[]) => {
      const salesValue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      const orderCount = orders.length;

      // Build SKU list from line items
      const skus = Array.from(new Set(
        orders.flatMap((o:any) => Array.isArray(o.lineItems) ? o.lineItems.map((li:any) => li.sku).filter(Boolean) : [])
      ));

      // Map SKU -> product totalCost
      let skuToCost: Record<string, number> = {};
      if (skus.length) {
        const products = await prisma.productWithCustomData.findMany({
          where: { shopifySku: { in: skus } },
          select: { shopifySku: true, totalCost: true }
        });
        skuToCost = Object.fromEntries(products.map(p => [p.shopifySku as string, Number(p.totalCost || 0)]));
      }

      // Sum COGS = Σ over all orders Σ (qty × product totalCost)
      const costOfSales = orders.reduce((sum, order) => {
        const items = Array.isArray(order.lineItems) ? order.lineItems : [];
        const orderCost = items.reduce((acc:number, li:any) => {
          const sku = li.sku as string;
          const qty = Number(li.quantity || 0);
          const unitCost = Number(skuToCost[sku] || 0);
          return acc + (isFinite(qty) && isFinite(unitCost) ? qty * unitCost : 0);
        }, 0);
        return sum + orderCost;
      }, 0);

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
      calculatePeriodData(salesTodayOrders),
      calculatePeriodData(yesterdayOrders),
      calculatePeriodData(weekToDateOrders),
      calculatePeriodData(monthToDateOrders),
      calculatePeriodData(yearToDateOrders),
      calculatePeriodData(historicPeriod1Orders),
      calculatePeriodData(historicPeriod2Orders)
    ]);
    
    console.log('📊 Query results:');
    console.log('  Sales Today:', salesTodayOrders.length, 'orders, $', todayData.salesValue);
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
    
    // Staff data - empty array since no staff data available
    const staffClockedIn: any[] = [];
    
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
    
    const dashboardData = {
      today: todayData,
      yesterday: yesterdayData,
      weekToDate,
      monthToDate,
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