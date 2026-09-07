import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGenericDomainsSet } from '@/lib/company-normalization-admin'
import { resolveDeliveryNoteScope } from '@/lib/delivery-notes'

interface LookupOrderInput {
  orderId: string
  shippingAddress: unknown
  customerEmail?: string | null
}

// Batch lookup: returns delivery notes per order for icon state + modal contents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orders: LookupOrderInput[] = Array.isArray(body.orders) ? body.orders : []
    if (orders.length === 0) {
      return NextResponse.json({ notes: {} })
    }

    const genericDomains = await getGenericDomainsSet()
    const scopes = orders
      .filter((o) => o && typeof o.orderId === 'string')
      .map((o) => ({
        orderId: o.orderId,
        scope: resolveDeliveryNoteScope(o.shippingAddress, o.customerEmail, genericDomains),
      }))

    const addressKeys = Array.from(
      new Set(scopes.map((s) => s.scope.normalizedAddressKey).filter(Boolean))
    )
    if (addressKeys.length === 0) {
      return NextResponse.json({ notes: {} })
    }

    const rows = await prisma.deliveryAddressNote.findMany({
      where: { normalizedAddressKey: { in: addressKeys } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        normalizedAddressKey: true,
        scopeDomain: true,
        scopeEmail: true,
        addressLabel: true,
        note: true,
        createdBy: true,
        createdAt: true,
      },
    })

    const notesByOrderId: Record<
      string,
      Array<{ id: string; note: string; createdBy: string | null; createdAt: Date; addressLabel: string }>
    > = {}

    for (const { orderId, scope } of scopes) {
      if (!scope.normalizedAddressKey) continue
      const matches = rows.filter(
        (row) =>
          row.normalizedAddressKey === scope.normalizedAddressKey &&
          ((row.scopeDomain !== null && row.scopeDomain === scope.scopeDomain) ||
            (row.scopeEmail !== null && row.scopeEmail === scope.scopeEmail))
      )
      if (matches.length > 0) {
        notesByOrderId[orderId] = matches.map((m) => ({
          id: m.id,
          note: m.note,
          createdBy: m.createdBy,
          createdAt: m.createdAt,
          addressLabel: m.addressLabel,
        }))
      }
    }

    return NextResponse.json({ notes: notesByOrderId })
  } catch (error) {
    console.error('POST /api/delivery-notes/lookup failed:', error)
    return NextResponse.json({ error: 'Failed to look up delivery notes' }, { status: 500 })
  }
}
