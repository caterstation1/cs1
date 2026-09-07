import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { LifecycleEmailType, LIFECYCLE_EMAIL_TYPES } from '@/lib/lifecycle/constants'
import { buildCandidateFromSuggestion } from '@/lib/lifecycle/lifecycle-admin-service'
import { sendLifecycleCandidates } from '@/lib/lifecycle/lifecycle-send'

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json().catch(() => ({}))
    const companyId = String(body.companyId || '').trim()
    const emailType = String(body.emailType || '').trim() as LifecycleEmailType
    if (!companyId || !LIFECYCLE_EMAIL_TYPES.includes(emailType)) {
      return NextResponse.json({ error: 'companyId and valid emailType are required' }, { status: 400 })
    }
    const candidate = await buildCandidateFromSuggestion({
      companyId,
      contactId: body.contactId || null,
      orderId: body.orderId || null,
      rewardIssueId: body.rewardIssueId || null,
      emailType,
      subject: body.subject,
      bodyCopy: body.bodyCopy,
    })
    const result = await sendLifecycleCandidates({
      candidates: [candidate],
      approvedBy: role,
      bulk: false,
      allowLive: false,
      forceTestMode: true,
    })
    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed lifecycle test send' }, { status: error?.status || 500 })
  }
}
