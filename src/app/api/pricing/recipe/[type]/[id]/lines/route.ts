// Recipe line edits from the Recipe Builder.
//
// Every operation addresses a line by `(origin, position)`: the stored array
// the row came from, and its index in that array. A rendered position is not
// usable, because an owner's lines are `ShopifyProduct.baseIngredients`, the
// rows the variant title's options contribute, the pack contents and the
// variant's own legacy rows concatenated with the duplicates removed — so the
// row a user clicks is very often not stored on the thing they have open, and
// is almost never at the same index.
//
// An edit inside an expanded nested component targets that component's own
// definition, which is the point: editing a shared component changes it
// everywhere, and the impact list says which products moved. A `base` row is
// shared the same way, across every variant of the product.
//
// Costs are always recomputed server-side afterwards. Nothing the client sends
// is treated as a cost.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { CostResult, costVariant, marginFor } from '@/lib/pricing/cost'
import { computeComponentCost } from '@/lib/pricing/persist'
import { buildCostIndex } from '@/lib/pricing/resolve'
import { buildRecipeTree, loadIngredientFlags } from '@/lib/pricing/tree'
import {
  LineTarget,
  isEditableOrigin,
  locateRow,
  locateRows,
  notEditableReason,
  patchRow,
  readRecipeRows,
  removeRow,
  removeRows,
  replaceRow,
} from '@/lib/recipe-builder/lines'

export const maxDuration = 300

const lineSchema = z.object({
  source: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.string().optional(),
  ingredientId: z.string().optional(),
  cost: z.number().min(0).optional(),
})

const targetSchema = z.object({
  origin: z.enum(['base', 'option', 'bundle', 'variant', 'component']),
  position: z.number().int().min(0),
  refId: z.string(),
})

const bodySchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), line: lineSchema }),
  z.object({ op: z.literal('update'), target: targetSchema, quantity: z.number().min(0).optional(), unit: z.string().optional() }),
  z.object({ op: z.literal('remove'), target: targetSchema }),
  // Fix flows: swap a broken/dead reference for a resolvable one, keeping the
  // line's place in the recipe.
  z.object({ op: z.literal('replace'), target: targetSchema, line: lineSchema }),
  // Fix flows: repair a component whose batch yield makes per-unit cost
  // impossible (no-output-quantity). Component owners only.
  z.object({ op: z.literal('set-yield'), producedQuantity: z.number().positive(), producedUnit: z.string().min(1) }),
  z.object({
    op: z.literal('wrap'),
    targets: z.array(targetSchema).min(2),
    name: z.string().min(1),
    producedQuantity: z.number().min(0).default(1),
    producedUnit: z.string().default('unit'),
  }),
])

/**
 * The stored array one edit lands in, and where to write it back.
 *
 * `product` is the shared base recipe: it belongs to the ShopifyProduct, not to
 * the variant that happens to be open, so touching it moves every variant of
 * that product. The impact list reports all of them.
 */
type Slot =
  | { kind: 'component'; componentId: string; rows: unknown[] }
  | { kind: 'variant'; variantPk: string; rows: unknown[] }
  | { kind: 'product'; productId: string; productName: string; variantCount: number; rows: unknown[] }

/** Cost and margin for every variant, to diff before against after. */
async function snapshotVariants() {
  const index = await buildCostIndex()
  const cache = new Map<string, CostResult>()
  const snap = new Map<string, { name: string; cost: number | null; margin: number | null }>()
  for (const variant of index.variantsByVariantId.values()) {
    const result = costVariant(variant.variantId, index, { cache })
    const { margin } = marginFor(
      result.total,
      variant.shopifyPriceInclGst,
      index.settings.gstRate,
      index.settings.targetMargin
    )
    snap.set(variant.variantId, { name: variant.name, cost: result.total, margin })
  }
  return snap
}

