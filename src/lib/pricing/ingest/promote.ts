// Turning an unmatched supplier line into something costable.
//
// An unmatched row is a product that was just bought and the catalogue has
// never seen. Reporting it and stopping means the next invoice reports it
// again and the price never lands anywhere. Promotion closes that loop: a
// catalogue row, an Ingredient, a supplier link with the pack read off the
// row, and a first price point — the same four things the ingredient-master
// backfill creates, done one row at a time.
//
// Only rows carrying the supplier's own product code are promoted. A code is
// the supplier asserting this is a real line; a description-only row is a
// guess from an HTML table or the LLM, and inventing catalogue rows out of
// guesses is what the `allowCreate` guard exists to prevent.
//
// The pack reading drives every per-kg figure downstream, so no promotion is
// ever treated as verified: `packVerified` stays false and every one is listed
// in the summary email for a human to confirm.
//
// The first price point is deliberately not written here. `applyRows` already
// routes every touched row through `recordCataloguePriceChanges`, which is the
// single writer for email-sourced history and owns the dedupe rule; a second
// writer here would be a second answer to "what is this worth per kg".

import { prisma } from '../../prisma'
import { parsePackStructure } from '../packsize'
import { ParsedPriceRow } from './parse'

export type CatalogueSourceName = 'Gilmours' | 'Bidfood' | 'ProduceCo'

export interface PromotedIngredient {
  ingredientId: string
  linkId: string
  name: string
  /** True when the row had no description and the code had to stand in. */
  namePlaceholder: boolean
  /** How the pack was read, e.g. '15 x 1kg'. */
  packReading: string
  packConfidence: number
  /**
   * Filled in by `applyRows` from the price point that was actually written, so
   * the email reports the figure now in use rather than a second guess at it.
   * Null when the pack could not be read well enough to price the row.
   */
  unitCost: number | null
  canonicalUnit: string
}

export interface RepairedIngredient {
  ingredientId: string
  previousName: string
  name: string
  packReading: string
  packConfidence: number
}

function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** The name masterCatalogueRow falls back to when the row had no description. */
function isPlaceholderName(name: string, source: CatalogueSourceName, code: string): boolean {
  return new RegExp(`^${source}\\s+${code}\\b`, 'i').test(name.trim())
}

/**
 * An ingredient mastered from a row whose description and pack could not be read
 * is named after its product code and priced against a pack of '1 each'. Once an
 * email supplies the real fields, the placeholder is replaced and the pack
 * re-read. Anything Peter has already renamed or verified by hand is left alone.
 */
export async function repairPlaceholderMaster(
  source: CatalogueSourceName,
  sourceId: string,
  row: ParsedPriceRow
): Promise<RepairedIngredient | null> {
  const code = String(row.sku ?? '').trim()
  const described = titleCase(row.description ?? '')
  if (!code || !described) return null

  const link = await prisma.ingredientSupplierLink.findFirst({
    where: { source, sourceId, active: true },
    select: { id: true, ingredientId: true, packVerified: true, ingredient: { select: { name: true } } },
  })
  if (!link || link.packVerified) return null

  const previousName = link.ingredient.name
  if (!isPlaceholderName(previousName, source, code)) return null

  const structure = parsePackStructure(row.packSize, row.uom, row.ctnQty)

  // The real name may already be taken by another supplier's version of the
  // same thing, in which case the code stays on as a disambiguator.
  let name = described
  const clash = await prisma.ingredient.findUnique({ where: { name }, select: { id: true } })
  if (clash && clash.id !== link.ingredientId) name = `${described} (${source} ${code})`

  await prisma.$transaction(async (tx) => {
    await tx.ingredient.update({
      where: { id: link.ingredientId },
      data: { name, canonicalUnit: structure.canonicalUnit },
    })
    await tx.ingredientSupplierLink.update({
      where: { id: link.id },
      data: {
        unitsPerPack: structure.unitsPerPack,
        sizePerUnit: structure.sizePerUnit,
        sizeUnit: structure.sizeUnit,
        packConfidence: structure.confidence,
      },
    })
  })

  return {
    ingredientId: link.ingredientId,
    previousName,
    name,
    packReading: `${structure.unitsPerPack} x ${structure.sizePerUnit}${structure.sizeUnit}`,
    packConfidence: structure.confidence,
  }
}

/**
 * Creates the Ingredient and supplier link for a catalogue row that has just
 * been created. Returns null when the row is already mastered, so a repeated
 * invoice cannot produce a second ingredient for the same product.
 */
export async function masterCatalogueRow(
  source: CatalogueSourceName,
  sourceId: string,
  row: ParsedPriceRow
): Promise<PromotedIngredient | null> {
  const existing = await prisma.ingredientSupplierLink.findFirst({
    where: { source, sourceId },
    select: { id: true },
  })
  if (existing) return null

  const structure = parsePackStructure(row.packSize, row.uom, row.ctnQty)
  const code = String(row.sku ?? '').trim()
  const described = titleCase(row.description ?? '')
  const namePlaceholder = !described
  const base = described || `${source} ${code}`.trim()

  // Ingredient.name is unique. A collision is not a merge signal — two
  // suppliers really do sell the same thing under the same words — so the
  // supplier and code disambiguate rather than the rows being joined.
  let name = base
  if (await prisma.ingredient.findUnique({ where: { name }, select: { id: true } })) {
    name = `${base} (${source} ${code})`.trim()
    let attempt = 2
    while (await prisma.ingredient.findUnique({ where: { name }, select: { id: true } })) {
      name = `${base} (${source} ${code} #${attempt++})`.trim()
    }
  }

  const canonicalUnit = structure.canonicalUnit

  const created = await prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.create({
      data: { name, canonicalUnit, notes: `Created from a supplier price email (${source} ${code}).` },
    })
    const link = await tx.ingredientSupplierLink.create({
      data: {
        ingredientId: ingredient.id,
        source,
        sourceId,
        rank: 1,
        unitsPerPack: structure.unitsPerPack,
        sizePerUnit: structure.sizePerUnit,
        sizeUnit: structure.sizeUnit,
        packVerified: false,
        packConfidence: structure.confidence,
        active: true,
      },
    })
    return { ingredientId: ingredient.id, linkId: link.id }
  })

  return {
    ...created,
    name,
    namePlaceholder,
    packReading: `${structure.unitsPerPack} x ${structure.sizePerUnit}${structure.sizeUnit}`,
    packConfidence: structure.confidence,
    unitCost: null,
    canonicalUnit,
  }
}
