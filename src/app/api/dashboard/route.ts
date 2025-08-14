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
    
    // Calculate metrics (no cost data available)
    const calculatePeriodData = (orders: any[]) => {
      const salesValue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      const orderCount = orders.length;
      
      return {
        salesValue,
        costOfSales: 0, // No cost data available
        totalGP: salesValue, // No costs, so GP = sales
        gpPercentage: 100, // No costs, so 100%
        staffCosts: 0, // No staff cost data available
        totalGPWithStaffing: salesValue, // No staff costs
        totalGPWithStaffingPercentage: 100, // No staff costs
        orderCount
      };
    };
    
    // Calculate all period data
    const todayData = calculatePeriodData(salesTodayOrders);
    const yesterdayData = calculatePeriodData(yesterdayOrders);
    const weekToDate = calculatePeriodData(weekToDateOrders);
    const monthToDate = calculatePeriodData(monthToDateOrders);
    const yearToDate = calculatePeriodData(yearToDateOrders);
    const historicPeriod1 = calculatePeriodData(historicPeriod1Orders);
    const historicPeriod2 = calculatePeriodData(historicPeriod2Orders);
    
    console.log('📊 Query results:');
    console.log('  Sales Today:', salesTodayOrders.length, 'orders, $', todayData.salesValue);
    console.log('  Yesterday:', yesterdayOrders.length, 'orders, $', yesterdayData.salesValue);
    console.log('  Week to Date:', weekToDateOrders.length, 'orders, $', weekToDate.salesValue);
    console.log('  Month to Date:', monthToDateOrders.length, 'orders, $', monthToDate.salesValue);
    console.log('  Year to Date:', yearToDateOrders.length, 'orders, $', yearToDate.salesValue);
    console.log('  Out the Door Today:', outTheDoorTodayOrders.length, 'orders, $', calculatePeriodData(outTheDoorTodayOrders).salesValue);
    
    // Out the door data
    const outTheDoorToday = {
      salesValue: calculatePeriodData(outTheDoorTodayOrders).salesValue,
      orderCount: outTheDoorTodayOrders.length,
      orders: outTheDoorTodayOrders.slice(0, 5) // First 5 orders for today
    };
    
    const outTheDoorTomorrow = {
      salesValue: calculatePeriodData(tomorrowOrders).salesValue,
      orderCount: tomorrowOrders.length,
      orders: tomorrowOrders.slice(0, 5) // First 5 orders for tomorrow
    };
    
    // Staff data - empty array since no staff data available
    const staffClockedIn: any[] = [];
    
    // Delivery map data - use out the door orders for today
    const deliveryMap = outTheDoorTodayOrders.slice(0, 10).map((order, index) => {
      const shippingAddress = order.shippingAddress as any;
      const address = shippingAddress?.address1 || 'Unknown Address';
      
      // Default to Auckland coordinates if no proper address
      let coordinates: [number, number] = [-36.8485, 174.7633]; // Auckland, NZ
      
      // If we have a proper address, we could geocode it here
      // For now, use Auckland as default and add some offset for multiple orders
      if (outTheDoorTodayOrders.length > 1) {
        // Add small offset to spread markers around Auckland
        const offset = (index * 0.01) - (outTheDoorTodayOrders.length * 0.005);
        coordinates = [-36.8485 + offset, 174.7633 + offset];
      }
      
      return {
        orderNumber: order.orderNumber?.toString() || `Order ${index + 1}`,
        deliveryTime: order.deliveryTime || '12:00',
        address: address,
        coordinates: coordinates,
        salesValue: order.totalPrice || 0
      };
    });
    
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