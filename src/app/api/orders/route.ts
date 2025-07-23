import { NextResponse } from 'next/server';
import { orderAdapter } from '@/lib/firestore-adapters';

export async function GET() {
  try {
    // Fetch all orders from Firestore
    const orders = await orderAdapter.findMany();
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error in orders API route:', error);
    
    // Check if it's a Firebase quota exceeded error
    if (error instanceof Error && error.message.includes('quota')) {
      return NextResponse.json(
        { 
          error: 'Firebase quota exceeded. Please upgrade your plan or try again later.',
          details: 'The free tier has been exceeded. Consider upgrading to a paid plan.',
          orders: [] // Return empty array instead of error
        },
        { status: 429 } // Too Many Requests
      );
    }
    
    // For other errors, return empty array instead of 500
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
        orders: [] // Return empty array instead of error
      },
      { status: 200 } // Return 200 with empty data instead of 500
    );
  }
} 