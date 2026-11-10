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

/** An explicit placement chosen by staff, overriding the SKU-derived one. */
export type LineKind = 'addon' | 'product'

export type ProductLike = {
  shopifySku?: string | null
  shopifyTitle?: string | null
  serveware?: boolean | null
  lineKind?: string | null
}

export function normalizeLineKind(value: unknown): LineKind | null {
  const kind = String(value ?? '').trim().toLowerCase()
  return kind === 'addon' || kind === 'product' ? kind : null
}

/**
 * Applies the placement override on top of a caller's own SKU rule.
 *
 * The runsheet, labels and the stock/BnB summaries each derive addons from the
 * ADD/AA prefix alone and deliberately do not share the order card's CaterCase
 * handling. This lets them honour an explicit `lineKind` without inheriting the
 * rest of `isAddonLine`.
 */
export function resolveAddonPlacement(
  skuDerived: boolean,
  product?: ProductLike | null
): boolean {
  const forced = normalizeLineKind(product?.lineKind)
  return forced ? forced === 'addon' : skuDerived
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

/**
 * True for anything that should render in the addon row, not the product list.
 *
 * A `lineKind` set on the variant (or as an order-only override) wins outright:
 * SKUs carry the station/addon split by convention only, and some products need
 * to sit on the other side of the card without their SKU being renamed.
 */
export function isAddonLine(line: LineItemLike, product?: ProductLike | null): boolean {
  const forced = normalizeLineKind(product?.lineKind)
  if (forced) return forced === 'addon'
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