/** The array named by `origin`, for the product or component being edited. */
async function loadSlot(
  ownerType: 'product' | 'component',
  ownerId: string,
  origin: LineTarget['origin']
): Promise<Slot | { error: string; status: number }> {
  if (!isEditableOrigin(origin)) {
    return { error: notEditableReason(origin), status: 400 }
  }

  if (ownerType === 'component') {
    if (origin !== 'component') {
      return { error: `A component has no '${origin}' lines.`, status: 400 }
    }
    const component = await prisma.component.findUnique({ where: { id: ownerId }, select: { id: true, ingredients: true } })
    if (!component) return { error: 'Component not found', status: 404 }
    return { kind: 'component', componentId: component.id, rows: readRecipeRows(component.ingredients) }
  }

  if (origin === 'component') {
    return { error: "A product has no 'component' lines.", status: 400 }
  }

  const variant = await prisma.productVariant.findFirst({
    where: { variantId: ownerId },
    select: {
      id: true,
      ingredients: true,
      productId: true,
      product: { select: { id: true, productTitle: true, displayName: true, baseIngredients: true, _count: { select: { variants: true } } } },
    },
  })
  if (!variant) return { error: 'Variant not found', status: 404 }

  if (origin === 'variant') {
    return { kind: 'variant', variantPk: variant.id, rows: readRecipeRows(variant.ingredients) }
  }

  const product = variant.product
  if (!product) return { error: 'This variant has no product, so it has no base recipe.', status: 409 }
  return {
    kind: 'product',
    productId: product.id,
    productName: String(product.productTitle ?? product.displayName ?? product.id),
    variantCount: product._count.variants,
    rows: readRecipeRows(product.baseIngredients),
  }
}

/** Where an `add` goes: the owner's own rows, never the shared base recipe. */
async function loadOwnSlot(
  ownerType: 'product' | 'component',
  ownerId: string
): Promise<Slot | { error: string; status: number }> {
  return loadSlot(ownerType, ownerId, ownerType === 'component' ? 'component' : 'variant')
}

/** Says out loud when an edit landed on the shared base recipe. */
function slotLabel(slot: Slot, preposition: 'in' | 'from'): string {
  return slot.kind === 'product'
    ? ` ${preposition} the base recipe for ${slot.productName} — all ${slot.variantCount} variant${slot.variantCount === 1 ? '' : 's'}`
    : ''
}

