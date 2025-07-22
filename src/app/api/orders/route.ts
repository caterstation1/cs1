import { NextResponse } from 'next/server';
import { orderAdapter } from '@/lib/firestore-adapters';

export async function GET() {
  try {
    // Fetch all orders from Firestore
    const orders = await orderAdapter.findMany();
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error in orders API route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch orders' },
      { status: 500 }
    );
  }
} 