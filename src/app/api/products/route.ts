import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadOptionIndex } from '@/lib/costing/load';
import { variantRecipeDisplayCost } from '@/lib/costing/options';

export async function GET() {
  try {
    console.log('📦 Fetching products from PostgreSQL...');
    
    const [products, optionIndex] = await Promise.all([
      prisma.shopifyProduct.findMany({
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
      }),
      loadOptionIndex(),
    ]);

    const payload = products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        displayCost: variantRecipeDisplayCost(
          {
            baseIngredients: product.baseIngredients,
            shopifyName: variant.shopifyName,
            productId: product.id,
            ingredients: variant.ingredients,
            storedTotalCost: Number(variant.totalCost ?? 0),
          },
          optionIndex
        ),
      })),
    }));
    
    console.log(`✅ Successfully fetched ${products.length} products with variants`);
    return NextResponse.json(payload);
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