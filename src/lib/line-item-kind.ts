/**
 * Classifies Shopify line items for the kitchen-facing lists: what counts as an
 * addon rather than a station the kitchen builds, and how serveware is read.
 */

export type LineItemLike = {
  sku?: string | null
  title?: string | null
  variant_title?: string | null
  variantTitle?: string | null
}

export type ProductLike = {
  shopifySku?: string | null
  shopifyTitle?: string | null
  serveware?: boolean | null
}

export function isAddonSku(sku?: string | null): boolean {
  const value = String(sku || '').trim().toUpperCase()
  return value.startsWith('ADD') || value.startsWith('AA')
}

/**
 * CaterCases are ready-made cases (CC01..CC15, titled "<Something> CaterCase"),
 * so they belong with the addons rather than the product lines.
 *
 * The SKU match needs a digit after CC: CCDDN/CCDDY are Christmas Dipper Donut
 * stations, and many station SKUs carry CC mid-string for a chicken/chicken
 * meat pairing (SK20CCN, GYR20-CCY). The title match covers the cases that have
 * no SKU at all.
 */
export function isCaterCase(line: LineItemLike, product?: ProductLike | null): boolean {
  if (/^CC\d/i.test(String(line.sku || '').trim())) return true
  if (/^CC\d/i.test(String(product?.shopifySku || '').trim())) return true
  return /catercase/i.test(String(line.title || product?.shopifyTitle || ''))
}

/** True for anything that should render in the addon row, not the product list. */
export function isAddonLine(line: LineItemLike, product?: ProductLike | null): boolean {
  if (isAddonSku(line.sku) || isAddonSku(product?.shopifySku)) return true
  return isCaterCase(line, product)
}

/**
 * Serveware is sold as its own Shopify line rather than as a variant option.
 * It is not something the kitchen makes, so it never earns a row of its own —
 * it only flips the SW marker on the order's products.
 */
export function isServewareLine(line: LineItemLike, product?: ProductLike | null): boolean {
  const title = String(line.title || product?.shopifyTitle || '').trim().toLowerCase()
  return title === 'serveware'
}

function hasYesServeware(line: LineItemLike): boolean {
  return /yes\s*serveware/i.test(String(line.variant_title ?? line.variantTitle ?? ''))
}

/**
 * True when a standalone serveware line was actually bought — the same product
 * also sells a "No Serveware" variant, which must not mark the order.
 */
export function isServewareSelected(line: LineItemLike, product?: ProductLike | null): boolean {
  if (!isServewareLine(line, product)) return false
  if (typeof product?.serveware === 'boolean') return product.serveware
  return hasYesServeware(line)
}

export function orderHasStandaloneServeware(
  lines: LineItemLike[],
  productFor: (line: LineItemLike) => ProductLike | null | undefined
): boolean {
  return lines.some((line) => isServewareSelected(line, productFor(line)))
}

/** The SW marker on a product row: its own variant, or an order-level purchase. */
export function showsServewareMarker(
  product: ProductLike | null | undefined,
  line: LineItemLike,
  orderHasServeware: boolean
): boolean {
  return !!product?.serveware || hasYesServeware(line) || orderHasServeware
}
