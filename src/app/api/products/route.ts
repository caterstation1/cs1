import { NextResponse } from 'next/server';
import { productAdapter } from '@/lib/firestore-adapters';

export async function GET() {
  try {
    // Fetch all products from Firestore
    const products = await productAdapter.findMany();
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 