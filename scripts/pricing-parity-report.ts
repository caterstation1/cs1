// Old-vs-new cost comparison for every component and variant. Read-only.
//
// This is the gate on the pricing engine: it shows exactly what would change
// if server-derived costs were switched on, and why, before a single write
// happens. Nothing here mutates the database.
//
// Usage:
//   npx tsx scripts/pricing-parity-report.ts
//   npx tsx scripts/pricing-parity-report.ts --limit=100
//   npx tsx scripts/pricing-parity-report.ts --all --min-diff=0.50
//   npx tsx scripts/pricing-parity-report.ts --zero-is-free
//   npx tsx scripts/pricing-parity-report.ts --json > parity.json

import { prisma } from '../src/lib/prisma'
import {
  CostResult,
  CostedLine,
  costComponent,
  costVariant,
  marginFor,
  topoSortComponents,
} from '../src/lib/pricing/cost'
import { CostIndex, buildCostIndex } from '../src/lib/pricing/resolve'

const EPSILON = 0.005

interface Options {
  limit: number
  minDiff: number
  json: boolean
  zeroIsFree: boolean
  only: 'all' | 'components' | 'variants'
  /** Print the line-by-line workings for items whose name contains this. */
  explain: string | null
  /** Print how a catalogue row's pack size was read. */
  catalogue: string | null
}

function parseOptions(argv: string[]): Options {
  const flag = (name: string) => argv.includes(`--${name}`)
  const value = (name: string): string | null => {
    const prefix = `--${name}=`
    const found = argv.find((a) => a.startsWith(prefix))
    return found ? found.slice(prefix.length) : null
  }
  const onlyRaw = value('only')
  return {
    limit: flag('all') ? Number.POSITIVE_INFINITY : Number(value('limit') ?? 40),
    minDiff: Number(value('min-diff') ?? EPSILON),
    json: flag('json'),
    zeroIsFree: flag('zero-is-free'),
    only: onlyRaw === 'components' || onlyRaw === 'variants' ? onlyRaw : 'all',
    explain: value('explain'),
    catalogue: value('catalogue'),
  }
}

interface ParityRow {
  type: 'component' | 'variant'
  id: string
  name: string
  storedTotal: number
  newTotal: number | null
  partialTotal: number
  snapshotTotal: number
  diff: number | null
  diffPct: number | null
  storedPerUnit: number | null
  newPerUnit: number | null
  storedUnit: string | null
  newUnit: string
  coverage: number
  resolvedLines: number
  totalLines: number
  marginBefore: number | null
  marginAfter: number | null
  reasons: string[]
}

const REASON_TEXT: Record<string, string> = {
  'missing-ref': 'broken reference — catalogue row no longer exists',
  'unresolvable-price': 'catalogue row has no usable price',
  'unknown-source': 'unrecognised ingredient source',
  'unknown-unit': 'unrecognised unit on the recipe row',
  'unit-kind-mismatch': 'unit mismatch — counting a weight/volume-priced item',
  cycle: 'component reference cycle',
  'child-cost-unknown': 'nested component cost unknown',
  'no-output-quantity': 'producedQuantity is not positive',
}

function unresolvedReasons(result: CostResult): string[] {
  const reasons = new Set<string>()
  for (const ref of result.missing) {
    if (ref.reason === 'unresolvable-price' && ref.detail?.includes('zero-price')) {
      reasons.add('catalogue price is $0 (unknown, not free)')
    } else {
      reasons.add(REASON_TEXT[ref.reason] ?? ref.reason)
    }
  }
  return [...reasons]
}

