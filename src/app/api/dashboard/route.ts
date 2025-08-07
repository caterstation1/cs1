import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📊 Fetching dashboard data...');
    
    // Get today's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get date ranges
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    
    // Fetch orders for today and yesterday
    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });
    
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfYesterday,
          lte: endOfYesterday
        }
      }
    });
    
    // Calculate basic metrics
    const calculatePeriodData = (orders: any[]) => {
      const salesValue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      const orderCount = orders.length;
      const costOfSales = salesValue * 0.6; // Estimate 60% cost
      const totalGP = salesValue - costOfSales;
      const gpPercentage = salesValue > 0 ? (totalGP / salesValue) * 100 : 0;
      const staffCosts = orderCount * 50; // Estimate $50 per order for staff
      const totalGPWithStaffing = totalGP - staffCosts;
      const totalGPWithStaffingPercentage = salesValue > 0 ? (totalGPWithStaffing / salesValue) * 100 : 0;
      
      return {
        salesValue,
        costOfSales,
        totalGP,
        gpPercentage,
        staffCosts,
        totalGPWithStaffing,
        totalGPWithStaffingPercentage,
        orderCount
      };
    };
    
    // Calculate data for different periods
    const todayData = calculatePeriodData(todayOrders);
    const yesterdayData = calculatePeriodData(yesterdayOrders);
    
    // Mock data for other periods (you can expand this later)
    const weekToDate = { ...todayData, salesValue: todayData.salesValue * 5 };
    const monthToDate = { ...todayData, salesValue: todayData.salesValue * 20 };
    const yearToDate = { ...todayData, salesValue: todayData.salesValue * 240 };
    const historicPeriod1 = { ...yesterdayData, salesValue: yesterdayData.salesValue * 1.1 };
    const historicPeriod2 = { ...yesterdayData, salesValue: yesterdayData.salesValue * 0.9 };
    
    // Out the door data
    const outTheDoorToday = {
      salesValue: todayData.salesValue,
      orderCount: todayData.orderCount,
      orders: todayOrders.slice(0, 5) // First 5 orders
    };
    
    const outTheDoorTomorrow = {
      salesValue: todayData.salesValue * 0.8, // Estimate 80% of today
      orderCount: Math.floor(todayData.orderCount * 0.8),
      orders: []
    };
    
    // Staff data (mock for now)
    const staffClockedIn = [
      {
        id: '1',
        name: 'John Smith',
        clockInTime: '08:00',
        role: 'Driver'
      },
      {
        id: '2',
        name: 'Jane Doe',
        clockInTime: '07:30',
        role: 'Kitchen'
      }
    ];
    
    // Delivery map data
    const deliveryMap = todayOrders.slice(0, 10).map((order, index) => ({
      orderNumber: order.orderNumber?.toString() || `Order ${index + 1}`,
      deliveryTime: order.deliveryTime || '12:00',
      address: order.shippingAddress?.address1 || 'Unknown Address',
      coordinates: [-36.8485, 174.7633] as [number, number], // Auckland coordinates
      salesValue: order.totalPrice || 0
    }));
    
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