import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureFulfillmentCommsSettings,
  normalizeTriggerRules,
} from '@/lib/fulfillment-comms-service'

export async function GET() {
  try {
    const settings = await ensureFulfillmentCommsSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching fulfillment comms settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const existing = await ensureFulfillmentCommsSettings()

    const patch: Record<string, unknown> = {}
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (typeof body.title === 'string') patch.title = body.title
    if (typeof body.selectedSenderKey === 'string') patch.selectedSenderKey = body.selectedSenderKey
    if (typeof body.testRecipientEmail === 'string') patch.testRecipientEmail = body.testRecipientEmail.trim() || null
    if (typeof body.emailSubject === 'string') patch.emailSubject = body.emailSubject
    if (typeof body.defaultBodyCopy === 'string') patch.defaultBodyCopy = body.defaultBodyCopy
    if (typeof body.notes === 'string') patch.notes = body.notes
    if (typeof body.liveMode === 'boolean') patch.liveMode = body.liveMode
    if (typeof body.recentWindowDays === 'number' && body.recentWindowDays >= 1 && body.recentWindowDays <= 90) {
      patch.recentWindowDays = Math.floor(body.recentWindowDays)
    }
    if (Array.isArray(body.triggerRules)) {
      patch.triggerRules = normalizeTriggerRules(body.triggerRules) as unknown as object
    }
    if (Array.isArray(body.senderProfiles)) patch.senderProfiles = body.senderProfiles

    const settings = await prisma.fulfillmentCommsSetting.update({
      where: { id: existing.id },
      data: patch as any,
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error updating fulfillment comms settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
