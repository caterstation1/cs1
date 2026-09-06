// Pack-price arithmetic for operator price sheets.
//
// Safe to import from the browser: it only converts units. The Prisma-backed
// overlay lives in pricesheet.ts and must stay server-only.

import { CanonicalUnit, canonicalFor, convert } from './units'

export interface DerivedSheetCost {
  unitCost: number
  unit: CanonicalUnit
  /** Whole pack expressed in `unit` — shown back to the operator to confirm. */
  totalQuantity: number
}

/**
 * Pack price -> cost per canonical unit.
 *
 * Operators know a carton price, not a per-kilo price, so this is the only
 * arithmetic between what they type and what the engine costs with. It is
 * deliberately simpler than `deriveUnitPricing`: there is no pack string to
 * parse and no UOM ambiguity to weigh, because the operator has already told
 * us the structure in three explicit fields.
 */
export function deriveSheetUnitCost(input: {
  packPrice: number
  unitsPerPack: number
  sizePerUnit: number
  sizeUnit: string
}): DerivedSheetCost | null {
  const { packPrice, unitsPerPack, sizePerUnit, sizeUnit } = input
  if (!Number.isFinite(packPrice) || packPrice < 0) return null
  if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) return null
  if (!Number.isFinite(sizePerUnit) || sizePerUnit <= 0) return null

  const unit = canonicalFor(sizeUnit) ?? 'each'
  const canonicalSize = convert(sizePerUnit, sizeUnit, unit)
  if (canonicalSize == null || canonicalSize <= 0) return null

  const totalQuantity = unitsPerPack * canonicalSize
  if (!(totalQuantity > 0)) return null

  return { unitCost: packPrice / totalQuantity, unit, totalQuantity }
}
