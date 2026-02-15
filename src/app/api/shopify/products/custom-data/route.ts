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

    // Check if product variant exists
    const existingVariant = await prisma.productVariant.findUnique({
      where: { variantId },
      include: {
        product: {
          select: {
            shopifyProductId: true,
            productTitle: true,
            displayName: true,
            heroImageUrl: true
          }
        }
      }
    });

    if (existingVariant) {
      // Update existing variant
      const updatedVariant = await prisma.productVariant.update({
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
        },
        include: {
          product: {
            select: {
              shopifyProductId: true,
              productTitle: true,
              displayName: true,
              heroImageUrl: true,
              shopifyVendor: true,
              shopifyMarket: true
            }
          }
        }
      });

      // Transform to match expected format
      const transformedProduct = {
        id: updatedVariant.id,
        variantId: updatedVariant.variantId,
        createdAt: updatedVariant.createdAt,
        updatedAt: updatedVariant.updatedAt,
        shopifyProductId: updatedVariant.product.shopifyProductId,
        shopifySku: updatedVariant.shopifySku,
        shopifyName: updatedVariant.shopifyName,
        shopifyTitle: updatedVariant.shopifyTitle,
        shopifyPrice: updatedVariant.shopifyPrice.toString(),
        shopifyInventory: updatedVariant.shopifyInventory,
        shopifyVendor: updatedVariant.product.shopifyVendor,
        shopifyMarket: updatedVariant.product.shopifyMarket,
        heroImageUrl: updatedVariant.product.heroImageUrl,
        displayName: updatedVariant.displayName,
        meat1: updatedVariant.meat1,
        meat2: updatedVariant.meat2,
        timer1: updatedVariant.timer1,
        timer2: updatedVariant.timer2,
        option1: updatedVariant.option1,
        option2: updatedVariant.option2,
        serveware: updatedVariant.serveware,
        isDraft: updatedVariant.isDraft,
        ingredients: updatedVariant.ingredients,
        totalCost: updatedVariant.totalCost
      };

      console.log('✅ Updated product variant custom data:', updatedVariant.shopifyName);
      return NextResponse.json(transformedProduct);
    } else {
      console.warn('⚠️ Product variant not found:', variantId);
      return NextResponse.json(
        { error: 'Product variant not found' },
        { status: 404 }
      );
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