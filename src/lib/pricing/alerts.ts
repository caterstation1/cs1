// Turning price history and recalc coverage into things worth telling Peter.
//
// Every threshold comes from PricingSettings. Alerts are deduped on
// (type, refId): re-running never piles up duplicates, and an alert whose
// condition has cleared is resolved rather than left to rot.

import { Prisma } from '../../generated/prisma'
import { prisma as defaultPrisma } from '../prisma'
import { marginFor } from './cost'
import { PricingPrismaClient, buildCostIndex, loadPricingSettings } from './resolve'

export type AlertType =
  | 'backup_cheaper'
  | 'price_spike'
  | 'special'
  | 'margin_below_target'
  | 'broken_ref'
  | 'missing_cost'

export interface CandidateAlert {
  type: AlertType
  refType: 'ingredient' | 'link' | 'component' | 'variant'
  refId: string
  message: string
  /** Stored straight into PriceAlert.data, so it has to be JSON as written. */
  data: Prisma.InputJsonObject
}

export interface AlertEvaluation {
  opened: number
  resolved: number
  unchanged: number
  /** Conditions that still hold but were dismissed, so no alert was raised. */
  suppressed: number
  byType: Record<string, number>
}

const SPIKE_WINDOW_DAYS = 90
/** A median over one or two points is not a trend. */
const MIN_HISTORY_FOR_SPIKE = 4

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const money = (v: number) => `$${v.toFixed(2)}`

/**
 * Ingredients with more than one active supplier link where a lower-ranked
 * link is materially cheaper than the preferred one.
 *
 * Silent while every ingredient has a single link — which is the case until
 * the merge suggestions from the backfill are reviewed.
 */
async function backupCheaper(
  client: PricingPrismaClient,
  backupCheaperPct: number
): Promise<CandidateAlert[]> {
  const ingredients = await client.ingredient.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      canonicalUnit: true,
      links: {
        where: { active: true },
        orderBy: { rank: 'asc' },
        select: {
          id: true,
          source: true,
          rank: true,
          pricePoints: { orderBy: { effectiveAt: 'desc' }, take: 1, select: { unitCost: true } },
        },
      },
    },
  })

  const out: CandidateAlert[] = []
  for (const ingredient of ingredients) {
    const priced = ingredient.links
      .map((l) => ({ ...l, unitCost: l.pricePoints[0]?.unitCost }))
      .filter((l): l is typeof l & { unitCost: number } => typeof l.unitCost === 'number')
    if (priced.length < 2) continue

    const preferred = priced[0]
    const cheapest = priced.slice(1).reduce((best, l) => (l.unitCost < best.unitCost ? l : best), priced[1])
    if (!(cheapest.unitCost <= preferred.unitCost * (1 - backupCheaperPct))) continue

    const savingPct = ((preferred.unitCost - cheapest.unitCost) / preferred.unitCost) * 100
    out.push({
      type: 'backup_cheaper',
      refType: 'ingredient',
      refId: ingredient.id,
      message:
        `${ingredient.name}: ${cheapest.source} ${money(cheapest.unitCost)}/${ingredient.canonicalUnit} is ` +
        `${savingPct.toFixed(0)}% under ${preferred.source} ${money(preferred.unitCost)}/${ingredient.canonicalUnit}`,
      data: {
        preferred: { linkId: preferred.id, source: preferred.source, unitCost: preferred.unitCost },
        cheaper: { linkId: cheapest.id, source: cheapest.source, unitCost: cheapest.unitCost },
        savingPct,
      },
    })
  }
  return out
}

