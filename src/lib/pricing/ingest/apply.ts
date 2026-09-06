// Applies parsed email rows to the supplier catalogue.
//
// Matching is conservative: exact product code first, then normalized
// description equality, then a unique token-subset match flagged as fuzzy.
// Only structured full price lists (supplier CSV attachments) may create new
// catalogue rows — HTML tables and LLM extractions can update existing rows
// but never invent products.

import { prisma } from '../../prisma'
import { evaluateAlerts } from '../alerts'
import { recordCataloguePriceChanges } from '../persist'
import { recalcAll } from '../recalc'
import { ParsedPriceRow, SupplierId } from './parse'
import { masterCatalogueRow, PromotedIngredient, repairPlaceholderMaster, RepairedIngredient } from './promote'

export interface PriceChange {
  code: string
  description: string
  oldPrice: number
  newPrice: number
  pctChange: number
}

export interface ApplyReport {
  supplier: SupplierId
  rowsParsed: number
  rowsMatched: number
  rowsUnmatched: number
  /** Full-range price lists: rows for products Peter has never ordered. */
  rowsSkippedNotInCatalogue: number
  created: number
  priceChanges: PriceChange[]
  fuzzyMatches: Array<{ row: string; matchedTo: string }>
  /** Rows whose unit (Each vs Case) does not match the catalogue's — skipped. */
  uomMismatches: Array<{ sku: string; rowUom: string; catalogueUom: string; price: number }>
  unmatched: Array<{ sku: string | null; description: string; price: number }>
  /** Rows that were new to the catalogue and have been mastered as ingredients. */
  promoted: Array<PromotedIngredient & { sku: string; price: number }>
  /** Ingredients that were named after a product code until this email named them. */
  repaired: Array<RepairedIngredient & { sku: string }>
  pricePointsWritten: number
  recalc: { componentsUpdated: number; variantsUpdated: number; coveragePct: number } | null
  alerts: { opened: number; resolved: number } | null
}

interface CatalogueRow {
  id: string
  code: string
  description: string
  price: number
  /**
   * Only for rejecting an Each row against a Case row. Null for Bidfood, whose
   * invoice prices are already normalized to the catalogue's basis by the
   * parser — comparing units there would reject rows that are correct.
   */
  uom: string | null
  /** What is actually stored, for deciding whether a field is blank. */
  stored: { description: string | null; packSize: string | null; uom: string | null }
}

const SOURCE_NAME: Record<SupplierId, 'Gilmours' | 'Bidfood' | 'ProduceCo'> = {
  gilmours: 'Gilmours',
  bidfood: 'Bidfood',
  produceco: 'ProduceCo',
}

const normCode = (value: string | null | undefined): string => String(value ?? '').trim().toUpperCase()
const normDesc = (value: string | null | undefined): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function loadCatalogue(supplier: SupplierId): Promise<CatalogueRow[]> {
  if (supplier === 'gilmours') {
    const rows = await prisma.gilmoursProduct.findMany({
      select: { id: true, sku: true, description: true, price: true, uom: true, packSize: true },
    })
    return rows.map((r) => ({
      id: r.id,
      code: r.sku,
      description: r.description,
      price: r.price,
      uom: r.uom,
      stored: { description: r.description, packSize: r.packSize, uom: r.uom },
    }))
  }
  if (supplier === 'bidfood') {
    const rows = await prisma.bidfoodProduct.findMany({
      select: { id: true, productCode: true, description: true, lastPricePaid: true, uom: true, packSize: true },
    })
    return rows.map((r) => ({
      id: r.id,
      code: r.productCode,
      description: r.description,
      price: r.lastPricePaid,
      uom: null,
      stored: { description: r.description, packSize: r.packSize, uom: r.uom },
    }))
  }
  const rows = await prisma.produceCoProduct.findMany({
    select: { id: true, productCode: true, productName: true, price: true, uom: true, packSize: true },
  })
  return rows.map((r) => ({
    id: r.id,
    code: r.productCode,
    description: r.productName,
    price: r.price,
    uom: r.uom,
    stored: { description: r.productName, packSize: r.packSize, uom: r.uom },
  }))
}

/** Each/EA/Unit → 'each', Case/CTN/Carton → 'case', Kilo/KG → 'kg'; else the token itself. */
export function normalizeUom(value: string | null | undefined): string | null {
  const token = String(value ?? '').trim().toLowerCase()
  if (!token) return null
  if (/^(each|ea|unit|units)$/.test(token)) return 'each'
  if (/^(case|ctn|carton|cases)$/.test(token)) return 'case'
  if (/^(kg|kilo|kilogram|kilograms)$/.test(token)) return 'kg'
  return token
}

/** Fields an email can supply that a catalogue row may be missing. */
export interface LearnedFields {
  description?: string
  packSize?: string
  uom?: string
}

/**
 * A blank description or pack size is the difference between an ingredient
 * called 'Beetroot Red' costed at $5.20/kg and one called 'ProduceCo BEE'
 * costed at $5.20 each. Rows created before the parsers could read those fields
 * have them empty, so an email that does know them fills the gaps. Only blanks
 * are filled — a supplier email is not grounds to overwrite real data.
 */
