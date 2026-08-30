// Database side of option-based costing. Kept apart from ./options so the
// cost engine's pure row maths stays testable without a database.

import { prisma as defaultPrisma } from '@/lib/prisma'
import {
  type CostingOptionRecord,
  type OptionIndex,
  aliasKey,
  emptyOptionIndex,
  normalizeRows,
} from './options'

export type CostingPrismaClient = Pick<
  typeof defaultPrisma,
  'costingOption' | 'productOptionQuantity' | 'shopifyProduct'
>

/**
 * Loads every option, alias and per-product portion count in three queries.
 * Small enough (~100 options, ~140 aliases) to hold entirely in memory, which
 * is what lets a whole-catalogue reprice avoid a lookup per variant.
 */
export async function loadOptionIndex(
  client: CostingPrismaClient = defaultPrisma
): Promise<OptionIndex> {
  const [options, quantities, products] = await Promise.all([
    client.costingOption.findMany({
      select: {
        id: true,
        name: true,
        kind: true,
        items: true,
        noIngredients: true,
        aliases: { select: { value: true } },
      },
    }),
    client.productOptionQuantity.findMany({
      select: { productId: true, optionId: true, quantity: true },
    }),
    client.shopifyProduct.findMany({ select: { id: true, portionSize: true } }),
  ])

  const index = emptyOptionIndex()

  for (const option of options) {
    const record: CostingOptionRecord = {
      id: option.id,
      name: option.name,
      kind: option.kind,
      items: normalizeRows(option.items),
      noIngredients: option.noIngredients,
    }
    index.byId.set(record.id, record)
    // The canonical name is always usable as an alias, so an option created
    // from a title segment works before anyone adds aliases explicitly.
    index.byAlias.set(aliasKey(record.name), record)
    for (const alias of option.aliases) index.byAlias.set(aliasKey(alias.value), record)
  }

  for (const q of quantities) index.quantities.set(`${q.productId}:${q.optionId}`, q.quantity)
  for (const p of products) index.portionSize.set(p.id, p.portionSize)

  return index
}
