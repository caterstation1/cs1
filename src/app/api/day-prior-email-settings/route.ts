import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_DAY_PRIOR_SENDER_PROFILES } from '@/lib/order-notification-email'

const SETTINGS_KEY = 'DAY_PRIOR_ORDER_NOTIFICATIONS'

async function ensureSettings() {
  const existing = await prisma.dayPriorEmailSetting.findUnique({ where: { key: SETTINGS_KEY } })
  if (existing) return existing

  return prisma.dayPriorEmailSetting.create({
    data: {
      key: SETTINGS_KEY,
      title: 'Day Prior Order Notifications',
      enabled: false,
      sendHourNZ: 15,
      sendMinuteNZ: 0,
      selectedSenderKey: DEFAULT_DAY_PRIOR_SENDER_PROFILES[0].key,
      senderProfiles: DEFAULT_DAY_PRIOR_SENDER_PROFILES as any,
    },
  })
}

export async function GET() {
  try {
    const settings = await ensureSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching day-prior settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const existing = await ensureSettings()

    const patch: any = {}
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (typeof body.sendHourNZ === 'number') patch.sendHourNZ = Math.max(0, Math.min(23, body.sendHourNZ))
    if (typeof body.sendMinuteNZ === 'number') patch.sendMinuteNZ = Math.max(0, Math.min(59, body.sendMinuteNZ))
    if (typeof body.selectedSenderKey === 'string') patch.selectedSenderKey = body.selectedSenderKey
    if (typeof body.testRecipientEmail === 'string') patch.testRecipientEmail = body.testRecipientEmail.trim() || null
    if (typeof body.notes === 'string') patch.notes = body.notes
    if (body.regionalBodyCopy && typeof body.regionalBodyCopy === 'object') patch.regionalBodyCopy = body.regionalBodyCopy
    if (Array.isArray(body.senderProfiles)) patch.senderProfiles = body.senderProfiles

    const settings = await prisma.dayPriorEmailSetting.update({
      where: { id: existing.id },
      data: patch,
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error updating day-prior settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