function learnableFields(row: ParsedPriceRow, match: CatalogueRow): LearnedFields {
  const learn: LearnedFields = {}
  if (row.description?.trim() && !match.stored.description?.trim()) learn.description = row.description.trim()
  if (row.packSize?.trim() && !match.stored.packSize?.trim()) learn.packSize = row.packSize.trim()
  if (row.uom?.trim() && !match.stored.uom?.trim()) learn.uom = row.uom.trim()
  return learn
}

async function updateCatalogueRow(
  supplier: SupplierId,
  rowId: string,
  price: number,
  learn: LearnedFields
): Promise<void> {
  if (supplier === 'gilmours') {
    await prisma.gilmoursProduct.update({
      where: { id: rowId },
      data: {
        price,
        ...(learn.description ? { description: learn.description } : {}),
        ...(learn.packSize ? { packSize: learn.packSize } : {}),
        ...(learn.uom ? { uom: learn.uom } : {}),
      },
    })
  } else if (supplier === 'bidfood') {
    await prisma.bidfoodProduct.update({
      where: { id: rowId },
      data: {
        lastPricePaid: price,
        ...(learn.description ? { description: learn.description } : {}),
        ...(learn.packSize ? { packSize: learn.packSize } : {}),
        ...(learn.uom ? { uom: learn.uom } : {}),
      },
    })
  } else {
    await prisma.produceCoProduct.update({
      where: { id: rowId },
      data: {
        price,
        ...(learn.description ? { productName: learn.description } : {}),
        ...(learn.packSize ? { packSize: learn.packSize } : {}),
        ...(learn.uom ? { uom: learn.uom } : {}),
      },
    })
  }
}

/** Creates a catalogue row from a structured price-list row. Returns the new row id. */
async function createCatalogueRow(supplier: SupplierId, row: ParsedPriceRow): Promise<string> {
  if (supplier === 'gilmours') {
    const created = await prisma.gilmoursProduct.create({
      data: {
        sku: row.sku as string,
        brand: row.brand ?? '',
        description: row.description,
        packSize: row.packSize ?? '',
        uom: row.uom ?? '',
        price: row.price,
        quantity: row.quantity ?? 0,
      },
    })
    return created.id
  }
  if (supplier === 'bidfood') {
    const created = await prisma.bidfoodProduct.create({
      data: {
        productCode: row.sku as string,
        brand: row.brand ?? '',
        description: row.description,
        packSize: row.packSize ?? '',
        ctnQty: row.ctnQty ?? '',
        uom: row.uom ?? '',
        qty: row.quantity ?? 0,
        lastPricePaid: row.price,
        totalExGST: 0,
        contains: '',
      },
    })
    return created.id
  }
  const created = await prisma.produceCoProduct.create({
    data: {
      productCode: row.sku as string,
      productName: row.description,
      packSize: row.packSize ?? null,
      uom: row.uom ?? null,
      totalUnits: 0,
      totalSales: 0,
      price: row.price,
    },
  })
  return created.id
}

/** A token-subset match: every word of the shorter name appears in the longer one. */
function tokenMatch(a: string, b: string): boolean {
  const ta = a.split(' ').filter((t) => t.length > 2)
  const tb = new Set(b.split(' '))
  if (ta.length < 2) return false
  return ta.every((t) => tb.has(t))
}

export interface ApplyOptions {
  ingestionId: string
  /** True only for supplier-format CSV attachments — permits creating rows. */
  allowCreate: boolean
  /** Full-range price list: absent rows are expected, never counted as unmatched. */
  fullRange?: boolean
  /**
   * Give a coded row the catalogue row, Ingredient and supplier link it needs
   * to be costable, instead of only reporting it. Off for full-range lists,
   * whose absent rows are products nobody has bought.
   */
  promoteUnmatched?: boolean
}

