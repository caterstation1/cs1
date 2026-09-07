import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { updateRewardIssueStatus } from '@/lib/lifecycle/reward-issue-service'

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const body = await request.json()
    const rewardIssueId = String(body.rewardIssueId || '').trim()
    const status = String(body.status || '').trim()
    if (!rewardIssueId || !status) {
      return NextResponse.json({ error: 'rewardIssueId and status are required' }, { status: 400 })
    }
    const row = await updateRewardIssueStatus({
      rewardIssueId,
      status: status as any,
      notes: body.notes || null,
    })
    return NextResponse.json({ success: true, row })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update reward issue status' }, { status: error?.status || 500 })
  }
}