// Why a resolvable cost differs from what is stored today. Each tag points at a
// specific defect in the current chain rather than just saying "recomputed".
function diffReasons(result: CostResult, storedTotal: number): string[] {
  const reasons = new Set<string>()

  if (result.emptyRecipe) {
    reasons.add(storedTotal > 0 ? 'no ingredient rows (stored cost has no recipe behind it)' : 'no ingredient rows')
    return [...reasons]
  }

  for (const line of result.lines) {
    if (line.unitCost == null) continue
    // Authored costs are rounded when they are typed in, so only a difference
    // big enough to matter counts as a price change.
    const snapshotDrift =
      Math.abs(line.unitCost - line.snapshotUnitCost) > Math.max(0.005, Math.abs(line.snapshotUnitCost) * 0.001)

    if (line.source.toLowerCase().startsWith('produce') && (line.snapshotUnitCost === 0 || snapshotDrift)) {
      reasons.add('ProduceCo now costed (was invisible to the old recalc)')
      continue
    }
    if (line.provenance === 'component' && snapshotDrift) {
      reasons.add('stale nested component price')
      continue
    }
    if (line.provenance === 'variant' && snapshotDrift) {
      reasons.add('stale nested variant price')
      continue
    }
    if (snapshotDrift) {
      reasons.add(
        line.snapshotUnitCost === 0
          ? 'line had no cost stored (was counted as $0)'
          : `supplier price or pack size changed (${line.supplier ?? line.source})`
      )
    }
    if (line.resolvedQuantity != null && Math.abs(line.resolvedQuantity - line.quantity) > 1e-9) {
      reasons.add('unit conversion applied (e.g. grams costed against a per-kg price)')
    }
  }

  if (!reasons.size) {
    // The line-level maths agrees with the stored rows, so the stored total
    // itself was never brought up to date.
    reasons.add(
      Math.abs(result.snapshotTotal - (result.total ?? 0)) <= EPSILON
        ? 'stored total was never recalculated from its own rows'
        : 'recomputed'
    )
  }
  return [...reasons]
}

function buildRow(
  type: 'component' | 'variant',
  result: CostResult,
  storedTotal: number,
  storedPerUnit: number | null,
  storedUnit: string | null,
  shopifyPriceInclGst: number | null,
  targetMargin: number,
  gstRate: number
): ParityRow {
  const diff = result.total == null ? null : result.total - storedTotal
  const reasons =
    result.total == null
      ? unresolvedReasons(result)
      : Math.abs(diff as number) <= EPSILON
        ? ['match']
        : diffReasons(result, storedTotal)

  return {
    type,
    id: result.ownerId,
    name: result.ownerName,
    storedTotal,
    newTotal: result.total,
    partialTotal: result.partialTotal,
    snapshotTotal: result.snapshotTotal,
    diff,
    diffPct: diff == null || storedTotal === 0 ? null : (diff / storedTotal) * 100,
    storedPerUnit,
    newPerUnit: result.perUnit,
    storedUnit,
    newUnit: result.unit,
    coverage: result.coverage.pct,
    resolvedLines: result.coverage.resolvedLines,
    totalLines: result.coverage.totalLines,
    marginBefore:
      shopifyPriceInclGst == null ? null : marginFor(storedTotal, shopifyPriceInclGst, gstRate, targetMargin).margin,
    marginAfter:
      shopifyPriceInclGst == null ? null : marginFor(result.total, shopifyPriceInclGst, gstRate, targetMargin).margin,
    reasons,
  }
}

const money = (value: number | null | undefined, dp = 2) =>
  value == null ? '—' : value.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp })

const pct = (value: number | null | undefined, dp = 1) =>
  value == null ? '—' : `${(value * 100).toFixed(dp)}%`

const signed = (value: number | null | undefined, dp = 2) =>
  value == null ? '—' : `${value >= 0 ? '+' : ''}${money(value, dp)}`

function truncate(value: string, width: number) {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}

function table(headers: string[], rows: string[][], align: Array<'l' | 'r'>) {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] ?? '').length))
  )
  const pad = (text: string, i: number) =>
    align[i] === 'r' ? text.padStart(widths[i]) : text.padEnd(widths[i])
  const lines = [
    headers.map((header, i) => pad(header, i)).join('  '),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map((row) => row.map((cell, i) => pad(cell ?? '', i)).join('  ')),
  ]
  return lines.join('\n')
}

function section(title: string) {
  console.log(`\n${title}`)
  console.log('='.repeat(title.length))
}

interface LineGap {
  reason: string
  source: string
  unit: string | null
  item: string
  detail: string | null
}

interface AssumptionTally {
  declared: number
  missingAssumed: number
  unrecognisedCounted: number
  /** Missing-unit rows whose price is per kg or per litre, where the
   *  assumption is doing real work rather than restating a count. */
  missingAssumedAgainstMeasure: number
  failed: number
  /** Rows with no unit at all, whether or not they went on to cost. */
  blankUnitRows: number
}