export async function applyRows(
  supplier: SupplierId,
  rows: ParsedPriceRow[],
  options: ApplyOptions
): Promise<ApplyReport> {
  const catalogue = await loadCatalogue(supplier)
  const byCode = new Map<string, CatalogueRow>()
  const byDesc = new Map<string, CatalogueRow[]>()
  for (const entry of catalogue) {
    if (entry.code) byCode.set(normCode(entry.code), entry)
    const d = normDesc(entry.description)
    if (d) (byDesc.get(d) ?? byDesc.set(d, []).get(d))!.push(entry)
  }

  const report: ApplyReport = {
    supplier,
    rowsParsed: rows.length,
    rowsMatched: 0,
    rowsUnmatched: 0,
    rowsSkippedNotInCatalogue: 0,
    created: 0,
    priceChanges: [],
    fuzzyMatches: [],
    uomMismatches: [],
    unmatched: [],
    promoted: [],
    repaired: [],
    pricePointsWritten: 0,
    recalc: null,
    alerts: null,
  }

  const changedRows: Array<{ sourceId: string; packPrice: number }> = []

  for (const row of rows) {
    let match: CatalogueRow | undefined
    let fuzzy = false

    // A row carrying a supplier code matches by code or not at all — a code
    // miss means it is a different product, however similar the name looks.
    // (Lesson from a real full-range file: "Chips Sour Cream & Chive" must
    // not update the SOUR CREAM row.) Description matching is only for rows
    // without a code, e.g. LLM extractions from unstructured bodies.
    if (row.sku) {
      match = byCode.get(normCode(row.sku))
    } else if (row.description) {
      const exact = byDesc.get(normDesc(row.description))
      if (exact?.length === 1) match = exact[0]
      if (!match) {
        const rowDesc = normDesc(row.description)
        const candidates = catalogue.filter((c) => {
          const cd = normDesc(c.description)
          return cd && (tokenMatch(rowDesc, cd) || tokenMatch(cd, rowDesc))
        })
        if (candidates.length === 1) {
          match = candidates[0]
          fuzzy = true
        }
      }
    }

    if (match) {
      // Gilmours order emails list the same SKU per Each and per Case; only
      // the row in the catalogue's own unit may touch the price.
      const rowUom = normalizeUom(row.uom)
      const catUom = normalizeUom(match.uom)
      if (rowUom && catUom && rowUom !== catUom) {
        if (report.uomMismatches.length < 50) {
          report.uomMismatches.push({ sku: match.code, rowUom, catalogueUom: catUom, price: row.price })
        }
        continue
      }

      report.rowsMatched += 1
      if (fuzzy) {
        report.fuzzyMatches.push({ row: row.description || row.sku || '', matchedTo: match.description })
      }
      const learn = learnableFields(row, match)
      const learned = Object.keys(learn).length > 0
      const priceMoved = Math.abs(match.price - row.price) > 0.005

      if (priceMoved || learned) {
        await updateCatalogueRow(supplier, match.id, row.price, learn)
      }
      if (learned) {
        // A row that was mastered before its name and pack could be read left an
        // ingredient called 'Gilmours 1090586' priced per unreadable pack. Now
        // that the fields exist, give it back its name.
        const repaired = await repairPlaceholderMaster(SOURCE_NAME[supplier], match.id, row)
        if (repaired) report.repaired.push({ ...repaired, sku: match.code })
      }
      if (priceMoved && report.priceChanges.length < 200) {
        report.priceChanges.push({
          code: match.code,
          description: match.description,
          oldPrice: match.price,
          newPrice: row.price,
          pctChange: match.price > 0 ? (row.price - match.price) / match.price : 0,
        })
      }
      // Recorded either way: an unchanged price is still fresh evidence that it
      // was confirmed today, and persist dedupes identical latest points. A
      // newly learned pack also changes the unit cost this price implies.
      changedRows.push({ sourceId: match.id, packPrice: row.price })
      continue
    }

    if (options.allowCreate && row.sku) {
      const newId = await createCatalogueRow(supplier, row)
      report.created += 1
      changedRows.push({ sourceId: newId, packPrice: row.price })
      continue
    }

    if (options.fullRange) {
      report.rowsSkippedNotInCatalogue += 1
      continue
    }

    // A coded row that is new to the catalogue is something that was just
    // bought, which is the same signal the ingredient-master backfill treats as
    // "worth mastering". Give it a catalogue row, an Ingredient and a link so
    // the price has somewhere to live, rather than reporting it every invoice.
    if (options.promoteUnmatched && row.sku) {
      const newId = await createCatalogueRow(supplier, row)
      report.created += 1
      changedRows.push({ sourceId: newId, packPrice: row.price })
      const promoted = await masterCatalogueRow(SOURCE_NAME[supplier], newId, row)
      if (promoted) report.promoted.push({ ...promoted, sku: row.sku, price: row.price })
      continue
    }

    report.rowsUnmatched += 1
    if (report.unmatched.length < 50) {
      report.unmatched.push({ sku: row.sku, description: row.description, price: row.price })
    }
  }

  if (changedRows.length) {
    report.pricePointsWritten = await recordCataloguePriceChanges(
      SOURCE_NAME[supplier],
      changedRows,
      'email',
      options.ingestionId
    )
  }

  // Report the unit cost that was actually written for each promotion. Deriving
  // it again here would risk the email quoting a figure the costing engine
  // never used, which is worse than quoting nothing.
  for (const promoted of report.promoted) {
    const point = await prisma.pricePoint.findFirst({
      where: { linkId: promoted.linkId },
      orderBy: { effectiveAt: 'desc' },
      select: { unitCost: true },
    })
    promoted.unitCost = point?.unitCost ?? null
  }

  if (report.priceChanges.length || report.created || report.pricePointsWritten) {
    const recalc = await recalcAll('email-ingestion')
    report.recalc = {
      componentsUpdated: recalc.components.updated,
      variantsUpdated: recalc.variants.updated,
      coveragePct: recalc.coveragePct,
    }
    const alerts = await evaluateAlerts()
    report.alerts = { opened: alerts.opened, resolved: alerts.resolved }
  }

  return report
}
