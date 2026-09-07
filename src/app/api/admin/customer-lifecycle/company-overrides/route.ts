import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const body = await request.json().catch(() => ({}))
    const companyId = String(body.companyId || '').trim()
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const patch: Record<string, any> = {}
    if (typeof body.isStrategicOverride === 'boolean' || body.isStrategicOverride === null) {
      patch.isStrategicOverride = body.isStrategicOverride
    }
    if (typeof body.isVipOverride === 'boolean' || body.isVipOverride === null) {
      patch.isVipOverride = body.isVipOverride
    }
    if (typeof body.lifecycleOverrideNote === 'string' || body.lifecycleOverrideNote === null) {
      patch.lifecycleOverrideNote = body.lifecycleOverrideNote
    }
    if (typeof body.pauseDays === 'number') {
      const days = Math.max(0, Math.floor(body.pauseDays))
      patch.lifecyclePausedUntil = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null
    }
    if (body.lifecyclePausedUntil) {
      patch.lifecyclePausedUntil = new Date(body.lifecyclePausedUntil)
    }

    const company = await (prisma as any).company.update({
      where: { companyId },
      data: patch,
    })
    return NextResponse.json({ success: true, company })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update company overrides' }, { status: error?.status || 500 })
  }
}
