import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { variantId, ...customData } = body;

    console.log('💾 Saving custom data for variant:', variantId, 'Data:', customData);

    if (!variantId) {
      return NextResponse.json(
        { error: 'variantId is required' },
        { status: 400 }
      );
    }

    // Check if product exists
    const existingProduct = await prisma.productWithCustomData.findUnique({
      where: { variantId }
    });

    if (existingProduct) {
      // Update existing product
      const updatedProduct = await prisma.productWithCustomData.update({
        where: { variantId },
        data: {
          displayName: customData.displayName,
          meat1: customData.meat1,
          meat2: customData.meat2,
          timer1: customData.timer1,
          timer2: customData.timer2,
          option1: customData.option1,
          option2: customData.option2,
          serveware: customData.serveware,
          ingredients: customData.ingredients,
          totalCost: customData.totalCost || 0,
          updatedAt: new Date()
        }
      });

      console.log('✅ Updated product custom data:', updatedProduct.shopifyName);
      return NextResponse.json(updatedProduct);
    } else {
      // Create new product (this shouldn't happen often as products are synced from Shopify)
      console.warn('⚠️ Product not found, creating new record for variant:', variantId);
      
      // We need to get the Shopify data first - this is a fallback
      const newProduct = await prisma.productWithCustomData.create({
        data: {
          variantId,
          shopifyProductId: 'unknown', // This would need to be fetched from Shopify
          shopifySku: 'unknown',
          shopifyName: 'Unknown Product',
          shopifyTitle: 'Unknown Product',
          shopifyPrice: '0',
          shopifyInventory: 0,
          displayName: customData.displayName,
          meat1: customData.meat1,
          meat2: customData.meat2,
          timer1: customData.timer1,
          timer2: customData.timer2,
          option1: customData.option1,
          option2: customData.option2,
          serveware: customData.serveware,
          ingredients: customData.ingredients,
          totalCost: customData.totalCost || 0
        }
      });

      console.log('✅ Created new product custom data:', newProduct.shopifyName);
      return NextResponse.json(newProduct);
    }
  } catch (error) {
    console.error('❌ Error saving custom data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save custom data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variantId');

    if (!variantId) {
      return NextResponse.json(
        { error: 'variantId is required' },
        { status: 400 }
      );
    }

    // This function is no longer using Prisma, so it's removed.
    // If Firestore is implemented, this function would need to be updated.
    // For now, it's a placeholder.
    return NextResponse.json({ success: true, message: 'Delete functionality not yet implemented for Firestore.' });
  } catch (error) {
    console.error('Error deleting custom data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete custom data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 400 }
    );
  }
} 