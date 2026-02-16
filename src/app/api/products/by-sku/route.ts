import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const variantIds = searchParams.getAll('variantId');

    // Handle single SKU lookup
    if (sku && variantIds.length === 0) {
      const variant = await prisma.productVariant.findFirst({
        where: {
          shopifySku: sku
        },
        include: {
          product: {
            select: {
              shopifyProductId: true,
              productTitle: true,
              displayName: true,
              heroImageUrl: true,
              shopifyVendor: true,
              shopifyMarket: true,
              baseIngredients: true,
              isPartyPackDefault: true,
              bundleDefaultItems: true
            }
          }
        }
      });

      if (!variant) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }

      // Transform to match expected format
      const product = {
        id: variant.id,
        variantId: variant.variantId,
        shopifyProductId: variant.product.shopifyProductId,
        shopifySku: variant.shopifySku,
        shopifyName: variant.shopifyName,
        shopifyTitle: variant.shopifyTitle,
        shopifyPrice: variant.shopifyPrice,
        shopifyInventory: variant.shopifyInventory,
        shopifyVendor: variant.product.shopifyVendor,
        shopifyMarket: variant.product.shopifyMarket,
        heroImageUrl: variant.product.heroImageUrl,
        displayName: variant.displayName,
        productDisplayName: variant.product.displayName,
        // parent-level pack defaults
        productIsPartyPackDefault: (variant.product as any).isPartyPackDefault ?? false,
        productBundleDefaultItems: (variant.product as any).bundleDefaultItems ?? null,
        meats: (() => {
          const meatsArr = Array.isArray((variant as any).meats) ? (variant as any).meats : null;
          // If meats array exists but is empty, fall back to meat1/meat2
          if (meatsArr && meatsArr.length > 0) return meatsArr;
          if (meatsArr && meatsArr.length === 0 && (variant.meat1 || variant.meat2)) {
            return [variant.meat1 ?? null, variant.meat2 ?? null];
          }
          return meatsArr || [variant.meat1 ?? null, variant.meat2 ?? null];
        })(),
        timers: Array.isArray((variant as any).timers) ? (variant as any).timers : [variant.timer1 ?? null, variant.timer2 ?? null],
        options: Array.isArray((variant as any).options) ? (variant as any).options : [variant.option1 ?? null, variant.option2 ?? null],
        meat1: variant.meat1,
        meat2: variant.meat2,
        timer1: variant.timer1,
        timer2: variant.timer2,
        option1: variant.option1,
        option2: variant.option2,
        serveware: variant.serveware,
        isDraft: variant.isDraft,
        ingredients: variant.ingredients,
        baseIngredients: variant.product.baseIngredients,
        totalCost: variant.totalCost,
        isPartyPack: (variant as any).isPartyPack ?? false,
        bundleItems: (variant as any).bundleItems ?? null
      };

      return NextResponse.json(product);
    }

    // Handle multiple variantId lookup
    if (variantIds.length > 0) {
      const variants = await prisma.productVariant.findMany({
        where: {
          variantId: {
            in: variantIds
          }
        },
        include: {
          product: {
            select: {
              shopifyProductId: true,
              productTitle: true,
              displayName: true,
              heroImageUrl: true,
              shopifyVendor: true,
              shopifyMarket: true,
              baseIngredients: true,
              isPartyPackDefault: true,
              bundleDefaultItems: true
            }
          }
        }
      });

      // Create a map of variantId to product
      const productMap = variants.reduce((acc, variant) => {
        acc[variant.variantId] = {
          id: variant.id,
          variantId: variant.variantId,
          shopifyProductId: variant.product.shopifyProductId,
          shopifySku: variant.shopifySku,
          shopifyName: variant.shopifyName,
          shopifyTitle: variant.shopifyTitle,
          shopifyPrice: variant.shopifyPrice,
          shopifyInventory: variant.shopifyInventory,
          shopifyVendor: variant.product.shopifyVendor,
          shopifyMarket: variant.product.shopifyMarket,
          heroImageUrl: variant.product.heroImageUrl,
          displayName: variant.displayName,
          productDisplayName: variant.product.displayName,
          productIsPartyPackDefault: (variant.product as any).isPartyPackDefault ?? false,
          productBundleDefaultItems: (variant.product as any).bundleDefaultItems ?? null,
          meats: (() => {
            const meatsArr = Array.isArray((variant as any).meats) ? (variant as any).meats : null;
            // If meats array exists but is empty, fall back to meat1/meat2
            if (meatsArr && meatsArr.length > 0) return meatsArr;
            if (meatsArr && meatsArr.length === 0 && (variant.meat1 || variant.meat2)) {
              return [variant.meat1 ?? null, variant.meat2 ?? null];
            }
            return meatsArr || [variant.meat1 ?? null, variant.meat2 ?? null];
          })(),
          timers: Array.isArray((variant as any).timers) ? (variant as any).timers : [variant.timer1 ?? null, variant.timer2 ?? null],
          options: Array.isArray((variant as any).options) ? (variant as any).options : [variant.option1 ?? null, variant.option2 ?? null],
          meat1: variant.meat1,
          meat2: variant.meat2,
          timer1: variant.timer1,
          timer2: variant.timer2,
          option1: variant.option1,
          option2: variant.option2,
          serveware: variant.serveware,
          isDraft: variant.isDraft,
          ingredients: variant.ingredients,
          baseIngredients: variant.product.baseIngredients,
          totalCost: variant.totalCost,
          isPartyPack: (variant as any).isPartyPack ?? false,
          bundleItems: (variant as any).bundleItems ?? null
        };
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