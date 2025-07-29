import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🧪 Testing product population...');
    
    // Create a test product
    const testProduct = await prisma.productWithCustomData.create({
      data: {
        variantId: `test_${Date.now()}`,
        shopifyProductId: '123456',
        shopifySku: 'TEST-SKU-001',
        shopifyName: 'Test Product',
        shopifyTitle: 'Test Product Title',
        shopifyPrice: 25.00,
        shopifyInventory: 10,
        displayName: 'Test Product',
        isDraft: false,
        totalCost: 15.00
      }
    });
    
    console.log('✅ Created test product:', testProduct);
    
    // Clean up - delete the test product
    await prisma.productWithCustomData.delete({
      where: { id: testProduct.id }
    });
    
    console.log('🗑️ Cleaned up test product');
    
    return NextResponse.json({
      success: true,
      message: 'Product population test completed',
      testProduct: {
        id: testProduct.id,
        variantId: testProduct.variantId,
        displayName: testProduct.displayName,
        shopifyPrice: testProduct.shopifyPrice
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing product population:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test product population',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 