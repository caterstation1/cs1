import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { ensureLifecycleCommsSettings, normalizeLifecycleSettings } from '@/lib/lifecycle/lifecycle-comms-service'

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
    const settings = await ensureLifecycleCommsSettings()
    return NextResponse.json({ success: true, settings: normalizeLifecycleSettings(settings) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load lifecycle templates' }, { status: error?.status || 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const body = await request.json()
    const existing = await ensureLifecycleCommsSettings()
    const patch: Record<string, any> = {}
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (typeof body.liveMode === 'boolean') patch.liveMode = body.liveMode
    if (typeof body.automationEnabled === 'boolean') patch.automationEnabled = body.automationEnabled
    if (typeof body.bulkSendingEnabled === 'boolean') patch.bulkSendingEnabled = body.bulkSendingEnabled
    if (typeof body.requireAdminApproval === 'boolean') patch.requireAdminApproval = body.requireAdminApproval
    if (typeof body.testRecipientEmail === 'string') patch.testRecipientEmail = body.testRecipientEmail.trim() || null
    if (typeof body.selectedSenderKey === 'string') patch.selectedSenderKey = body.selectedSenderKey
    if (typeof body.fallbackHeaderImagePath === 'string') patch.fallbackHeaderImagePath = body.fallbackHeaderImagePath
    if (body.emailTypeConfig && typeof body.emailTypeConfig === 'object') patch.emailTypeConfig = body.emailTypeConfig
    if (body.rewardRuleConfig && typeof body.rewardRuleConfig === 'object') patch.rewardRuleConfig = body.rewardRuleConfig
    if (Array.isArray(body.senderProfiles)) patch.senderProfiles = body.senderProfiles
    if (typeof body.notes === 'string') patch.notes = body.notes

    const settings = await (prisma as any).lifecycleCommsSetting.update({
      where: { id: existing.id },
      data: patch,
    })
    return NextResponse.json({ success: true, settings: normalizeLifecycleSettings(settings) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update lifecycle templates' }, { status: error?.status || 500 })
  }
}