function collectGaps(
  result: CostResult,
  into: LineGap[],
  lowConfidence: Map<string, CostedLine>,
  assumptions: AssumptionTally
) {
  for (const line of result.lines) {
    if (!line.unit) assumptions.blankUnitRows += 1
    if (line.unitAssumption === 'declared') assumptions.declared += 1
    else if (line.unitAssumption === 'missing-assumed') {
      assumptions.missingAssumed += 1
      if (line.unitCostUnit === 'kg' || line.unitCostUnit === 'l') assumptions.missingAssumedAgainstMeasure += 1
    } else if (line.unitAssumption === 'unrecognised-counted') assumptions.unrecognisedCounted += 1
    else assumptions.failed += 1

    if (line.confidence != null && line.confidence < 0.6 && line.lineCost != null) {
      lowConfidence.set(`${line.source}:${line.id}`, line)
    }
    if (!line.reason) continue
    into.push({
      reason: line.reason,
      source: line.source || '(blank)',
      unit: line.unit,
      item: line.name || line.id,
      detail: line.note ?? null,
    })
  }
}

function tally<T>(items: T[], key: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function countReasons(rows: ParityRow[]): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const reason of row.reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function printRows(title: string, rows: ParityRow[], limit: number, showMargin: boolean) {
  if (!rows.length) return
  section(`${title} (${rows.length})`)
  const shown = rows.slice(0, Number.isFinite(limit) ? limit : rows.length)
  const headers = ['Name', 'Stored', 'Engine', 'Diff', 'Diff %', 'Per unit', ...(showMargin ? ['Margin'] : []), 'Cover', 'Reason']
  const align: Array<'l' | 'r'> = ['l', 'r', 'r', 'r', 'r', 'r', ...(showMargin ? ['r' as const] : []), 'r', 'l']
  const body = shown.map((row) => [
    truncate(row.name, 42),
    money(row.storedTotal),
    money(row.newTotal),
    signed(row.diff),
    row.diffPct == null ? '—' : `${row.diffPct >= 0 ? '+' : ''}${row.diffPct.toFixed(1)}%`,
    row.newPerUnit == null ? '—' : `${money(row.newPerUnit, 4)}/${row.newUnit}`,
    ...(showMargin ? [`${pct(row.marginBefore, 0)} → ${pct(row.marginAfter, 0)}`] : []),
    `${row.resolvedLines}/${row.totalLines}`,
    truncate(row.reasons.join('; '), 68),
  ])
  console.log(table(headers, body, align))
  if (shown.length < rows.length) {
    console.log(`… ${rows.length - shown.length} more (use --limit=N or --all)`)
  }
}

// producedQuantity is the final usable output, so cooking loss is already out
// of it and nothing here adjusts for yield. The weight fields are kitchen
// reference data; this just reports how many components carry them, so their
// coverage stays visible without implying they feed the cost.
function printWeightCoverage(index: CostIndex) {
  let rawWeight = 0
  let cookedWeight = 0
  let trimWasteWeight = 0
  let weightUnit = 0
  let bothRawAndCooked = 0

  for (const component of index.components.values()) {
    if (component.rawWeight != null) rawWeight += 1
    if (component.cookedWeight != null) cookedWeight += 1
    if (component.trimWasteWeight != null) trimWasteWeight += 1
    if (component.weightUnit) weightUnit += 1
    if (component.rawWeight != null && component.cookedWeight != null) bothRawAndCooked += 1
  }

  section('Component weights (reference only, not costed)')
  console.log(
    `producedQuantity is the final usable output, so cooking loss is already inside it. These fields are\nrecorded for the kitchen and never enter the cost.\n`
  )
  console.log(
    table(
      ['Field', `Set (of ${index.components.size})`],
      [
        ['rawWeight', String(rawWeight)],
        ['cookedWeight', String(cookedWeight)],
        ['trimWasteWeight', String(trimWasteWeight)],
        ['weightUnit', String(weightUnit)],
        ['both raw and cooked', String(bothRawAndCooked)],
      ],
      ['l', 'r']
    )
  )
}

function explain(result: CostResult, storedTotal: number) {
  section(`${result.ownerType}: ${result.ownerName}`)
  console.log(`Stored total: ${money(storedTotal)}    Engine total: ${money(result.total)}`)
  console.log(
    `Output: ${result.outputQuantity == null ? '—' : result.outputQuantity} ${result.unit}    Per unit: ${money(result.perUnit, 4)}`
  )
  console.log(
    table(
      ['Source', 'Ingredient', 'Qty', 'Unit', 'Costed qty', 'Unit cost', 'Line', 'Was', 'Conf', 'Note'],
      result.lines.map((line) => [
        line.source,
        truncate(line.name, 34),
        String(line.quantity),
        line.unit ?? '—',
        line.resolvedQuantity == null ? '—' : `${money(line.resolvedQuantity, 4)} ${line.unitCostUnit ?? ''}`,
        line.unitCost == null ? '—' : `${money(line.unitCost, 4)}/${line.unitCostUnit}`,
        money(line.lineCost),
        money(line.snapshotLineCost),
        line.confidence == null ? '—' : line.confidence.toFixed(2),
        truncate(line.reason ? `${line.reason}: ${line.note ?? ''}` : line.note ?? '', 52),
      ]),
      ['l', 'l', 'r', 'l', 'r', 'r', 'r', 'r', 'r', 'l']
    )
  )
}

async function run() {
  const options = parseOptions(process.argv.slice(2))

  const index = await buildCostIndex({ treatZeroPriceAsFree: options.zeroIsFree })
  const cache = new Map<string, CostResult>()
  const costOpts = { cache }
  const { targetMargin, gstRate } = index.settings

  const componentRows: ParityRow[] = []
  const variantRows: ParityRow[] = []
  const gaps: LineGap[] = []
  const lowConfidence = new Map<string, CostedLine>()
  const assumptions: AssumptionTally = {
    declared: 0,
    missingAssumed: 0,
    unrecognisedCounted: 0,
    missingAssumedAgainstMeasure: 0,
    failed: 0,
    blankUnitRows: 0,
  }

  const { order, cyclic } = topoSortComponents(index)
  if (options.only !== 'variants') {
    for (const componentId of order) {
      const component = index.components.get(componentId)
      if (!component) continue
      const result = costComponent(componentId, index, costOpts)
      collectGaps(result, gaps, lowConfidence, assumptions)
      componentRows.push(
        buildRow(
          'component',
          result,
          component.storedTotalCost,
          component.storedCostPerOutputUnit,
          component.storedNormalizedOutputUnit,
          null,
          targetMargin,
          gstRate
        )
      )
    }
  }

  if (options.only !== 'components') {
    for (const variant of index.variantsByVariantId.values()) {
      const result = costVariant(variant.variantId, index, costOpts)
      collectGaps(result, gaps, lowConfidence, assumptions)
      variantRows.push(
        buildRow(
          'variant',
          result,
          variant.storedTotalCost,
          variant.storedTotalCost,
          'unit',
          variant.shopifyPriceInclGst,
          targetMargin,
          gstRate
        )
      )
    }
  }

  if (options.catalogue) {
    const needle = options.catalogue.toLowerCase()
    const seen = new Set<string>()
    const rows: string[][] = []
    for (const entry of index.catalogue.values()) {
      const identity = `${entry.source}:${entry.id}`
      if (seen.has(identity)) continue
      if (!entry.name.toLowerCase().includes(needle) && !(entry.code ?? '').toLowerCase().includes(needle)) continue
      seen.add(identity)
      rows.push([
        entry.source,
        entry.code ?? '—',
        truncate(entry.name, 36),
        entry.packSize ?? '—',
        entry.uom ?? '—',
        entry.ctnQty ?? '—',
        money(entry.price),
        entry.structure ? `${entry.structure.unitsPerPack} x ${entry.structure.sizePerUnit}${entry.structure.sizeUnit}` : '—',
        entry.structure ? money(entry.structure.totalCanonicalQty, 3) : '—',
        entry.cost ? `${money(entry.cost.unitCost, 4)}/${entry.cost.unit}` : `— (${entry.reason})`,
        entry.structure ? entry.structure.confidence.toFixed(2) : '—',
      ])
    }
    section(`Catalogue rows matching "${options.catalogue}" (${rows.length})`)
    if (!rows.length) console.log('No matches.')
    else
      console.log(
        table(
          ['Source', 'Code', 'Name', 'Pack size', 'UOM', 'CtnQty', 'Price', 'Read as', 'Total', 'Unit cost', 'Conf'],
          rows.slice(0, Number.isFinite(options.limit) ? options.limit : undefined),
          ['l', 'l', 'l', 'l', 'l', 'r', 'r', 'l', 'r', 'r', 'r']
        )
      )
    return
  }

  if (options.explain) {
    const needle = options.explain.toLowerCase()
    let matches = 0
    for (const component of index.components.values()) {
      if (!component.name.toLowerCase().includes(needle)) continue
      explain(costComponent(component.id, index, costOpts), component.storedTotalCost)
      matches += 1
    }
    for (const variant of index.variantsByVariantId.values()) {
      if (!variant.name.toLowerCase().includes(needle)) continue
      if (matches >= (Number.isFinite(options.limit) ? options.limit : Number.POSITIVE_INFINITY)) break
      explain(costVariant(variant.variantId, index, costOpts), variant.storedTotalCost)
      matches += 1
    }
    if (!matches) console.log(`No component or variant name contains "${options.explain}".`)
    return
  }

  const allRows = [...componentRows, ...variantRows]
  const resolved = allRows.filter((r) => r.newTotal != null)
  const unresolved = allRows.filter((r) => r.newTotal == null)
  const matched = resolved.filter((r) => Math.abs(r.diff as number) <= EPSILON)
  const changed = resolved
    .filter((r) => Math.abs(r.diff as number) > Math.max(options.minDiff, EPSILON))
    .sort((a, b) => Math.abs(b.diff as number) - Math.abs(a.diff as number))

  const totalLines = allRows.reduce((sum, r) => sum + r.totalLines, 0)
  const resolvedLines = allRows.reduce((sum, r) => sum + r.resolvedLines, 0)

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          settings: { ...index.settings, treatZeroPriceAsFree: options.zeroIsFree },
          summary: {
            components: componentRows.length,
            variants: variantRows.length,
            resolved: resolved.length,
            unresolved: unresolved.length,
            matched: matched.length,
            changed: changed.length,
            lineCoveragePct: totalLines ? resolvedLines / totalLines : 1,
            cyclicComponentIds: cyclic,
          },
          rows: allRows,
        },
        null,
        2
      )
    )
    return
  }

  section('Pricing parity report')
  console.log(`Generated:        ${new Date().toISOString()}`)
  console.log(`Mode:             read-only, no writes`)
  console.log(`Zero price means: ${options.zeroIsFree ? 'free' : 'unknown'}`)
  console.log(
    `Catalogue:        ${index.catalogue.size} indexed keys across Gilmours, Bidfood, ProduceCo, Other`
  )

  section('Coverage')
  console.log(
    table(
      ['', 'Total', 'Costed', 'Unknown', 'Match', 'Changed'],
      [
        [
          'Components',
          String(componentRows.length),
          String(componentRows.filter((r) => r.newTotal != null).length),
          String(componentRows.filter((r) => r.newTotal == null).length),
          String(componentRows.filter((r) => r.newTotal != null && Math.abs(r.diff as number) <= EPSILON).length),
          String(componentRows.filter((r) => r.newTotal != null && Math.abs(r.diff as number) > EPSILON).length),
        ],
        [
          'Variants',
          String(variantRows.length),
          String(variantRows.filter((r) => r.newTotal != null).length),
          String(variantRows.filter((r) => r.newTotal == null).length),
          String(variantRows.filter((r) => r.newTotal != null && Math.abs(r.diff as number) <= EPSILON).length),
          String(variantRows.filter((r) => r.newTotal != null && Math.abs(r.diff as number) > EPSILON).length),
        ],
      ],
      ['l', 'r', 'r', 'r', 'r', 'r']
    )
  )
  console.log(
    `\nRecipe line coverage: ${resolvedLines}/${totalLines} (${totalLines ? ((resolvedLines / totalLines) * 100).toFixed(1) : '100.0'}%)`
  )
  console.log('\nHow each costed line got its unit:')
  console.log(
    table(
      ['Basis', 'Lines', 'Meaning'],
      [
        [
          'declared',
          String(assumptions.declared),
          'row states a unit the engine converted against the price',
        ],
        [
          'assumed (no unit on row)',
          String(assumptions.missingAssumed),
          'row has no unit; quantity taken as already in the price unit',
        ],
        [
          '  ...of which per kg/l',
          String(assumptions.missingAssumedAgainstMeasure),
          'assumption is load-bearing — a wrong guess is a silent multiple',
        ],
        [
          'counted (unrecognised unit)',
          String(assumptions.unrecognisedCounted),
          "unit not recognised, but price is per each, so counted as pieces",
        ],
        ['not costed', String(assumptions.failed), 'line failed before its unit was reconciled'],
      ],
      ['l', 'r', 'l']
    )
  )
  console.log(
    `Recipe rows carrying no unit at all, costed or not: ${assumptions.blankUnitRows} of ${totalLines}.`
  )
  if (cyclic.length) console.log(`Components in a reference cycle: ${cyclic.length}`)

  printWeightCoverage(index)

  const variantsChanged = variantRows.filter((r) => r.newTotal != null && Math.abs(r.diff as number) > EPSILON)
  const netVariantDiff = variantsChanged.reduce((sum, r) => sum + (r.diff as number), 0)
  if (variantsChanged.length) {
    console.log(
      `Net change in variant cost across ${variantsChanged.length} variants: ${signed(netVariantDiff)} (average ${signed(netVariantDiff / variantsChanged.length)})`
    )
  }

  if (unresolved.length) {
    section('Why costs are unknown')
    console.log(
      table(
        ['Reason', 'Items'],
        countReasons(unresolved).map(([reason, count]) => [reason, String(count)]),
        ['l', 'r']
      )
    )
    console.log(
      '\n"nested component cost unknown" is propagation, not a separate fault — the root causes are the rows below.'
    )

    const unitGaps = gaps.filter((g) => g.reason === 'unknown-unit' || g.reason === 'unit-kind-mismatch')
    if (unitGaps.length) {
      section('Root cause — recipe rows the engine cannot convert')
      console.log(
        table(
          ['Reason', 'Source', "Row unit", 'Rows'],
          tally(unitGaps, (g) => `${g.reason}\u0000${g.source}\u0000${g.unit ?? '(none)'}`)
            .slice(0, Number.isFinite(options.limit) ? options.limit : undefined)
            .map(([key, count]) => [...key.split('\u0000'), String(count)]),
          ['l', 'l', 'l', 'r']
        )
      )
    }

    const priceGaps = gaps.filter((g) => g.reason === 'unresolvable-price' || g.reason === 'missing-ref')
    if (priceGaps.length) {
      section('Root cause — catalogue rows with no usable price')
      console.log(
        table(
          ['Reason', 'Source', 'Ingredient', 'Rows'],
          tally(priceGaps, (g) => `${g.reason}\u0000${g.source}\u0000${truncate(g.item, 44)}`)
            .slice(0, Number.isFinite(options.limit) ? options.limit : undefined)
            .map(([key, count]) => [...key.split('\u0000'), String(count)]),
          ['l', 'l', 'l', 'r']
        )
      )
    }
  }

  if (lowConfidence.size) {
    section(`Pack readings to verify (${lowConfidence.size})`)
    console.log(
      'These are costed, but the pack size could not be read with confidence. A wrong reading here is a silent\nmultiple, so they seed the Phase 3 verification queue.\n'
    )
    const entries = [...lowConfidence.values()].sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0))
    console.log(
      table(
        ['Source', 'Ingredient', 'Unit cost', 'Conf', 'Why'],
        entries.slice(0, Number.isFinite(options.limit) ? options.limit : undefined).map((line) => {
          const entry = index.catalogue.get(`${line.source}:${line.id}`)
          return [
            line.source,
            truncate(line.name, 36),
            `${money(line.unitCost, 4)}/${line.unitCostUnit}`,
            (line.confidence ?? 0).toFixed(2),
            truncate(entry?.structure?.notes.join('; ') ?? '', 62),
          ]
        }),
        ['l', 'l', 'r', 'r', 'l']
      )
    )
    if (entries.length > options.limit) console.log(`… ${entries.length - options.limit} more`)
  }

  if (changed.length) {
    section('Why costs changed')
    console.log(
      table(
        ['Reason', 'Items'],
        countReasons(changed).map(([reason, count]) => [reason, String(count)]),
        ['l', 'r']
      )
    )
  }

  printRows(
    'Changed — components',
    changed.filter((r) => r.type === 'component'),
    options.limit,
    false
  )
  printRows(
    'Changed — variants',
    changed.filter((r) => r.type === 'variant'),
    options.limit,
    true
  )
  printRows(
    'Unknown — components',
    unresolved.filter((r) => r.type === 'component'),
    options.limit,
    false
  )
  printRows(
    'Unknown — variants',
    unresolved.filter((r) => r.type === 'variant'),
    options.limit,
    true
  )

  section('Next step')
  if (unresolved.length) {
    console.log(
      `${unresolved.length} item(s) have no knowable cost. Phase 3's backfill and the broken-ref queue exist to close these; nothing is written until they are reviewed.`
    )
  } else {
    console.log('Every component and variant resolved a cost.')
  }
  console.log('No data was modified by this report.')
}

run()
  .catch((error) => {
    console.error('[pricing-parity] Fatal error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
