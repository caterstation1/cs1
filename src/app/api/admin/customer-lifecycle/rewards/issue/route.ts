import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { issueReward, listRewardIssues } from '@/lib/lifecycle/reward-issue-service'

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
    const rows = await listRewardIssues()
    return NextResponse.json({ success: true, rows })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load reward issues' }, { status: error?.status || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const body = await request.json()
    const row = await issueReward({
      companyId: String(body.companyId || ''),
      contactId: body.contactId || null,
      rewardCatalogId: String(body.rewardCatalogId || ''),
      sourceType: body.sourceType === 'rule' ? 'rule' : 'manual',
      sourceRuleKey: body.sourceRuleKey || null,
      notes: body.notes || null,
      status: body.status || 'draft',
    })
    return NextResponse.json({ success: true, row })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to issue reward' }, { status: error?.status || 500 })
  }
}
