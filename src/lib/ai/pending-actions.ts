import { randomUUID } from 'crypto'

const TTL_MS = 10 * 60 * 1000

export type PendingOrderUpdate = {
  type: 'order_update'
  orderId: string
  orderNumber: number
  patch: Record<string, unknown>
  before: Record<string, unknown>
  actorEmail?: string | null
  createdAt: number
}

type PendingEntry = PendingOrderUpdate

const store = new Map<string, PendingEntry>()

function purgeExpired() {
  const now = Date.now()
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(id)
  }
}

export function createPendingOrderUpdate(entry: Omit<PendingOrderUpdate, 'createdAt' | 'type'>): string {
  purgeExpired()
  const id = randomUUID()
  store.set(id, { ...entry, type: 'order_update', createdAt: Date.now() })
  return id
}

export function consumePendingAction(token: string, actorEmail?: string | null): PendingEntry | null {
  purgeExpired()
  const entry = store.get(token)
  if (!entry) return null
  if (actorEmail && entry.actorEmail && entry.actorEmail !== actorEmail) return null
  store.delete(token)
  return entry
}
