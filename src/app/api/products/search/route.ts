import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const group = searchParams.get('group');
    const flat = searchParams.get('flat');
    const limitProducts = parseInt(searchParams.get('limitProducts') || '50', 10);
    const limitVariantsPerProduct = parseInt(searchParams.get('limitVariantsPerProduct') || '200', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Default: return flat variant list (backward compatible)
    if (!group || flat === '1') {
      const variants = await prisma.productVariant.findMany({
        where: {
          OR: [
            { shopifyName: { contains: query, mode: 'insensitive' } },
            { shopifyTitle: { contains: query, mode: 'insensitive' } },
            { shopifySku: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          product: {
            select: {
              shopifyProductId: true,
              productTitle: true,
              displayName: true
            }
          }
        },
        take: 40,
        orderBy: { shopifyName: 'asc' }
      })
      const flatList = variants.map(v => ({
        id: v.id,
        variantId: v.variantId,
        shopifySku: v.shopifySku,
        shopifyName: v.shopifyName,
        shopifyTitle: v.shopifyTitle,
        shopifyPrice: v.shopifyPrice,
        shopifyInventory: v.shopifyInventory,
        displayName: v.displayName,
        productDisplayName: v.product.displayName,
      }))
      return NextResponse.json({ products: flatList })
    }

    // Grouped mode: product-first with top variants per product
    // 1) variant-first search for recall
    const variantHitsTake = Math.min(5000, Math.max(500, limitProducts * limitVariantsPerProduct * 2))
    const variantHits = await prisma.productVariant.findMany({
      where: {
        OR: [
          { shopifyName: { contains: query, mode: 'insensitive' } },
          { shopifyTitle: { contains: query, mode: 'insensitive' } },
          { shopifySku: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        product: { select: { id: true, shopifyProductId: true, productTitle: true, displayName: true } }
      },
      take: variantHitsTake,
      orderBy: { shopifyName: 'asc' }
    })

    // 2) product-first search for better UX ranking
    const productHits = await prisma.shopifyProduct.findMany({
      where: {
        OR: [
          { productTitle: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: Math.max(limitProducts * 2, 50),
      orderBy: { productTitle: 'asc' }
    })

    // Build candidate productId set
    const productIdSet = new Set<string>()
    productHits.forEach(p => productIdSet.add(p.id))
    variantHits.forEach(v => productIdSet.add(v.product.id))

    // Limit to top N products by simple heuristic: prefer direct product matches first
    const prioritized = [
      ...productHits.map(p => ({
        id: p.id,
        shopifyProductId: p.shopifyProductId,
        productTitle: p.productTitle,
        displayName: p.displayName || null,
        rank: 0
      })),
      ...Array.from(productIdSet)
        .filter(id => !productHits.find(p => p.id === id))
        .map(id => ({ id, rank: 1 }))
    ]

    // Deduplicate and cap
    const seen = new Set<string>()
    const topProducts = prioritized.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    }).slice(0, limitProducts)

    // For each product, fetch variants for this product (show many)
    const result: any[] = []
    for (const p of topProducts) {
      let productMeta = p as any
      if (!productMeta.shopifyProductId) {
        const prod = await prisma.shopifyProduct.findUnique({ where: { id: p.id } })
        if (!prod) continue
        productMeta = {
          id: prod.id,
          shopifyProductId: prod.shopifyProductId,
          productTitle: prod.productTitle,
          displayName: prod.displayName || null,
        }
      }
      const fallback = await prisma.productVariant.findMany({
        where: { productId: p.id },
        orderBy: { shopifyName: 'asc' },
        take: limitVariantsPerProduct
      })
      const variants = fallback.map(v => ({
        variantId: v.variantId,
        shopifySku: v.shopifySku,
        shopifyName: v.shopifyName,
        shopifyTitle: v.shopifyTitle,
        shopifyPrice: v.shopifyPrice,
        shopifyInventory: v.shopifyInventory,
      }))
      result.push({ product: productMeta, variants })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}