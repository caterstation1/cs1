/**
 * Per-order-line overrides for product operational fields (stored on Order.lineItems JSON).
 * Does not change ProductVariant in the catalog.
 */
export type OrderProductOverrides = {
  displayName?: string
  meat1?: string
  meat2?: string
  timer1?: number | null
  timer2?: number | null
  option1?: string
  option2?: string
  serveware?: boolean
}

export type LineItemWithOverrides = {
  variant_id?: string | number
  variantId?: string | number
  orderProductOverrides?: OrderProductOverrides
  childOrderOverrides?: Record<string, OrderProductOverrides>
  [key: string]: unknown
}

/** Merge catalog product with optional order-only overrides for display / modal. */
export function applyOverridesToProduct(
  base: Record<string, unknown> | null | undefined,
  ov: OrderProductOverrides | undefined | null
): Record<string, unknown> | null {
  if (!base) return null
  if (!ov || Object.keys(ov).length === 0) {
    return { ...base }
  }
  const merged: Record<string, unknown> = { ...base }
  if (ov.displayName !== undefined) merged.displayName = ov.displayName
  if (ov.meat1 !== undefined) merged.meat1 = ov.meat1
  if (ov.meat2 !== undefined) merged.meat2 = ov.meat2
  if (ov.timer1 !== undefined) merged.timer1 = ov.timer1
  if (ov.timer2 !== undefined) merged.timer2 = ov.timer2
  if (ov.option1 !== undefined) merged.option1 = ov.option1
  if (ov.option2 !== undefined) merged.option2 = ov.option2
  if (ov.serveware !== undefined) merged.serveware = ov.serveware

  if (ov.meat1 !== undefined || ov.meat2 !== undefined) {
    merged.meats = [merged.meat1 ?? null, merged.meat2 ?? null]
  }
  if (ov.timer1 !== undefined || ov.timer2 !== undefined) {
    merged.timers = [merged.timer1 ?? null, merged.timer2 ?? null]
  }
  if (ov.option1 !== undefined || ov.option2 !== undefined) {
    const o1 = (merged.option1 as string) ?? ''
    const o2 = (merged.option2 as string) ?? ''
    merged.options = [o1, o2].filter((x) => String(x).trim() !== '')
  }
  return merged
}

export function getOverridesForDisplayRow(
  item: {
    variant_id?: string | number
    variantId?: string | number
    _lineIndex?: number
    _isPackChild?: boolean
    _childVariantId?: string
  },
  sourceLineItem: LineItemWithOverrides | undefined
): OrderProductOverrides | undefined {
  if (!sourceLineItem) return undefined
  if (item._isPackChild && item._childVariantId) {
    return sourceLineItem.childOrderOverrides?.[item._childVariantId]
  }
  if (!item._isPackChild) {
    return sourceLineItem.orderProductOverrides
  }
  return undefined
}

export function getEffectiveLineProduct(
  item: {
    variant_id?: string | number
    variantId?: string | number
    _lineIndex?: number
    _isPackChild?: boolean
    _childVariantId?: string
  },
  products: Record<string, Record<string, unknown>>,
  sourceLineItem: LineItemWithOverrides | undefined
): Record<string, unknown> | null {
  const variantId = item.variant_id?.toString() || item.variantId?.toString()
  if (!variantId) return null
  const base = products[variantId]
  if (!base) return null
  const ov = getOverridesForDisplayRow(item, sourceLineItem)
  return applyOverridesToProduct(base, ov)
}

/** Strip override blobs when saving catalog variant so ops fields come from DB. */
export function clearLineScopeOverrides(
  line: LineItemWithOverrides,
  childVariantId: string | null
): LineItemWithOverrides {
  const next = { ...line } as LineItemWithOverrides
  if (childVariantId) {
    if (!next.childOrderOverrides) return next
    const { [childVariantId]: _, ...rest } = next.childOrderOverrides
    next.childOrderOverrides = Object.keys(rest).length ? rest : undefined
  } else {
    delete next.orderProductOverrides
  }
  return next
}
