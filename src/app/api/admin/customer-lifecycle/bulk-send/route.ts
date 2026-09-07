import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { LifecycleEmailType, LIFECYCLE_EMAIL_TYPES } from '@/lib/lifecycle/constants'
import { buildCandidateFromSuggestion } from '@/lib/lifecycle/lifecycle-admin-service'
import { sendLifecycleCandidates } from '@/lib/lifecycle/lifecycle-send'
import { ensureLifecycleCommsSettings, normalizeLifecycleSettings } from '@/lib/lifecycle/lifecycle-comms-service'

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json().catch(() => ({}))
    const items = Array.isArray(body.items) ? body.items : []
    if (!items.length) {
      return NextResponse.json({ error: 'No items selected' }, { status: 400 })
    }

    const settings = normalizeLifecycleSettings(await ensureLifecycleCommsSettings())
    if (!settings.bulkSendingEnabled) {
      return NextResponse.json({ error: 'Bulk sending is disabled in lifecycle settings' }, { status: 400 })
    }

    const candidates = []
    for (const item of items) {
      const companyId = String(item.companyId || '').trim()
      const emailType = String(item.emailType || '').trim() as LifecycleEmailType
      if (!companyId || !LIFECYCLE_EMAIL_TYPES.includes(emailType)) continue
      const candidate = await buildCandidateFromSuggestion({
        companyId,
        contactId: item.contactId || null,
        rewardIssueId: item.rewardIssueId || null,
        emailType,
        subject: item.subject,
        bodyCopy: item.bodyCopy,
      })
      candidates.push(candidate)
    }

    const result = await sendLifecycleCandidates({
      candidates,
      approvedBy: role,
      bulk: true,
      allowLive: true,
      forceLiveMode: true,
    })
    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed lifecycle bulk send' }, { status: error?.status || 500 })
  }
}
