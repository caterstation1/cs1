import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import {
  ensureCompanyByName,
  recalculateCompanies,
  writeCompanyAssignmentAudit,
} from '@/lib/company-normalization-admin'

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json()
    const contactId = String(body?.contactId || '')
    const targetCompanyIdRaw = String(body?.targetCompanyId || '').trim()
    const targetCompanyName = String(body?.targetCompanyName || '').trim()
    const targetDomain = String(body?.targetDomain || '').trim() || null
    const moveAllOrders = body?.moveAllOrders !== false
    const reason = String(body?.reason || '').trim() || null
    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const contact = await tx.companyContact.findUnique({
        where: { contactId },
      })
      if (!contact) throw new Error('Contact not found')

      const targetCompanyId =
        targetCompanyIdRaw ||
        (targetCompanyName
          ? await ensureCompanyByName(tx, { name: targetCompanyName, domain: targetDomain, createdBy: role })
          : '')
      if (!targetCompanyId) throw new Error('targetCompanyId or targetCompanyName is required')
      const oldCompanyId = contact.companyId

      await tx.companyContact.update({
        where: { contactId },
        data: {
          companyId: targetCompanyId,
        },
      })

      const movedOrderIds: string[] = []
      if (moveAllOrders) {
        if (contact.shopifyCustomerId) {
          const customerOrders = await tx.companyOrder.findMany({
            where: {
              shopifyCustomerId: contact.shopifyCustomerId,
            },
            select: { shopifyOrderId: true },
          })
          movedOrderIds.push(...customerOrders.map((row) => row.shopifyOrderId))
        } else if (contact.email) {
          const rawOrders = await tx.rawShopifyOrder.findMany({
            select: { shopifyOrderId: true, payload: true },
          })
          for (const row of rawOrders) {
            const payload = row.payload as Record<string, any>
            const email = String(payload?.customer?.email || '').toLowerCase()
            if (email && email === contact.email.toLowerCase()) {
              movedOrderIds.push(row.shopifyOrderId)
            }
          }
        }

        if (movedOrderIds.length > 0) {
          await tx.companyOrder.updateMany({
            where: { shopifyOrderId: { in: movedOrderIds } },
            data: {
              companyId: targetCompanyId,
              matchMethod: 'MANUAL_OVERRIDE',
              confidenceScore: 100,
              matchReason: `Manual contact reassignment from ${oldCompanyId} to ${targetCompanyId}`,
            },
          })
        }
      }

      await writeCompanyAssignmentAudit(tx, {
        actionType: 'reassign_contact',
        oldCompanyId,
        newCompanyId: targetCompanyId,
        shopifyCustomerId: contact.shopifyCustomerId,
        oldValue: {
          contactId,
          email: contact.email,
          moveAllOrders,
        },
        newValue: {
          targetCompanyId,
          movedOrderCount: movedOrderIds.length,
        },
        reason,
        createdBy: role,
      })

      await recalculateCompanies(tx, [oldCompanyId, targetCompanyId])
      return {
        contactId,
        oldCompanyId,
        targetCompanyId,
        movedOrderCount: movedOrderIds.length,
      }
    })

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to reassign contact' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
