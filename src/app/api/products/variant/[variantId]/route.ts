import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeVariantCost } from '@/lib/pricing/persist';

/**
 * Re-derives and stores this variant's cost after its recipe changed.
 *
 * The browser sends a `totalCost` summed from the rows in the variant editor,
 * which are the variant's own rows only — saving a variant of a product with a
 * base recipe used to write a total with the entire base missing. That figure
 * is discarded; the engine's number, which starts from the product base, is
 * stored instead. An unresolvable cost leaves the stored value alone rather
 * than replacing a known number with a guess.
 */
async function recostVariant(variantId: string): Promise<number | null> {
  try {
    const outcome = await computeVariantCost(variantId);
    if (outcome.totalCost == null) {
      console.warn(`⚠️ Variant ${variantId} cost left unchanged: ${outcome.reasons.join(', ')}`);
      return null;
    }
    await prisma.productVariant.update({
      where: { variantId },
      data: { totalCost: outcome.totalCost },
    });
    return outcome.totalCost;
  } catch (error) {
    // A costing failure must not lose the recipe edit that has already been saved.
    console.error(`❌ Failed to recost variant ${variantId}:`, error);
    return null;
  }
}

function calcTotal(ings: any[]): number {
  if (!Array.isArray(ings)) return 0;
  return Number(
    (ings as any[]).reduce((s, ing) => {
      const q = Number(ing?.quantity || 0);
      const c = Number(ing?.cost || 0);
      return s + (isFinite(q) && isFinite(c) ? q * c : 0);
    }, 0).toFixed(2)
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  try {
    const { variantId } = await params;
    const variant = await prisma.productVariant.findUnique({
      where: { variantId },
      include: {
        product: {
          select: {
            id: true,
            shopifyProductId: true,
            productTitle: true,
            displayName: true,
            heroImageUrl: true,
            shopifyVendor: true,
            shopifyMarket: true,
            isPartyPackDefault: true,
            bundleDefaultItems: true,
            baseIngredients: true
          }
        }
      }
    });

    if (!variant) {
      return NextResponse.json(
        { error: 'Product variant not found' },
        { status: 404 }
      );
    }

    const baseIngredients = (variant.product as any).baseIngredients ?? null;
    const variantIngredients = (variant as any).ingredients ?? null;
    const combined = [
      ...(Array.isArray(baseIngredients) ? baseIngredients : []),
      ...(Array.isArray(variantIngredients) ? variantIngredients : []),
    ];
    const combinedTotal = calcTotal(combined);

    // Transform to match expected format
    const cleanedMeats = Array.isArray(variant.meats) ? (variant.meats as any[]).map(v => v ?? null) : null;
    const meatsAllEmpty = Array.isArray(cleanedMeats) && cleanedMeats.every(v => (v ?? '').toString().trim() === '');
    const effectiveMeats = Array.isArray(cleanedMeats) ? (meatsAllEmpty ? [variant.meat1 ?? null, variant.meat2 ?? null] : cleanedMeats) : [variant.meat1 ?? null, variant.meat2 ?? null];
    const cleanedTimers = Array.isArray(variant.timers) ? (variant.timers as any[]).map(v => (v ?? null)) : null;
    const timersAllEmpty = Array.isArray(cleanedTimers) && cleanedTimers.every(v => v == null);
    const effectiveTimers = Array.isArray(cleanedTimers) ? (timersAllEmpty ? [variant.timer1 ?? null, variant.timer2 ?? null] : cleanedTimers) : [variant.timer1 ?? null, variant.timer2 ?? null];
    const cleanedOptions = Array.isArray(variant.options) ? (variant.options as any[]).map(v => v ?? null) : null;
    const optionsAllEmpty = Array.isArray(cleanedOptions) && cleanedOptions.every(v => (v ?? '').toString().trim() === '');
    const effectiveOptions = Array.isArray(cleanedOptions) ? (optionsAllEmpty ? [variant.option1 ?? null, variant.option2 ?? null] : cleanedOptions) : [variant.option1 ?? null, variant.option2 ?? null];

    const product = {
      id: variant.id,
      variantId: variant.variantId,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      productId: (variant.product as any).id,
      shopifyProductId: variant.product.shopifyProductId,
      shopifySku: variant.shopifySku,
      shopifyName: variant.shopifyName,
      shopifyTitle: variant.shopifyTitle,
      // Use shopifyName for the human variant title
      variantTitle: variant.shopifyName,
      productTitle: (variant.product as any).productTitle,
      shopifyPrice: variant.shopifyPrice.toString(),
      shopifyInventory: variant.shopifyInventory,
      shopifyVendor: variant.product.shopifyVendor,
      shopifyMarket: variant.product.shopifyMarket,
      heroImageUrl: variant.product.heroImageUrl,
      displayName: variant.displayName,
      // Arrays with legacy fallback
      meats: effectiveMeats,
      timers: effectiveTimers,
      options: effectiveOptions,
      meat1: variant.meat1,
      meat2: variant.meat2,
      timer1: variant.timer1,
      timer2: variant.timer2,
      option1: variant.option1,
      option2: variant.option2,
      serveware: variant.serveware,
      isDraft: variant.isDraft,
      ingredients: variant.ingredients,
      totalCost: combinedTotal > 0 ? combinedTotal : Number(variant.totalCost || 0),
      isPartyPack: (variant as any).isPartyPack ?? false,
      bundleItems: (variant as any).bundleItems ?? null,
      productIsPartyPackDefault: (variant.product as any).isPartyPackDefault ?? false,
      productBundleDefaultItems: (variant.product as any).bundleDefaultItems ?? null,
      baseIngredients: (variant.product as any).baseIngredients ?? null
    };

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

    // Check if variant exists, if not return 404
    const existingVariant = await prisma.productVariant.findUnique({
      where: { variantId }
    });

    if (!existingVariant) {
      return NextResponse.json(
        { error: 'Product variant not found' },
        { status: 404 }
      );
    }

    // Cost is server-derived; see recostVariant.
    const { totalCost: _clientTotalCost, ...writable } = data;

    const variant = await prisma.productVariant.update({
      where: { variantId },
      data: writable,
      include: {
        product: {
          select: {
            shopifyProductId: true,
            productTitle: true,
            displayName: true,
            heroImageUrl: true,
            shopifyVendor: true,
            shopifyMarket: true,
            isPartyPackDefault: true,
            bundleDefaultItems: true
          }
        }
      }
    });

    const recostedTotal =
      'ingredients' in writable || 'bundleItems' in writable ? await recostVariant(variantId) : null;

    // Transform to match expected format
    const cleanedMeats2 = Array.isArray(variant.meats) ? (variant.meats as any[]).map(v => v ?? null) : null;
    const meatsAllEmpty2 = Array.isArray(cleanedMeats2) && cleanedMeats2.every(v => (v ?? '').toString().trim() === '');
    const effectiveMeats2 = Array.isArray(cleanedMeats2) ? (meatsAllEmpty2 ? [variant.meat1 ?? null, variant.meat2 ?? null] : cleanedMeats2) : [variant.meat1 ?? null, variant.meat2 ?? null];
    const cleanedTimers2 = Array.isArray(variant.timers) ? (variant.timers as any[]).map(v => (v ?? null)) : null;
    const timersAllEmpty2 = Array.isArray(cleanedTimers2) && cleanedTimers2.every(v => v == null);
    const effectiveTimers2 = Array.isArray(cleanedTimers2) ? (timersAllEmpty2 ? [variant.timer1 ?? null, variant.timer2 ?? null] : cleanedTimers2) : [variant.timer1 ?? null, variant.timer2 ?? null];
    const cleanedOptions2 = Array.isArray(variant.options) ? (variant.options as any[]).map(v => v ?? null) : null;
    const optionsAllEmpty2 = Array.isArray(cleanedOptions2) && cleanedOptions2.every(v => (v ?? '').toString().trim() === '');
    const effectiveOptions2 = Array.isArray(cleanedOptions2) ? (optionsAllEmpty2 ? [variant.option1 ?? null, variant.option2 ?? null] : cleanedOptions2) : [variant.option1 ?? null, variant.option2 ?? null];

    const product = {
      id: variant.id,
      variantId: variant.variantId,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      shopifyProductId: variant.product.shopifyProductId,
      shopifySku: variant.shopifySku,
      shopifyName: variant.shopifyName,
      shopifyTitle: variant.shopifyTitle,
      shopifyPrice: variant.shopifyPrice.toString(),
      shopifyInventory: variant.shopifyInventory,
      shopifyVendor: variant.product.shopifyVendor,
      shopifyMarket: variant.product.shopifyMarket,
      heroImageUrl: variant.product.heroImageUrl,
      displayName: variant.displayName,
      meats: effectiveMeats2,
      timers: effectiveTimers2,
      options: effectiveOptions2,
      meat1: variant.meat1,
      meat2: variant.meat2,
      timer1: variant.timer1,
      timer2: variant.timer2,
      option1: variant.option1,
      option2: variant.option2,
      serveware: variant.serveware,
      isDraft: variant.isDraft,
      ingredients: variant.ingredients,
      totalCost: recostedTotal ?? variant.totalCost,
      isPartyPack: (variant as any).isPartyPack ?? false,
      bundleItems: (variant as any).bundleItems ?? null,
      productIsPartyPackDefault: (variant.product as any).isPartyPackDefault ?? false,
      productBundleDefaultItems: (variant.product as any).bundleDefaultItems ?? null
    };

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

    console.log(`🔄 Patching product variant ${variantId} with data:`, data);

    // Filter out fields that don't exist in the ProductVariant schema.
    // `totalCost` is deliberately absent: it is server-derived, see recostVariant.
    const allowedFields = [
      'displayName', 'meat1', 'meat2', 'timer1', 'timer2', 
      'option1', 'option2', 'meats', 'timers', 'options', 'serveware', 'isDraft', 'ingredients',
      'isPartyPack', 'bundleItems'
    ];

    const filteredData = Object.keys(data).reduce((acc, key) => {
      if (allowedFields.includes(key)) {
        acc[key] = data[key];
      }
      return acc;
    }, {} as any);

    // Mirror arrays to legacy fields for compatibility
    if (Array.isArray(filteredData.meats)) {
      const meats = filteredData.meats as any[];
      filteredData.meat1 = meats[0] ?? filteredData.meat1 ?? null;
      filteredData.meat2 = meats[1] ?? filteredData.meat2 ?? null;
    }
    if (Array.isArray(filteredData.timers)) {
      const timers = filteredData.timers as any[];
      filteredData.timer1 = timers[0] ?? filteredData.timer1 ?? null;
      filteredData.timer2 = timers[1] ?? filteredData.timer2 ?? null;
    }
    if (Array.isArray(filteredData.options)) {
      const options = filteredData.options as any[];
      filteredData.option1 = options[0] ?? filteredData.option1 ?? null;
      filteredData.option2 = options[1] ?? filteredData.option2 ?? null;
    }

    // Normalize scalar compatibility fields to avoid invalid payloads.
    if ('timer1' in filteredData) {
      const value = Number(filteredData.timer1);
      filteredData.timer1 = Number.isFinite(value) ? value : null;
    }
    if ('timer2' in filteredData) {
      const value = Number(filteredData.timer2);
      filteredData.timer2 = Number.isFinite(value) ? value : null;
    }
    if ('serveware' in filteredData) {
      filteredData.serveware = Boolean(filteredData.serveware);
    }
    if ('displayName' in filteredData && typeof filteredData.displayName === 'string') {
      filteredData.displayName = filteredData.displayName.trim();
    }
    if ('meat1' in filteredData && typeof filteredData.meat1 === 'string') {
      filteredData.meat1 = filteredData.meat1.trim();
    }
    if ('meat2' in filteredData && typeof filteredData.meat2 === 'string') {
      filteredData.meat2 = filteredData.meat2.trim();
    }
    if ('option1' in filteredData && typeof filteredData.option1 === 'string') {
      filteredData.option1 = filteredData.option1.trim();
    }
    if ('option2' in filteredData && typeof filteredData.option2 === 'string') {
      filteredData.option2 = filteredData.option2.trim();
    }

    // Validate bundleItems if provided
    if (filteredData.bundleItems) {
      try {
        const arr = Array.isArray(filteredData.bundleItems) ? filteredData.bundleItems : JSON.parse(filteredData.bundleItems as any)
        if (!Array.isArray(arr)) throw new Error('bundleItems must be an array')
        // Coerce and validate items
        const cleaned = [] as any[]
        for (const it of arr) {
          if (!it || typeof it !== 'object') continue
          const childVariantId = String((it as any).variantId || '').trim()
          const quantity = Math.max(1, parseInt(String((it as any).quantity || '1'), 10))
          if (!childVariantId) continue
          if (childVariantId === variantId) continue // prevent self-reference
          cleaned.push({ variantId: childVariantId, quantity })
        }
        filteredData.bundleItems = cleaned
      } catch (e) {
        console.warn('Invalid bundleItems payload; ignoring', e)
        delete filteredData.bundleItems
      }
    }

    console.log(`✅ Filtered data for update:`, filteredData);

    const variant = await prisma.productVariant.update({
      where: { variantId },
      data: filteredData,
      include: {
        product: {
          select: {
            shopifyProductId: true,
            productTitle: true,
            displayName: true,
            heroImageUrl: true,
            shopifyVendor: true,
            shopifyMarket: true,
            isPartyPackDefault: true,
            bundleDefaultItems: true
          }
        }
      }
    });

    const recostedTotal =
      'ingredients' in filteredData || 'bundleItems' in filteredData ? await recostVariant(variantId) : null;

    // Transform to match expected format
    const cleanedMeats3 = Array.isArray(variant.meats) ? (variant.meats as any[]).map(v => v ?? null) : null;
    const meatsAllEmpty3 = Array.isArray(cleanedMeats3) && cleanedMeats3.every(v => (v ?? '').toString().trim() === '');
    const effectiveMeats3 = Array.isArray(cleanedMeats3) ? (meatsAllEmpty3 ? [variant.meat1 ?? null, variant.meat2 ?? null] : cleanedMeats3) : [variant.meat1 ?? null, variant.meat2 ?? null];
    const cleanedTimers3 = Array.isArray(variant.timers) ? (variant.timers as any[]).map(v => (v ?? null)) : null;
    const timersAllEmpty3 = Array.isArray(cleanedTimers3) && cleanedTimers3.every(v => v == null);
    const effectiveTimers3 = Array.isArray(cleanedTimers3) ? (timersAllEmpty3 ? [variant.timer1 ?? null, variant.timer2 ?? null] : cleanedTimers3) : [variant.timer1 ?? null, variant.timer2 ?? null];
    const cleanedOptions3 = Array.isArray(variant.options) ? (variant.options as any[]).map(v => v ?? null) : null;
    const optionsAllEmpty3 = Array.isArray(cleanedOptions3) && cleanedOptions3.every(v => (v ?? '').toString().trim() === '');
    const effectiveOptions3 = Array.isArray(cleanedOptions3) ? (optionsAllEmpty3 ? [variant.option1 ?? null, variant.option2 ?? null] : cleanedOptions3) : [variant.option1 ?? null, variant.option2 ?? null];

    const product = {
      id: variant.id,
      variantId: variant.variantId,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      shopifyProductId: variant.product.shopifyProductId,
      shopifySku: variant.shopifySku,
      shopifyName: variant.shopifyName,
      shopifyTitle: variant.shopifyTitle,
      shopifyPrice: variant.shopifyPrice.toString(),
      shopifyInventory: variant.shopifyInventory,
      shopifyVendor: variant.product.shopifyVendor,
      shopifyMarket: variant.product.shopifyMarket,
      heroImageUrl: variant.product.heroImageUrl,
      displayName: variant.displayName,
      meats: effectiveMeats3,
      timers: effectiveTimers3,
      options: effectiveOptions3,
      meat1: variant.meat1,
      meat2: variant.meat2,
      timer1: variant.timer1,
      timer2: variant.timer2,
      option1: variant.option1,
      option2: variant.option2,
      serveware: variant.serveware,
      isDraft: variant.isDraft,
      ingredients: variant.ingredients,
      totalCost: recostedTotal ?? variant.totalCost,
      isPartyPack: (variant as any).isPartyPack ?? false,
      bundleItems: (variant as any).bundleItems ?? null,
      productIsPartyPackDefault: (variant.product as any).isPartyPackDefault ?? false,
      productBundleDefaultItems: (variant.product as any).bundleDefaultItems ?? null
    };

    console.log(`✅ Successfully updated product variant ${variantId}`);
    return NextResponse.json(product);
  } catch (error) {
    console.error(`❌ Error updating product variant:`, error);
    return NextResponse.json(
      { error: 'Failed to update product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
