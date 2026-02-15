import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.shopifyProduct.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: {
            shopifyName: 'asc'
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    console.log(`🔄 Patching product ${id} with data:`, data);

    // Filter allowed fields for ShopifyProduct update
    const allowedFields = [
      'displayName', 'baseIngredients', 'isPartyPackDefault', 'bundleDefaultItems', 'bakery'
    ];

    const filteredData = Object.keys(data).reduce((acc, key) => {
      if (allowedFields.includes(key)) {
        acc[key] = data[key];
      }
      return acc;
    }, {} as any);

    console.log(`✅ Filtered data for product update:`, filteredData);

    // Validate bundleDefaultItems if provided
    if (filteredData.bundleDefaultItems) {
      try {
        const arr = Array.isArray(filteredData.bundleDefaultItems) ? filteredData.bundleDefaultItems : JSON.parse(filteredData.bundleDefaultItems as any)
        if (!Array.isArray(arr)) throw new Error('bundleDefaultItems must be an array')
        const cleaned = [] as any[]
        for (const it of arr) {
          if (!it || typeof it !== 'object') continue
          const variantId = String((it as any).variantId || '').trim()
          const quantity = Math.max(1, parseInt(String((it as any).quantity || '1'), 10))
          if (!variantId) continue
          cleaned.push({ variantId, quantity })
        }
        filteredData.bundleDefaultItems = cleaned
      } catch (e) {
        console.warn('Invalid bundleDefaultItems payload; ignoring', e)
        delete filteredData.bundleDefaultItems
      }
    }

    const product = await prisma.shopifyProduct.update({
      where: { id },
      data: filteredData,
      include: {
        variants: {
          orderBy: {
            shopifyName: 'asc'
          }
        }
      }
    });

    console.log(`✅ Successfully updated product ${id}`);
    return NextResponse.json(product);
  } catch (error) {
    console.error(`❌ Error updating product:`, error);
    return NextResponse.json(
      { error: 'Failed to update product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

