import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📊 Fetching dashboard data...');
    
    // Get date ranges in Auckland timezone (UTC+12/+13)
    const aucklandOffset = 12; // UTC+12 (adjust for daylight saving if needed)
    const now = new Date();
    const aucklandTime = new Date(now.getTime() + (aucklandOffset * 60 * 60 * 1000));
    
    const today = new Date(aucklandTime.getFullYear(), aucklandTime.getMonth(), aucklandTime.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Calculate date ranges for week, month, year in Auckland time
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    
    // Format dates for delivery date comparison
    const todayString = today.toISOString().split('T')[0];
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    const yesterdayString = yesterday.toISOString().split('T')[0];
    
    // Sales Today = Orders we MADE today (by createdAt)
    const salesTodayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
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
    
    // Yesterday's data (orders made yesterday)
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
          lt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1)
        }
      }
    });
    
    // Week to Date (orders made this week)
    const weekToDateOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfWeek
        }
      }
    });
    
    // Month to Date (orders made this month)
    const monthToDateOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfMonth
        }
      }
    });
    
    // Year to Date (orders made this year)
    const yearToDateOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfYear
        }
      }
    });
    
    // Historic periods (previous week and previous month)
    const previousWeekStart = new Date(startOfWeek);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(startOfWeek);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const historicPeriod1Orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: previousWeekStart,
          lte: previousWeekEnd
        }
      }
    });
    
    const historicPeriod2Orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd
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
      return {
        orderNumber: order.orderNumber?.toString() || `Order ${index + 1}`,
        deliveryTime: order.deliveryTime || '12:00',
        address: shippingAddress?.address1 || 'Unknown Address',
        coordinates: [0, 0] as [number, number], // Will need geocoding
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
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
} 