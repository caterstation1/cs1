import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    await requireRole(['owner', 'admin'])
    const params = await context.params
    const orderId = String(params.orderId || '').trim()
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const followup = await (prisma as any).postPurchaseFollowup.findUnique({
      where: { orderId },
    })
    if (!followup) {
      return NextResponse.json({ success: true, followup: null, actions: [] })
    }
    const actions = await (prisma as any).postPurchaseFollowupAction.findMany({
      where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
      orderBy: [{ actedAt: 'desc' }],
      take: 100,
    })
    return NextResponse.json({ success: true, followup, actions })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load post-purchase history' }, { status: error?.status || 500 })
  }
}

