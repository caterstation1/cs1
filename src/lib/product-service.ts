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
    // Return cached products if we have all variantIds
    return Object.fromEntries(
      variantIds.map(id => [id, productCache.get(id)])
    );
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
  // Return all products (both cached and newly fetched)
  return Object.fromEntries(
    variantIds.map(id => [id, productCache.get(id)])
  );
};

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
