import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'
import fs from 'fs/promises'
import path from 'path'
import {
  DEFAULT_DAY_PRIOR_SENDER_PROFILES,
  DayPriorEmailCopy,
  DayPriorEmailOrderView,
  SenderProfile,
  formatDeliveryTimeWindow,
  formatShippingAddressText,
  getDayPriorHeaderImageUrl,
  parseOrderLineItems,
} from '@/lib/order-notification-email'
import { isWellingtonOrder } from '@/lib/region'

const SETTINGS_KEY = 'DAY_PRIOR_ORDER_NOTIFICATIONS'

export async function getDayPriorSettings() {
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

export function resolveSenderProfile(settings: any): SenderProfile {
  const profilesRaw = Array.isArray(settings?.senderProfiles) ? settings.senderProfiles : DEFAULT_DAY_PRIOR_SENDER_PROFILES
  const selected = profilesRaw.find((p: any) => p?.key === settings?.selectedSenderKey) || profilesRaw[0] || DEFAULT_DAY_PRIOR_SENDER_PROFILES[0]
  return {
    key: String(selected.key || DEFAULT_DAY_PRIOR_SENDER_PROFILES[0].key),
    label: String(selected.label || 'Sender'),
    fromName: String(selected.fromName || 'Cater Station'),
    fromEmail: String(selected.fromEmail || process.env.EMAIL_USER || ''),
    replyTo: String(selected.replyTo || selected.fromEmail || process.env.EMAIL_USER || ''),
  }
}

export function buildTransporter() {
  const smtpUser = process.env.DAY_PRIOR_EMAIL_USER || process.env.EMAIL_USER
  const smtpPass = process.env.DAY_PRIOR_EMAIL_APP_PASSWORD || process.env.EMAIL_APP_PASSWORD
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

export function getNZNowParts() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const y = Number(parts.find((p) => p.type === 'year')?.value || '1970')
  const m = Number(parts.find((p) => p.type === 'month')?.value || '01')
  const d = Number(parts.find((p) => p.type === 'day')?.value || '01')
  const hh = Number(parts.find((p) => p.type === 'hour')?.value || '00')
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || '00')
  return { year: y, month: m, day: d, hour: hh, minute: mm, nowYmd: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}

function getUtcMidnightFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

export async function getTomorrowOrdersForDayPrior(isWLG?: boolean, baseYmd?: string) {
  const nowYmd = baseYmd || formatNZYMD(new Date())
  const tomorrowYmd = addDaysNZ(nowYmd, 1)
  const dayAfterYmd = addDaysNZ(tomorrowYmd, 1)
  const tomorrowStartUtc = getUtcMidnightFromYmd(tomorrowYmd)
  const dayAfterStartUtc = getUtcMidnightFromYmd(dayAfterYmd)

  const orders = await prisma.order.findMany({
    where: {
      deliveryDateResolved: {
        gte: tomorrowStartUtc,
        lt: dayAfterStartUtc,
      },
      cancelledAt: null,
    },
    orderBy: { deliveryTime: 'asc' },
  })

  if (typeof isWLG !== 'boolean') return { tomorrowYmd, orders }

  const { isWellingtonOrder } = await import('@/lib/region')
  const filtered = isWLG ? orders.filter(isWellingtonOrder) : orders.filter((o) => !isWellingtonOrder(o))
  return { tomorrowYmd, orders: filtered }
}

export async function getDayPriorOverrides(notificationDateYmd: string) {
  return prisma.dayPriorOrderOverride.findMany({
    where: {
      notificationDate: new Date(notificationDateYmd),
    },
  })
}

export function resolveDayPriorRecipientEmail(params: {
  order: any
  overrideRecipientEmail?: string | null
}): string {
  const raw = (params.overrideRecipientEmail ?? params.order?.customerEmail ?? '').trim().toLowerCase()
  return raw
}

export function getDayPriorCopyForOrder(settings: any, order: any): DayPriorEmailCopy | undefined {
  // Hardcoded WLG copy override (requested).
  if (isWellingtonOrder(order)) {
    return {
      bodyParagraphs: [
        'Please sing out if there are any errors with the above information.',
        'You can email us here or call on 0800 300 653',
      ],
    }
  }

  const regional = settings?.regionalBodyCopy && typeof settings.regionalBodyCopy === 'object'
    ? settings.regionalBodyCopy
    : {}
  const key = 'auckland'
  const rawBody = String((regional as any)?.[key] || '').trim()
  if (!rawBody) return undefined
  const bodyParagraphs = rawBody
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
  if (bodyParagraphs.length === 0) return undefined
  return { bodyParagraphs }
}

export function mapOrderToDayPriorEmailView(order: any): DayPriorEmailOrderView {
  const items = parseOrderLineItems(order).map((it: any) => ({
    title: String(it.title || it.name || 'Untitled item'),
    variantTitle: String(it.variant_title || it.variantTitle || ''),
    quantity: Number(it.quantity || 0),
  }))

  const firstName = String(order.customerFirstName || '').trim()
  const fallbackFull = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim()
  const customerName = (firstName || fallbackFull.split(' ')[0] || 'Customer').trim()
  const pickupTime = String(order.pickupTime || '').trim()
  const deliveryTime = String(order.deliveryTime || '').trim()

  return {
    orderNumber: Number(order.orderNumber || 0),
    customerName,
    deliveryTime: formatDeliveryTimeWindow(deliveryTime || pickupTime),
    shippingAddressText: formatShippingAddressText(order.shippingAddress),
    orderItems: items,
    customerNote: String((order as any)?.customerNote || '').trim(),
    isPickup: isPickupOrder(order),
  }
}

export function getOrderRegion(order: any): 'wlg' | 'auckland' {
  return isWellingtonOrder(order) ? 'wlg' : 'auckland'
}

export function getHeaderImageForOrder(order: any, appUrl: string): string {
  return getDayPriorHeaderImageUrl(appUrl, isWellingtonOrder(order))
}

function normalizeAddressObject(raw: any): any {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' ? raw : {}
}

function noteAttributeValueIncludesPickup(noteAttributes: any): boolean {
  if (!Array.isArray(noteAttributes)) return false
  return noteAttributes.some((attr: any) => {
    const name = String(attr?.name || '').toLowerCase()
    const value = String(attr?.value || '').toLowerCase()
    return name.includes('pickup') || value.includes('pickup')
  })
}

export function isPickupOrder(order: any): boolean {
  const tags = String(order?.tags || '').toLowerCase()
  const shipping = normalizeAddressObject(order?.shippingAddress)
  const addressFields = [shipping.address1, shipping.address2, shipping.city, shipping.province, shipping.zip]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  const hasNoShippingAddress = addressFields.length === 0
  const hasPickupFields = Boolean(String(order?.pickupDate || '').trim() || String(order?.pickupTime || '').trim())
  const hasPickupInTags = tags.includes('pickup') || tags.includes('pick up')
  const hasPickupInNoteAttributes = noteAttributeValueIncludesPickup(order?.noteAttributes)
  return hasPickupFields || hasPickupInTags || hasPickupInNoteAttributes || hasNoShippingAddress
}

export async function getPickupInstructionAttachmentIfAny(): Promise<
  { filename: string; content: Buffer; contentType: string } | null
> {
  const filename = 'DayPriorPickUpInstruction.JPG'
  const absPath = path.join(process.cwd(), 'public', filename)
  try {
    const content = await fs.readFile(absPath)
    return {
      filename,
      content,
      contentType: 'image/jpeg',
    }
  } catch {
    return null
  }
}
