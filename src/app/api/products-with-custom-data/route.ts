import { NextRequest, NextResponse } from 'next/server';
import { productAdapter } from '@/lib/firestore-adapters';

export async function GET() {
  try {
    // Fetch all products with custom data from Firestore
    const productsWithCustomData = await productAdapter.findMany();
    return NextResponse.json({
      success: true,
      products: productsWithCustomData,
      total: productsWithCustomData.length
    });
  } catch (error) {
    console.error('Error fetching products with custom data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch products with custom data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      variantId,
      shopifyProductId,
      shopifySku,
      shopifyName,
      shopifyTitle,
      shopifyPrice,
      shopifyInventory,
      displayName,
      meat1,
      meat2,
      timer1,
      timer2,
      option1,
      option2,
      serveware,
      ingredients,
      totalCost
    } = body

    // Validate required fields
    if (!variantId || !shopifyProductId || !shopifyName || !shopifyTitle) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create or update product with custom data
    const product = await productAdapter.upsert({
      where: { variantId },
      update: {
        shopifyProductId,
        shopifySku,
        shopifyName,
        shopifyTitle,
        shopifyPrice: parseFloat(shopifyPrice),
        shopifyInventory: parseInt(shopifyInventory),
        displayName,
        meat1,
        meat2,
        timer1: timer1 ? parseInt(timer1) : null,
        timer2: timer2 ? parseInt(timer2) : null,
        option1,
        option2,
        serveware: serveware || false,
        ingredients: ingredients || null,
        totalCost: totalCost || 0
      },
      create: {
        variantId,
        shopifyProductId,
        shopifySku,
        shopifyName,
        shopifyTitle,
        shopifyPrice: parseFloat(shopifyPrice),
        shopifyInventory: parseInt(shopifyInventory),
        displayName,
        meat1,
        meat2,
        timer1: timer1 ? parseInt(timer1) : null,
        timer2: timer2 ? parseInt(timer2) : null,
        option1,
        option2,
        serveware: serveware || false,
        ingredients: ingredients || null,
        totalCost: totalCost || 0
      }
    })

    console.log('Product with custom data saved:', product.id)

    return NextResponse.json({
      success: true,
      product
    })
  } catch (error) {
    console.error('Error saving product with custom data:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save product with custom data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 