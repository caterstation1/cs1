import { NextResponse } from 'next/server';
import { parseShopifyOrder, updateParsedOrder } from '@/lib/order-parser';

export async function POST(request: Request) {
  try {
    const { order, action } = await request.json();

    if (action === 'parse') {
      const parsedOrder = await parseShopifyOrder(order);
      return NextResponse.json(parsedOrder);
    } else if (action === 'update') {
      const { orderId, updates } = order;
      const updatedOrder = await updateParsedOrder(orderId, updates);
      return NextResponse.json(updatedOrder);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in order parsing:', error);
    return NextResponse.json(
      { error: 'Failed to process order' },
      { status: 500 }
    );
  }
} 