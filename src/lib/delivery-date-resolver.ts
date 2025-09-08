import { parseLocalDate } from '@/lib/date-utils'

export type DeliveryDateResolvedSource = 'FIELD' | 'NOTE' | 'TAG' | 'CREATED_AT'

function toAucklandLocalDateUTC(date: Date): Date {
  // Convert any Date to an Auckland calendar day, then return a UTC Date at that day
  const nz = date.toLocaleString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [day, month, year] = nz.split('/').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function tryParsePotentialDateString(raw: unknown): Date | null {
  if (!raw || typeof raw !== 'string') return null
  // Fast path for YYYY-MM-DD and many common formats
  const d = parseLocalDate(raw)
  if (d) return toAucklandLocalDateUTC(d)
  // Try DD/MM/YYYY
  const m = raw.match(/\b(\d{1,2})[\/](\d{1,2})[\/]((?:19|20)\d{2})\b/)
  if (m) {
    const [, dd, mm, yyyy] = m
    const dt = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  // Try formats like "Thu Jul 17 2025" or "July 17, 2025"
  const parsed = Date.parse(raw)
  if (!Number.isNaN(parsed)) {
    const dt = new Date(parsed)
    return toAucklandLocalDateUTC(dt)
  }
  return null
}

export function resolveDeliveryDateResolved(order: any): { date: Date; source: DeliveryDateResolvedSource } {
  // 1) Explicit deliveryDate field
  if (order?.deliveryDate) {
    const d = tryParsePotentialDateString(order.deliveryDate)
    if (d) return { date: d, source: 'FIELD' }
  }

  // 2) noteAttributes (array of {name,value} or object map)
  const noteAttrs = order?.noteAttributes || order?.note_attributes
  if (noteAttrs) {
    // Array form
    if (Array.isArray(noteAttrs)) {
      const attr = noteAttrs.find((a: any) => typeof a?.name === 'string' && a.name.toLowerCase().includes('delivery date'))
      const value = attr?.value
      const d = tryParsePotentialDateString(value)
      if (d) return { date: d, source: 'NOTE' }
    } else if (typeof noteAttrs === 'object') {
      // Object map form
      const keys = Object.keys(noteAttrs)
      const key = keys.find(k => k.toLowerCase().includes('delivery date'))
      if (key) {
        const d = tryParsePotentialDateString((noteAttrs as any)[key])
        if (d) return { date: d, source: 'NOTE' }
      }
    }
  }

  // 3) Tags string
  if (typeof order?.tags === 'string' && order.tags.trim().length > 0) {
    // Look for a date-looking token
    const candidates = order.tags.split(',').map((t: string) => t.trim())
    for (const c of candidates) {
      const d = tryParsePotentialDateString(c)
      if (d) return { date: d, source: 'TAG' }
    }
  }

  // 4) Fallback to createdAt (converted to Auckland-local day)
  const created = order?.createdAt ? new Date(order.createdAt) : new Date()
  const nzDayUtc = toAucklandLocalDateUTC(created)
  return { date: nzDayUtc, source: 'CREATED_AT' }
}


