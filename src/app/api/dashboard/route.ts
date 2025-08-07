import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📊 Fetching dashboard data...');
    
    // Get today's and tomorrow's dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Format dates for comparison
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
    
    // Yesterday's data
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        deliveryDate: yesterdayString
      }
    });
    
    // Calculate metrics
    const calculatePeriodData = (orders: any[]) => {
      const salesValue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      const orderCount = orders.length;
      
      return {
        salesValue,
        costOfSales: 0,
        totalGP: salesValue,
        gpPercentage: 100,
        staffCosts: 0,
        totalGPWithStaffing: salesValue,
        totalGPWithStaffingPercentage: 100,
        orderCount
      };
    };
    
    // Sales Today (orders we made today)
    const todayData = calculatePeriodData(salesTodayOrders);
    
    // Yesterday data
    const yesterdayData = calculatePeriodData(yesterdayOrders);
    
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
      today: todayData, // Sales we made today
      yesterday: yesterdayData,
      weekToDate: calculatePeriodData([]), // No week data
      monthToDate: calculatePeriodData([]), // No month data
      yearToDate: calculatePeriodData([]), // No year data
      historicPeriod1: calculatePeriodData([]), // No historic data
      historicPeriod2: calculatePeriodData([]), // No historic data
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