import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildDeliveryNoteScope } from '@/lib/delivery-notes'

// Add a delivery note for an order's address + client scope
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note) {
      return NextResponse.json({ error: 'Note text is required' }, { status: 400 })
    }

    const scope = await buildDeliveryNoteScope(body.shippingAddress, body.customerEmail)
    if (!scope.normalizedAddressKey) {
      return NextResponse.json(
        { error: 'Order has no delivery address to attach a note to' },
        { status: 400 }
      )
    }

    const session = await getServerSession(authOptions).catch(() => null)
    const createdBy = session?.user?.name ?? session?.user?.email ?? null

    const created = await prisma.deliveryAddressNote.create({
      data: {
        normalizedAddressKey: scope.normalizedAddressKey,
        scopeDomain: scope.scopeDomain,
        scopeEmail: scope.scopeEmail,
        addressLabel: scope.addressLabel,
        note,
        createdBy,
      },
      select: {
        id: true,
        note: true,
        createdBy: true,
        createdAt: true,
        addressLabel: true,
      },
    })

    return NextResponse.json({ note: created }, { status: 201 })
  } catch (error) {
    console.error('POST /api/delivery-notes failed:', error)
    return NextResponse.json({ error: 'Failed to create delivery note' }, { status: 500 })
  }
}
