import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('👥 Fetching customers data...');

    // Get all orders with customer information
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        customerEmail: true,
        customerFirstName: true,
        customerLastName: true,
        customerPhone: true,
        totalPrice: true,
        createdAt: true,
        deliveryDate: true,
        fulfillmentStatus: true,
        orderNumber: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 Found ${orders.length} orders with customer data`);

    // Group orders by customer email
    const customerMap = new Map<string, any>();

    orders.forEach(order => {
      const email = order.customerEmail;
      if (!email || email.trim() === '') return;

      if (!customerMap.has(email)) {
        customerMap.set(email, {
          id: email, // Using email as ID for now
          email: email,
          firstName: order.customerFirstName || '',
          lastName: order.customerLastName || '',
          phone: order.customerPhone || '',
          orders: [],
          totalOrders: 0,
          totalSpent: 0,
          last60DaysSpent: 0,
          firstOrderDate: order.createdAt,
          lastOrderDate: order.createdAt,
          internalNotes: '', // This would come from a separate customer table
          averageOrderValue: 0,
          orderFrequency: 0,
          isVIP: false, // This would be calculated based on criteria
          tags: []
        });
      }

      const customer = customerMap.get(email);
      customer.orders.push(order);
      customer.totalOrders += 1;
      customer.totalSpent += order.totalPrice || 0;

      // Update first and last order dates
      if (new Date(order.createdAt) < new Date(customer.firstOrderDate)) {
        customer.firstOrderDate = order.createdAt;
      }
      if (new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
        customer.lastOrderDate = order.createdAt;
      }

      // Calculate last 60 days spend
      const orderDate = new Date(order.createdAt);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      if (orderDate >= sixtyDaysAgo) {
        customer.last60DaysSpent += order.totalPrice || 0;
      }
    });

    // Calculate additional metrics for each customer
    const customers = Array.from(customerMap.values()).map(customer => {
      // Calculate average order value
      customer.averageOrderValue = customer.totalSpent / customer.totalOrders;

      // Calculate order frequency (average days between orders)
      if (customer.totalOrders > 1) {
        const firstOrder = new Date(customer.firstOrderDate);
        const lastOrder = new Date(customer.lastOrderDate);
        const totalDays = (lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24);
        customer.orderFrequency = Math.round(totalDays / (customer.totalOrders - 1));
      } else {
        customer.orderFrequency = 0;
      }

      // Determine VIP status (example criteria: >$1000 total spend or >10 orders)
      customer.isVIP = customer.totalSpent > 1000 || customer.totalOrders > 10;

      // Add tags based on behavior
      const tags = [];
      if (customer.totalSpent > 2000) tags.push('High Value');
      if (customer.totalOrders > 20) tags.push('Frequent Buyer');
      if (customer.last60DaysSpent > 500) tags.push('Recent Activity');
      if (customer.averageOrderValue > 200) tags.push('Large Orders');
      customer.tags = tags;

      return customer;
    });

    console.log(`✅ Processed ${customers.length} unique customers`);

    return NextResponse.json({
      customers: customers,
      summary: {
        totalCustomers: customers.length,
        totalOrders: orders.length,
        totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
        averageCustomerValue: customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length,
        vipCustomers: customers.filter(c => c.isVIP).length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}
