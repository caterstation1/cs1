import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📦 Fetching products from PostgreSQL...');
    
    const products = await prisma.shopifyProduct.findMany({
      include: {
        variants: {
          orderBy: {
            shopifyName: 'asc'
          }
        }
      },
      orderBy: {
        productTitle: 'asc'
      }
    });
    
    // Build legacy fallback map from product_with_custom_data by variantId
    try {
      const allVariantIds = products.flatMap(p => (p.variants || []).map(v => v.variantId)).filter(Boolean) as string[]
      if (allVariantIds.length > 0) {
        const legacy = await prisma.productWithCustomData.findMany({
          where: { variantId: { in: Array.from(new Set(allVariantIds)) } },
          select: { variantId: true, totalCost: true, ingredients: true }
        })
        const legacyByVariantId = new Map<string, { totalCost: number; ingredients: any }>(
          legacy.map(l => [String(l.variantId), { totalCost: Number(l.totalCost || 0), ingredients: l.ingredients }])
        )
        // Merge fallback into variants (prefer live variant data)
        for (const p of products) {
          if (!Array.isArray(p.variants)) continue
          for (const v of p.variants as any[]) {
            const leg = legacyByVariantId.get(String(v.variantId))
            if (!leg) continue
            // Only fill when missing/empty
            if (!(typeof v.totalCost === 'number') || !isFinite(v.totalCost) || Number(v.totalCost) === 0) {
              v.totalCost = leg.totalCost
            }
            if (v.ingredients == null && leg.ingredients != null) {
              v.ingredients = leg.ingredients
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to join legacy product_with_custom_data fallback:', e)
    }

    console.log(`✅ Successfully fetched ${products.length} products with variants`);
    return NextResponse.json(products);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // For now, we'll handle this through the Shopify sync
    // This endpoint can be used for manual product creation if needed
    const product = await prisma.shopifyProduct.create({
      data: {
        shopifyProductId: body.shopifyProductId,
        productTitle: body.productTitle,
        displayName: body.displayName,
        heroImageUrl: body.heroImageUrl,
        shopifyVendor: body.shopifyVendor,
        shopifyMarket: body.shopifyMarket,
        isActive: body.isActive ?? true
      },
      include: {
        variants: true
      }
    });
    
    console.log(`✅ Created product: ${product.productTitle}`);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
} 