import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'

type ActorInfo = {
  id?: string | null
  name?: string | null
  email?: string | null
}

type OrderChangeEntry = {
  field: string
  before: unknown
  after: unknown
}

function normalizeForCompare(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((entry) => normalizeForCompare(entry))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalizeForCompare(entry)])
    )
  }
  return value ?? null
}

function areEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeForCompare(left)) === JSON.stringify(normalizeForCompare(right))
}

function toLogValue(value: unknown): unknown {
  if (value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

export function buildOrderChangeEntries(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  candidateKeys: string[]
): OrderChangeEntry[] {
  const uniqueKeys = Array.from(new Set(candidateKeys))

  return uniqueKeys
    .map((field) => {
      const beforeValue = before[field]
      const afterValue = after[field]
      if (areEqual(beforeValue, afterValue)) return null

      return {
        field,
        before: toLogValue(beforeValue),
        after: toLogValue(afterValue),
      } as OrderChangeEntry
    })
    .filter((entry): entry is OrderChangeEntry => Boolean(entry))
}

export async function writeOrderChangeLog(params: {
  orderId: string
  action: string
  changes: OrderChangeEntry[]
  actor?: ActorInfo
  source?: string
}) {
  const { orderId, action, changes, actor, source } = params
  if (changes.length === 0) return

  const serializedChanges = changes.map((entry) => ({
    field: entry.field,
    before: toLogValue(entry.before),
    after: toLogValue(entry.after),
  })) as Prisma.InputJsonValue

  await prisma.orderChangeLog.create({
    data: {
      orderId,
      action,
      changes: serializedChanges,
      changedByUserId: actor?.id ?? null,
      changedByName: actor?.name ?? null,
      changedByEmail: actor?.email ?? null,
      source: source ?? null,
    },
  })
}