/** Latest price against the trailing median for the same link. */
async function spikesAndSpecials(client: PricingPrismaClient, spikePct: number): Promise<CandidateAlert[]> {
  const since = new Date(Date.now() - SPIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const links = await client.ingredientSupplierLink.findMany({
    where: { active: true },
    select: {
      id: true,
      source: true,
      ingredient: { select: { name: true, canonicalUnit: true } },
      pricePoints: {
        where: { effectiveAt: { gte: since } },
        orderBy: { effectiveAt: 'desc' },
        select: { unitCost: true, effectiveAt: true },
      },
    },
  })

  const out: CandidateAlert[] = []
  for (const link of links) {
    if (link.pricePoints.length < MIN_HISTORY_FOR_SPIKE) continue
    const [latest, ...history] = link.pricePoints
    const baseline = median(history.map((p) => p.unitCost))
    if (baseline == null || baseline <= 0) continue

    const delta = (latest.unitCost - baseline) / baseline
    const unit = link.ingredient.canonicalUnit
    if (delta >= spikePct) {
      out.push({
        type: 'price_spike',
        refType: 'link',
        refId: link.id,
        message:
          `${link.ingredient.name} (${link.source}) is up ${(delta * 100).toFixed(0)}% — ` +
          `${money(latest.unitCost)}/${unit} against a ${SPIKE_WINDOW_DAYS}-day median of ${money(baseline)}/${unit}`,
        data: { latest: latest.unitCost, baseline, deltaPct: delta * 100 },
      })
    } else if (delta <= -spikePct) {
      out.push({
        type: 'special',
        refType: 'link',
        refId: link.id,
        message:
          `${link.ingredient.name} (${link.source}) is down ${(Math.abs(delta) * 100).toFixed(0)}% — ` +
          `${money(latest.unitCost)}/${unit} against a ${SPIKE_WINDOW_DAYS}-day median of ${money(baseline)}/${unit}`,
        data: { latest: latest.unitCost, baseline, deltaPct: delta * 100 },
      })
    }
  }
  return out
}

/** Variants whose margin at the current Shopify price is under target. */
async function marginBelowTarget(
  client: PricingPrismaClient,
  targetMargin: number,
  gstRate: number
): Promise<CandidateAlert[]> {
  const variants = await client.productVariant.findMany({
    where: { isDraft: false },
    select: { id: true, shopifyName: true, shopifyTitle: true, shopifyPrice: true, totalCost: true },
  })

  const out: CandidateAlert[] = []
  for (const variant of variants) {
    const price = Number(variant.shopifyPrice ?? 0)
    const cost = Number(variant.totalCost ?? 0)
    // A zero cost is an unknown cost, not a free product — margin_below_target
    // would be meaningless. Coverage gaps are reported separately.
    if (!(price > 0) || !(cost > 0)) continue

    const { margin, rrpEx, targetRrpEx, targetRrpInclGst } = marginFor(cost, price, gstRate, targetMargin)
    if (margin == null || margin >= targetMargin) continue

    const name = variant.shopifyTitle || variant.shopifyName || variant.id
    out.push({
      type: 'margin_below_target',
      refType: 'variant',
      refId: variant.id,
      message:
        `${name}: margin ${(margin * 100).toFixed(0)}% is under the ${(targetMargin * 100).toFixed(0)}% target. ` +
        `Cost ${money(cost)} against ${money(rrpEx)} ex GST; ` +
        `${money(targetRrpEx ?? 0)} ex / ${money(targetRrpInclGst ?? 0)} incl would hit target.`,
      data: { margin, targetMargin, cost, rrpEx, targetRrpEx, targetRrpInclGst },
    })
  }
  return out
}

/**
 * Components and variants the engine cannot cost — root causes only.
 *
 * Most uncosted items fail purely because something they nest is uncosted.
 * Alerting on those as well turns one bad recipe row into hundreds of alerts
 * and buries everything actionable, so an item whose *only* complaint is
 * `child-cost-unknown` is left out: fixing the child fixes the parent.
 */
async function missingCosts(client: PricingPrismaClient): Promise<CandidateAlert[]> {
  const index = await buildCostIndex({ client })
  const { costComponent, costVariant } = await import('./cost')
  const cache = new Map<string, ReturnType<typeof costComponent>>()
  const out: CandidateAlert[] = []

  const ownFault = (reasons: string[]) => reasons.some((r) => r !== 'child-cost-unknown')

  for (const [id, component] of index.components) {
    const result = costComponent(id, index, { cache })
    if (result.total != null) continue
    // Only this item's own failing lines, not ones inherited from children.
    const reasons = [...new Set(result.missing.filter((m) => m.ownerId === id).map((m) => m.reason))]
    if (!ownFault(reasons)) continue
    out.push({
      type: 'missing_cost',
      refType: 'component',
      refId: id,
      message: `${component.name} has no resolvable cost (${reasons.join(', ')}). Its stored cost is stale.`,
      data: { reasons, coverage: result.coverage },
    })
  }

  for (const variant of index.variantsByVariantId.values()) {
    const result = costVariant(variant.variantId, index, { cache })
    if (result.total != null) continue
    const reasons = [...new Set(result.missing.filter((m) => m.ownerId === variant.variantId).map((m) => m.reason))]
    if (!ownFault(reasons)) continue
    out.push({
      type: 'missing_cost',
      refType: 'variant',
      refId: variant.id,
      message: `${variant.name} has no resolvable cost (${reasons.join(', ')}). Its stored cost is stale.`,
      data: { reasons, coverage: result.coverage },
    })
  }
  return out
}

export interface EvaluateAlertsOptions {
  client?: PricingPrismaClient
  /** Skip the coverage sweep, which rebuilds the whole index. */
  includeMissingCosts?: boolean
}

/**
 * Evaluates every rule, opens what is new, resolves what has cleared, and
 * leaves everything else alone.
 *
 * `broken_ref` alerts are raised by the backfill rather than here — it is the
 * only thing that reads the recipe JSON against the catalogue — but they are
 * resolved here when the reference starts working again.
 */
export async function evaluateAlerts(options: EvaluateAlertsOptions = {}): Promise<AlertEvaluation> {
  const client = options.client ?? defaultPrisma
  const settings = await loadPricingSettings(client)

  const groups = await Promise.all([
    backupCheaper(client, settings.backupCheaperPct),
    spikesAndSpecials(client, settings.spikePct),
    marginBelowTarget(client, settings.targetMargin, settings.gstRate),
    options.includeMissingCosts === false ? Promise.resolve([]) : missingCosts(client),
  ])
  const candidates = groups.flat()

  // Only the types actually evaluated may be auto-resolved, or a skipped rule
  // would close alerts it never looked at.
  const evaluatedTypes: AlertType[] = ['backup_cheaper', 'price_spike', 'special', 'margin_below_target']
  if (options.includeMissingCosts !== false) evaluatedTypes.push('missing_cost')

  // Dismissed alerts are loaded too. Without them a dismissal would last only
  // until the next evaluation, which would immediately raise the same alert
  // again as a new row.
  const existing = await client.priceAlert.findMany({
    where: { status: { in: ['open', 'dismissed'] }, type: { in: evaluatedTypes } },
    select: { id: true, type: true, refId: true, message: true, status: true },
  })
  const open = existing.filter((a) => a.status === 'open')
  const dismissed = existing.filter((a) => a.status === 'dismissed')

  const candidateKeys = new Set(candidates.map((c) => `${c.type}:${c.refId}`))
  const openByKey = new Map(open.map((a) => [`${a.type}:${a.refId}`, a]))
  const dismissedByKey = new Map(dismissed.map((a) => [`${a.type}:${a.refId}`, a]))

  let opened = 0
  let unchanged = 0
  let suppressed = 0
  const byType: Record<string, number> = {}
  const toCreate: CandidateAlert[] = []

  for (const candidate of candidates) {
    const key = `${candidate.type}:${candidate.refId}`
    byType[candidate.type] = (byType[candidate.type] ?? 0) + 1

    const alreadyDismissed = dismissedByKey.get(key)
    if (alreadyDismissed) {
      suppressed += 1
      continue
    }

    const current = openByKey.get(key)
    if (current) {
      // Same condition, but the numbers may have moved; keep the text current.
      if (current.message !== candidate.message) {
        await client.priceAlert.update({
          where: { id: current.id },
          data: { message: candidate.message, data: candidate.data },
        })
      }
      unchanged += 1
      continue
    }
    toCreate.push(candidate)
  }

  // One insert rather than one round trip per alert: against a remote database
  // the per-row latency dominates everything else this function does.
  if (toCreate.length) {
    await client.priceAlert.createMany({
      data: toCreate.map((c) => ({
        type: c.type,
        refType: c.refType,
        refId: c.refId,
        message: c.message,
        data: c.data,
        status: 'open',
      })),
    })
    opened = toCreate.length
  }

  // A dismissed alert whose condition has cleared is resolved too, so if the
  // same problem recurs later it raises a fresh alert rather than staying
  // silent forever behind the old dismissal.
  const stale = existing.filter((a) => !candidateKeys.has(`${a.type}:${a.refId}`))
  if (stale.length) {
    await client.priceAlert.updateMany({
      where: { id: { in: stale.map((a) => a.id) } },
      data: { status: 'resolved', resolvedAt: new Date() },
    })
  }

  return { opened, resolved: stale.length, unchanged, suppressed, byType }
}
