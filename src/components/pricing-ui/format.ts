// Display formatting shared by the pricing surfaces.
//
// Null is "unknown", never $0.00 or 0%: the engine returns null when it cannot
// price something, and flattening that to a zero is how a missing ingredient
// silently improves a margin.

export const money = (v: number | null | undefined) => (v == null ? '—' : `$${v.toFixed(2)}`)

export const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
