import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function toSafeInt(value: unknown): number {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isAucklandMarket(market?: string | null): boolean {
  const m = String(market || '').toLowerCase()
  if (!m) return false
  return m.includes('akl') || m.includes('auckland')
}

function scoreProductMatch(queryLower: string, displayName?: string | null, productTitle?: string | null): number {
  const dn = String(displayName || '').toLowerCase()
  const pt = String(productTitle || '').toLowerCase()
  if (!dn && !pt) return 0
  if (dn === queryLower || pt === queryLower) return 240
  if (dn.startsWith(queryLower) || pt.startsWith(queryLower)) return 160
  if (dn.includes(queryLower) || pt.includes(queryLower)) return 90
  return 0
}

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
        product: { select: { id: true, shopifyProductId: true, productTitle: true, displayName: true, shopifyMarket: true } }
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

    const candidateProductIds = Array.from(productIdSet)
    if (candidateProductIds.length === 0) return NextResponse.json([])

    const candidateProducts = await prisma.shopifyProduct.findMany({
      where: { id: { in: candidateProductIds } },
      select: {
        id: true,
        shopifyProductId: true,
        productTitle: true,
        displayName: true,
        shopifyMarket: true,
      },
    })

    const candidateVariants = await prisma.productVariant.findMany({
      where: { productId: { in: candidateProductIds } },
      orderBy: { shopifyName: 'asc' },
      take: Math.max(5000, candidateProductIds.length * limitVariantsPerProduct),
      select: {
        productId: true,
        variantId: true,
        shopifySku: true,
        shopifyName: true,
        shopifyTitle: true,
        shopifyPrice: true,
        shopifyInventory: true,
        displayName: true,
        isPartyPack: true,
      },
    })

    const variantByProductId = new Map<string, typeof candidateVariants>()
    for (const v of candidateVariants) {
      const list = variantByProductId.get(v.productId) || []
      list.push(v)
      variantByProductId.set(v.productId, list)
    }

    // Usage ranking: estimate "most common items" from recent orders.
    // Best effort only; fallback to zero usage if query fails.
    const usageByProductId = new Map<string, number>()
    if (candidateProductIds.length > 0) {
      try {
        const variantToProductId = new Map<string, string>()
        for (const v of candidateVariants) {
          if (v.variantId && v.productId) variantToProductId.set(v.variantId, v.productId)
        }

        const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
        const recentOrders = await prisma.order.findMany({
          where: {
            cancelledAt: null,
            createdAt: { gte: since },
          },
          select: { lineItems: true },
          take: 3000,
          orderBy: { createdAt: 'desc' },
        })

        for (const order of recentOrders) {
          const rawItems = Array.isArray(order.lineItems) ? order.lineItems : []
          for (const item of rawItems as any[]) {
            const variantIdRaw = item?.variant_id ?? item?.variantId
            const variantId = String(variantIdRaw || '').trim()
            if (!variantId) continue
            const productId = variantToProductId.get(variantId)
            if (!productId) continue
            const qty = Math.max(1, toSafeInt(item?.quantity))
            usageByProductId.set(productId, (usageByProductId.get(productId) || 0) + qty)
          }
        }
      } catch (error) {
        console.warn('Usage ranking query failed, falling back to heuristic sort:', error)
      }
    }

    const queryLower = query.toLowerCase()
    const rankedProducts = candidateProducts
      .map((p) => {
        const vars = variantByProductId.get(p.id) || []
        const titleText = `${p.displayName || ''} ${p.productTitle || ''}`.toLowerCase()
        const isPartyPackProduct =
          titleText.includes('party pack') ||
          vars.some((v) => v.isPartyPack || String(v.shopifyTitle || '').toLowerCase().includes('party pack'))
        const usage = usageByProductId.get(p.id) || 0
        const marketBoost = isAucklandMarket(p.shopifyMarket) ? 65 : 0
        const matchBoost = scoreProductMatch(queryLower, p.displayName, p.productTitle)
        const partyPenalty = isPartyPackProduct ? 140 : 0
        const score = (usage * 3) + marketBoost + matchBoost - partyPenalty
        return { product: p, variants: vars, score, usage, isPartyPackProduct }
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.usage !== a.usage) return b.usage - a.usage
        return (a.product.productTitle || '').localeCompare(b.product.productTitle || '')
      })
      .slice(0, limitProducts)

    const result = rankedProducts.map((row) => {
      const sortedVariants = [...row.variants]
        .sort((a, b) => {
          const aParty = Boolean(a.isPartyPack || String(a.shopifyTitle || '').toLowerCase().includes('party pack'))
          const bParty = Boolean(b.isPartyPack || String(b.shopifyTitle || '').toLowerCase().includes('party pack'))
          if (aParty !== bParty) return aParty ? 1 : -1

          const aText = `${a.displayName || ''} ${a.shopifyName || ''} ${a.shopifyTitle || ''}`.toLowerCase()
          const bText = `${b.displayName || ''} ${b.shopifyName || ''} ${b.shopifyTitle || ''}`.toLowerCase()
          const aStarts = aText.startsWith(queryLower) ? 1 : 0
          const bStarts = bText.startsWith(queryLower) ? 1 : 0
          if (aStarts !== bStarts) return bStarts - aStarts
          return String(a.shopifyName || '').localeCompare(String(b.shopifyName || ''))
        })
        .slice(0, limitVariantsPerProduct)
        .map(v => ({
          variantId: v.variantId,
          shopifySku: v.shopifySku,
          shopifyName: v.shopifyName,
          shopifyTitle: v.shopifyTitle,
          shopifyPrice: v.shopifyPrice,
          shopifyInventory: v.shopifyInventory,
          displayName: v.displayName,
          isPartyPack: v.isPartyPack,
        }))

      return {
        product: {
          id: row.product.id,
          shopifyProductId: row.product.shopifyProductId,
          productTitle: row.product.productTitle,
          displayName: row.product.displayName || null,
          shopifyMarket: row.product.shopifyMarket || null,
          usageCount: row.usage,
          isPartyPack: row.isPartyPackProduct,
        },
        variants: sortedVariants,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}