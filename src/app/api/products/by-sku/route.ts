import { NextRequest, NextResponse } from 'next/server';
import { productAdapter } from '@/lib/firestore-adapters';

interface ProductWithVariantId {
  id: string;
  variantId: string;
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const variantIds = searchParams.getAll('variantId');

    if (!variantIds || variantIds.length === 0) {
      return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
    }

    // Fetch all products with these variantIds from Firestore
    const allProducts = (await productAdapter.findMany()) as ProductWithVariantId[];
    const products = allProducts.filter(product => variantIds.includes(product.variantId));

    // Return as a map for easy lookup
    const productMap = Object.fromEntries(
      products.map(product => [product.variantId, product])
    );

    return NextResponse.json(productMap);
  } catch (error) {
    console.error('Error fetching products by variantId:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 