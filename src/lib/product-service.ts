// src/lib/product-service.ts

// Product cache implementation
const productCache = new Map<string, any>();
let cacheTimeout: NodeJS.Timeout | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Clear cache after duration
const setupCacheTimeout = () => {
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
  }
  cacheTimeout = setTimeout(() => {
    productCache.clear();
    cacheTimeout = null;
  }, CACHE_DURATION);
};

// 🔹 Fetch a single product by SKU
export async function fetchProduct(sku: string) {
  if (productCache.has(sku)) return productCache.get(sku)

  try {
    const response = await fetch(`/api/products/by-sku?sku=${sku}`)
    if (!response.ok) return null

    const product = await response.json()
    productCache.set(sku, product)
    saveProductCache()
    return product
  } catch (err) {
    console.error(`❌ Failed to fetch product ${sku}:`, err)
    return null
  }
}

// 🔹 Fetch multiple products by variantId (with deduping and cache)
export const fetchProducts = async (variantIds: string[]): Promise<Record<string, any>> => {
  // Filter out variantIds we already have in cache
  const uncachedIds = variantIds.filter(id => !productCache.has(id));
  
  if (uncachedIds.length === 0) {
    // All cached; still verify staleness and refresh if needed
    const staleIds = variantIds.filter(id => {
      const p = productCache.get(id);
      if (!p) return true;
      const missingDisplay = p.productDisplayName === undefined && p.displayName === undefined;
      const meatsEmpty = !Array.isArray(p.meats) || (Array.isArray(p.meats) && p.meats.every((m:any)=> (m ?? '').toString().trim()===''));
      const timersMaybeMissing = p.timers !== undefined && Array.isArray(p.timers) && p.timers.length>0 && p.timers.every((t:any)=> t==null);
      return missingDisplay || meatsEmpty || timersMaybeMissing;
    });
    if (staleIds.length > 0) {
      try {
        const staleParams = staleIds.map(id => `variantId=${encodeURIComponent(id)}`).join('&');
        const staleUrl = `/api/products/by-sku?${staleParams}`;
        console.log('🔄 Refreshing stale product cache (all-cached path):', staleUrl);
        const staleRes = await fetch(staleUrl);
        if (staleRes.ok) {
          const staleMap = await staleRes.json();
          Object.entries(staleMap).forEach(([id, product]) => productCache.set(id, product));
        }
      } catch (e) {
        console.warn('⚠️ Failed to refresh stale product cache entries (all-cached):', e);
      }
    }
    return Object.fromEntries(variantIds.map(id => [id, productCache.get(id)]));
  }

  // Fetch only uncached variantIds
  const params = uncachedIds.map(id => `variantId=${encodeURIComponent(id)}`).join('&');
  const url = `/api/products/by-sku?${params}`;
  console.log('🔍 Fetching products from:', url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch products by variantId');
  const newProductMap = await response.json();
  // Cache the results
  Object.entries(newProductMap).forEach(([id, product]) => {
    productCache.set(id, product);
  });
  setupCacheTimeout();
  // Identify stale cache entries (missing parent display name added in later API)
  const staleIds = variantIds.filter(id => {
    const p = productCache.get(id);
    if (!p) return true;
    const missingDisplay = p.productDisplayName === undefined && p.displayName === undefined;
    const meatsEmpty = !Array.isArray(p.meats) || (Array.isArray(p.meats) && p.meats.every((m:any)=> (m ?? '').toString().trim()===''));
    const timersMaybeMissing = p.timers !== undefined && Array.isArray(p.timers) && p.timers.length>0 && p.timers.every((t:any)=> t==null);
    return missingDisplay || meatsEmpty || timersMaybeMissing;
  });
  if (staleIds.length > 0) {
    try {
      const staleParams = staleIds.map(id => `variantId=${encodeURIComponent(id)}`).join('&');
      const staleUrl = `/api/products/by-sku?${staleParams}`;
      console.log('🔄 Refreshing stale product cache from:', staleUrl);
      const staleRes = await fetch(staleUrl);
      if (staleRes.ok) {
        const staleMap = await staleRes.json();
        Object.entries(staleMap).forEach(([id, product]) => productCache.set(id, product));
      }
    } catch (e) {
      console.warn('⚠️ Failed to refresh stale product cache entries:', e);
    }
  }
  // Return all products (both cached and newly fetched, after stale refresh)
  return Object.fromEntries(variantIds.map(id => [id, productCache.get(id)]));
};

// 🔹 Bundle resolution helpers
export function resolveBundleItems(variant: any): Array<{ variantId: string; quantity: number }> {
  // Prefer variant-level override
  const vIsPack = !!variant?.isPartyPack
  const vItems = variant?.bundleItems
  if (vIsPack && vItems) {
    try {
      const arr = Array.isArray(vItems) ? vItems : JSON.parse(vItems)
      return arr
        .map((it: any) => ({ variantId: String(it.variantId), quantity: Math.max(1, parseInt(String(it.quantity || '1'), 10)) }))
        .filter((it: any) => it.variantId && it.variantId !== variant.variantId)
    } catch {}
  }
  // Fallback to product-level defaults
  const pIsPack = !!variant?.productIsPartyPackDefault
  const pItems = variant?.productBundleDefaultItems
  if (pIsPack && pItems) {
    try {
      const arr = Array.isArray(pItems) ? pItems : JSON.parse(pItems)
      return arr
        .map((it: any) => ({ variantId: String(it.variantId), quantity: Math.max(1, parseInt(String(it.quantity || '1'), 10)) }))
        .filter((it: any) => it.variantId && it.variantId !== variant.variantId)
    } catch {}
  }
  return []
}

export async function fetchProductsWithBundles(variantIds: string[]): Promise<{ products: Record<string, any>; neededChildren: string[] }> {
  const products = await fetchProducts(variantIds)
  const childIds = new Set<string>()
  Object.values(products).forEach((v: any) => {
    resolveBundleItems(v).forEach((it) => childIds.add(it.variantId))
  })
  const missing = Array.from(childIds).filter(id => !products[id])
  if (missing.length) {
    const more = await fetchProducts(missing)
    return { products: { ...products, ...more }, neededChildren: missing }
  }
  return { products, neededChildren: [] }
}

// 🔹 Clear in-memory + localStorage cache
export const clearProductCache = () => {
  productCache.clear();
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
    cacheTimeout = null;
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('productCache')
  }
};

// 🔹 Save cache to localStorage
function saveProductCache() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('productCache', JSON.stringify(Object.fromEntries(productCache)))
    } catch (error) {
      console.error('❌ Failed to save product cache:', error)
    }
  }
}
