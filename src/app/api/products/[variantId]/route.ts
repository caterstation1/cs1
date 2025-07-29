import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  try {
    const { variantId } = await params;
    const product = await prisma.productWithCustomData.findUnique({
      where: { variantId }
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  try {
    const { variantId } = await params;
    const data = await request.json();

    const product = await prisma.productWithCustomData.upsert({
      where: { variantId },
      update: data,
      create: { variantId, ...data }
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  try {
    const { variantId } = await params;
    const data = await request.json();

    console.log(`🔄 Patching product ${variantId} with data:`, data);

    // Filter out fields that don't exist in the schema
    const allowedFields = [
      'displayName', 'meat1', 'meat2', 'timer1', 'timer2', 
      'option1', 'option2', 'serveware', 'isDraft', 'ingredients', 'totalCost'
    ];

    const filteredData = Object.keys(data).reduce((acc, key) => {
      if (allowedFields.includes(key)) {
        acc[key] = data[key];
      }
      return acc;
    }, {} as any);

    console.log(`✅ Filtered data for update:`, filteredData);

    const product = await prisma.productWithCustomData.update({
      where: { variantId },
      data: filteredData
    });

    console.log(`✅ Successfully updated product ${variantId}`);
    return NextResponse.json(product);
  } catch (error) {
    console.error(`❌ Error updating product:`, error);
    return NextResponse.json(
      { error: 'Failed to update product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 