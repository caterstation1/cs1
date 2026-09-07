import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { LIFECYCLE_EMAIL_TYPES, type LifecycleEmailType } from '@/lib/lifecycle/constants'

function nzLogicalDate(): Date {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value || '1970'
  const m = parts.find((p) => p.type === 'month')?.value || '01'
  const d = parts.find((p) => p.type === 'day')?.value || '01'
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`)
}

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json().catch(() => ({}))
    const companyId = String(body.companyId || '').trim()
    const contactId = body.contactId ? String(body.contactId) : null
    const orderId = body.orderId ? String(body.orderId) : null
    const recipientEmail = String(body.recipientEmail || '').trim().toLowerCase()
    const emailType = String(body.emailType || '').trim() as LifecycleEmailType
    const status = String(body.status || '').trim()
    const reason = String(body.reason || '').trim() || null
    if (!companyId || !LIFECYCLE_EMAIL_TYPES.includes(emailType)) {
      return NextResponse.json({ error: 'companyId and valid emailType are required' }, { status: 400 })
    }
    if (!['skipped_manual', 'no_follow_up_needed'].includes(status)) {
      return NextResponse.json({ error: 'status must be skipped_manual or no_follow_up_needed' }, { status: 400 })
    }

    const row = await (prisma as any).lifecycleEmailSendLog.upsert({
      where: {
        companyId_emailType_notificationDate: {
          companyId,
          emailType,
          notificationDate: nzLogicalDate(),
        },
      },
      update: {
        contactId,
        orderId,
        recipientEmail: recipientEmail || 'unknown@local.invalid',
        status,
        reason,
        approvedBy: role,
        approvedAt: new Date(),
        sendMode: 'manual_review',
      },
      create: {
        companyId,
        contactId,
        orderId,
        emailType,
        notificationDate: nzLogicalDate(),
        recipientEmail: recipientEmail || 'unknown@local.invalid',
        status,
        reason,
        approvedBy: role,
        approvedAt: new Date(),
        sendMode: 'manual_review',
      },
    })

    return NextResponse.json({ success: true, row })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to log action' }, { status: error?.status || 500 })
  }
}
