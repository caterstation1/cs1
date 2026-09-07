import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { LifecycleEmailType, LIFECYCLE_EMAIL_TYPES } from '@/lib/lifecycle/constants'
import { buildCandidateFromSuggestion } from '@/lib/lifecycle/lifecycle-admin-service'
import { preflightLifecycleCandidates } from '@/lib/lifecycle/lifecycle-send'

type BulkPreviewItem = {
  companyId: string
  emailType: LifecycleEmailType
  contactId?: string | null
  rewardIssueId?: string | null
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const body = await request.json().catch(() => ({}))
    const items: BulkPreviewItem[] = Array.isArray(body.items) ? body.items : []
    if (!items.length) {
      return NextResponse.json({ error: 'No items selected' }, { status: 400 })
    }

    const candidates = []
    for (const item of items) {
      if (!item.companyId || !item.emailType) continue
      if (!LIFECYCLE_EMAIL_TYPES.includes(item.emailType as LifecycleEmailType)) continue
      const candidate = await buildCandidateFromSuggestion({
        companyId: item.companyId,
        contactId: item.contactId,
        rewardIssueId: item.rewardIssueId,
        emailType: item.emailType,
      })
      candidates.push(candidate)
    }
    const preflight = await preflightLifecycleCandidates(candidates)
    const skipped = preflight.rows.filter((r) => !r.okToSend)
    const okRows = preflight.rows.filter((r) => r.okToSend)
    return NextResponse.json({
      success: true,
      summary: {
        selectedCount: preflight.rows.length,
        okCount: okRows.length,
        skipCount: skipped.length,
        emailTypes: Array.from(new Set(preflight.rows.map((r) => r.candidate.emailType))),
        recipients: Array.from(new Set(preflight.rows.map((r) => r.recipientResolved).filter(Boolean))),
        companies: Array.from(new Set(preflight.rows.map((r) => r.candidate.companyName).filter(Boolean))),
        rewards: Array.from(
          new Set(preflight.rows.map((r) => r.candidate.rewardName).filter((x): x is string => Boolean(x)))
        ),
      },
      rows: preflight.rows,
      skipped,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to build lifecycle bulk preview' }, { status: error?.status || 500 })
  }
}
