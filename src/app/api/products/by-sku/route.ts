import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const variantIds = searchParams.getAll('variantId');

    // Handle single SKU lookup
    if (sku && variantIds.length === 0) {
      const product = await prisma.productWithCustomData.findFirst({
        where: {
          shopifySku: sku
        }
      });

      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(product);
    }

    // Handle multiple variantId lookup
    if (variantIds.length > 0) {
      const products = await prisma.productWithCustomData.findMany({
        where: {
          variantId: {
            in: variantIds
          }
        }
      });

      // Create a map of variantId to product
      const productMap = products.reduce((acc, product) => {
        acc[product.variantId] = product;
        return acc;
      }, {} as Record<string, any>);

      return NextResponse.json(productMap);
    }

    return NextResponse.json(
      { error: 'Either sku or variantId parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
} 