async function persistSlot(slot: Slot, rows: unknown[], yieldOverride?: { producedQuantity: number; producedUnit: string }) {
  const json = rows as Prisma.InputJsonValue[]

  if (slot.kind === 'component') {
    const existing = await prisma.component.findUnique({
      where: { id: slot.componentId },
      select: { name: true, producedQuantity: true, producedUnit: true },
    })
    const producedQuantity = yieldOverride?.producedQuantity ?? existing?.producedQuantity ?? 1
    const producedUnit = yieldOverride?.producedUnit ?? existing?.producedUnit ?? 'unit'
    const cost = await computeComponentCost({
      componentId: slot.componentId,
      name: existing?.name ?? '',
      ingredients: rows,
      producedQuantity,
      producedUnit,
      clientTotalCost: 0,
    })
    await prisma.component.update({
      where: { id: slot.componentId },
      data: {
        ingredients: json,
        producedQuantity,
        producedUnit,
        totalCost: cost.totalCost,
        costPerOutputUnit: cost.costPerOutputUnit,
        normalizedOutputUnit: cost.normalizedOutputUnit,
      },
    })
    return
  }

  if (slot.kind === 'variant') {
    await prisma.productVariant.update({ where: { id: slot.variantPk }, data: { ingredients: json } })
    return
  }

  await prisma.shopifyProduct.update({ where: { id: slot.productId }, data: { baseIngredients: json } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const role = await getAccessLevel()
  if (!role || (role !== 'admin' && role !== 'owner' && role !== 'pricing_lab')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, id } = await params
  if (type !== 'product' && type !== 'component') {
    return NextResponse.json({ error: "type must be 'product' or 'component'" }, { status: 400 })
  }
  const ownerType = type as 'product' | 'component'

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data

  try {
    const before = await snapshotVariants()

    let createdComponentId: string | null = null
    let message = ''
    let slot: Slot | null = null
    let rows: unknown[] = []
    let yieldOverride: { producedQuantity: number; producedUnit: string } | undefined

    if (body.op === 'set-yield') {
      if (ownerType !== 'component') {
        return NextResponse.json({ error: 'set-yield applies to components only' }, { status: 400 })
      }
      const loaded = await loadSlot(ownerType, id, 'component')
      if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
      slot = loaded
      rows = loaded.rows
      yieldOverride = { producedQuantity: body.producedQuantity, producedUnit: body.producedUnit }
      message = `Batch yield set to ${body.producedQuantity} ${body.producedUnit}`
    } else if (body.op === 'add') {
      const loaded = await loadOwnSlot(ownerType, id)
      if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
      slot = loaded
      rows = [...loaded.rows, { ...body.line }]
      message = `Added ${body.line.quantity} ${body.line.unit ?? ''} × ${body.line.name}`.replace(/\s+/g, ' ').trim()
    } else if (body.op === 'wrap') {
      const origins = new Set(body.targets.map((t) => t.origin))
      if (origins.size > 1) {
        return NextResponse.json(
          { error: 'Those lines are stored in different places. Wrap lines from the base recipe or the variant, not both.' },
          { status: 400 }
        )
      }
      const loaded = await loadSlot(ownerType, id, body.targets[0].origin)
      if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
      slot = loaded

      const located = locateRows(loaded.rows, body.targets)
      if (!located.ok) return NextResponse.json({ error: located.error }, { status: located.status })
      if (located.rows.length < 2) {
        return NextResponse.json({ error: 'Select at least two lines to wrap' }, { status: 400 })
      }

      const clash = await prisma.component.findUnique({ where: { name: body.name }, select: { id: true } })
      if (clash) return NextResponse.json({ error: `A component named "${body.name}" already exists` }, { status: 409 })

      const cost = await computeComponentCost({
        name: body.name,
        ingredients: located.rows,
        producedQuantity: body.producedQuantity,
        producedUnit: body.producedUnit,
        clientTotalCost: 0,
      })

      const created = await prisma.component.create({
        data: {
          name: body.name,
          description: `Created from ${located.rows.length} lines in the Recipe Builder`,
          ingredients: located.rows as Prisma.InputJsonValue[],
          totalCost: cost.totalCost,
          producedQuantity: body.producedQuantity,
          producedUnit: body.producedUnit,
          costPerOutputUnit: cost.costPerOutputUnit,
          normalizedOutputUnit: cost.normalizedOutputUnit,
        },
        select: { id: true, name: true },
      })
      createdComponentId = created.id

      rows = [
        ...removeRows(loaded.rows, located.indexes),
        {
          source: 'Components',
          id: created.id,
          name: created.name,
          quantity: 1,
          unit: body.producedUnit,
          cost: cost.costPerOutputUnit,
        },
      ]
      message = `Created "${created.name}" from ${located.rows.length} lines — it is now reusable in any product`
    } else {
      const loaded = await loadSlot(ownerType, id, body.target.origin)
      if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
      slot = loaded

      const located = locateRow(loaded.rows, body.target)
      if (!located.ok) return NextResponse.json({ error: located.error }, { status: located.status })

      if (body.op === 'update') {
        rows = patchRow(loaded.rows, located.index, {
          ...(body.quantity != null ? { quantity: body.quantity } : {}),
          ...(body.unit ? { unit: body.unit } : {}),
        })
        message = `Quantity updated${slotLabel(loaded, 'in')}`
      } else if (body.op === 'remove') {
        rows = removeRow(loaded.rows, located.index)
        message = `Removed ${String(located.row.name ?? 'line')}${slotLabel(loaded, 'from')}`
      } else {
        rows = replaceRow(loaded.rows, located.index, { ...body.line })
        message = `Replaced ${String(located.row.name ?? 'line')} with ${body.line.name}${slotLabel(loaded, 'in')}`
      }
    }

    await persistSlot(slot, rows, yieldOverride)

    // --- recost everything and report what moved ---
    const [index, ingredientFlags] = await Promise.all([buildCostIndex(), loadIngredientFlags()])
    const cache = new Map<string, CostResult>()

    const impact: Array<{
      id: string
      name: string
      costBefore: number | null
      costAfter: number | null
      marginBefore: number | null
      marginAfter: number | null
    }> = []

    for (const variant of index.variantsByVariantId.values()) {
      const result = costVariant(variant.variantId, index, { cache })
      const { margin } = marginFor(
        result.total,
        variant.shopifyPriceInclGst,
        index.settings.gstRate,
        index.settings.targetMargin
      )
      const was = before.get(variant.variantId)
      if (!was) continue
      const costMoved = Math.abs((result.total ?? 0) - (was.cost ?? 0)) > 0.005 || (result.total == null) !== (was.cost == null)
      if (!costMoved) continue
      impact.push({
        id: variant.variantId,
        name: variant.name,
        costBefore: was.cost,
        costAfter: result.total,
        marginBefore: was.margin,
        marginAfter: margin,
      })
      // Dual-write so every existing consumer sees the new number.
      if (result.total != null) {
        await prisma.productVariant.update({ where: { id: variant.id }, data: { totalCost: result.total } })
      }
    }

    const tree = buildRecipeTree(ownerType, id, index, { ingredientFlags, cache })
    impact.sort((a, b) => Math.abs((b.costAfter ?? 0) - (b.costBefore ?? 0)) - Math.abs((a.costAfter ?? 0) - (a.costBefore ?? 0)))

    return NextResponse.json({ success: true, message, tree, impact, createdComponentId })
  } catch (error) {
    console.error('❌ /api/pricing/recipe/lines failed:', error)
    return NextResponse.json(
      { error: 'Failed to update recipe', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
