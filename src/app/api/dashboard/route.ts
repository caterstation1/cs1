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
    
    // Format dates for delivery date comparison
    const todayString = today.toISOString().split('T')[0];
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    const yesterdayString = yesterday.toISOString().split('T')[0];
    
    // Fetch orders by delivery date
    const todayOrders = await prisma.order.findMany({
      where: {
        deliveryDate: todayString
      }
    });
    
    const tomorrowOrders = await prisma.order.findMany({
      where: {
        deliveryDate: tomorrowString
      }
    });
    
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        deliveryDate: yesterdayString
      }
    });
    
    // Calculate basic metrics using real data only
    const calculatePeriodData = (orders: any[]) => {
      const salesValue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      const orderCount = orders.length;
      
      return {
        salesValue,
        costOfSales: 0, // No cost data available
        totalGP: salesValue, // No cost data, so GP = sales
        gpPercentage: 100, // No cost data
        staffCosts: 0, // No staff cost data available
        totalGPWithStaffing: salesValue, // No staff costs
        totalGPWithStaffingPercentage: 100, // No staff costs
        orderCount
      };
    };
    
    // Calculate data for different periods using real data
    const todayData = calculatePeriodData(todayOrders);
    const yesterdayData = calculatePeriodData(yesterdayOrders);
    
    // For other periods, use actual data or empty data
    const weekToDate = calculatePeriodData([]); // No week data available
    const monthToDate = calculatePeriodData([]); // No month data available
    const yearToDate = calculatePeriodData([]); // No year data available
    const historicPeriod1 = calculatePeriodData([]); // No historic data available
    const historicPeriod2 = calculatePeriodData([]); // No historic data available
    
    // Out the door data using real delivery dates
    const outTheDoorToday = {
      salesValue: todayData.salesValue,
      orderCount: todayData.orderCount,
      orders: todayOrders.slice(0, 5) // First 5 orders for today
    };
    
    const outTheDoorTomorrow = {
      salesValue: calculatePeriodData(tomorrowOrders).salesValue,
      orderCount: tomorrowOrders.length,
      orders: tomorrowOrders.slice(0, 5) // First 5 orders for tomorrow
    };
    
    // Staff data - empty array since no staff data available
    const staffClockedIn: any[] = [];
    
    // Delivery map data using real order data
    const deliveryMap = todayOrders.slice(0, 10).map((order, index) => {
      const shippingAddress = order.shippingAddress as any;
      return {
        orderNumber: order.orderNumber?.toString() || `Order ${index + 1}`,
        deliveryTime: order.deliveryTime || '12:00',
        address: shippingAddress?.address1 || 'Unknown Address',
        coordinates: [0, 0] as [number, number], // No real coordinates available
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