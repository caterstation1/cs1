import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface BundleVariantLookupEntry {
  variantId: string;
  variantName: string;
  productName: string;
  shopifySku?: string;
}

export type BundleVariantLookup = Map<string, BundleVariantLookupEntry>;

interface LookupSourceVariant {
  variantId: string;
  shopifyName?: string;
  shopifyTitle?: string;
  shopifySku?: string;
}

interface LookupSourceProduct {
  productTitle?: string;
  displayName?: string;
  variants?: LookupSourceVariant[] | null;
}

/**
 * Index every variant in the catalogue by its Shopify variant id so a bundle
 * row can be labelled without a per-row lookup or fetch. Build this from the
 * unfiltered product list: a bundle on a party pack routinely points at
 * variants of other products, which the on-screen search has filtered out.
 */
export function buildBundleVariantLookup(products: LookupSourceProduct[]): BundleVariantLookup {
  const lookup: BundleVariantLookup = new Map();
  for (const product of products) {
    if (!product || !Array.isArray(product.variants)) continue;
    const productName = product.productTitle || product.displayName || 'Untitled product';
    for (const variant of product.variants) {
      if (!variant || !variant.variantId) continue;
      const variantName =
        variant.shopifyName && variant.shopifyName !== 'Default Title'
          ? variant.shopifyName
          : variant.shopifyTitle || '';
      lookup.set(String(variant.variantId), {
        variantId: String(variant.variantId),
        variantName,
        productName,
        shopifySku: variant.shopifySku,
      });
    }
  }
  return lookup;
}

interface BundleItemRowProps {
  variantId: string;
  quantity: number;
  lookup: BundleVariantLookup;
  onRemove: () => void;
  disabled?: boolean;
}

export function BundleItemRow({ variantId, quantity, lookup, onRemove, disabled }: BundleItemRowProps) {
  const entry = lookup.get(String(variantId));

  return (
    <div className="flex items-center gap-2 bg-white p-2 rounded border">
      <div className="flex-1 min-w-0">
        {entry ? (
          <>
            <div className="text-sm font-medium">{entry.productName}</div>
            {entry.variantName && entry.variantName !== entry.productName && (
              <div className="text-sm">{entry.variantName}</div>
            )}
            <div className="text-[10px] text-gray-500">
              {entry.shopifySku ? `SKU: ${entry.shopifySku} • ` : ''}Variant ID: {variantId}
            </div>
          </>
        ) : (
          // A dangling reference means the bundle points at a deleted or draft
          // variant, so it is surfaced rather than quietly shown as an id.
          <>
            <div className="text-sm font-medium text-red-600">Unknown variant</div>
            <div className="text-[10px] text-red-500">
              Not found in the product catalogue • Variant ID: {variantId}
            </div>
          </>
        )}
      </div>
      <span className="text-sm whitespace-nowrap">
        <strong>Qty</strong>: {quantity}
      </span>
      <Button size="sm" variant="ghost" onClick={onRemove} disabled={disabled} className="h-6 w-6 p-0">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
