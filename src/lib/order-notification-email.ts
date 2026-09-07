export interface DayPriorEmailOrderItem {
  title: string
  variantTitle?: string
  quantity: number
}

export interface DayPriorEmailOrderView {
  orderNumber: number
  customerName: string
  deliveryTime: string
  shippingAddressText: string
  orderItems: DayPriorEmailOrderItem[]
  customerNote?: string
  isPickup?: boolean
}

export interface DayPriorEmailCopy {
  bodyParagraphs?: string[]
}

export interface SenderProfile {
  key: string
  label: string
  fromName: string
  fromEmail: string
  replyTo: string
}

export const DEFAULT_DAY_PRIOR_SENDER_PROFILES: SenderProfile[] = [
  {
    key: 'peter_default',
    label: 'Peter (current)',
    fromName: 'Cater Station',
    fromEmail: 'peter@caterstation.co.nz',
    replyTo: 'peter@caterstation.co.nz',
  },
  {
    key: 'orders_mailbox',
    label: 'Orders mailbox',
    fromName: 'Cater Station Orders',
    fromEmail: 'orders@caterstation.co.nz',
    replyTo: 'orders@caterstation.co.nz',
  },
]

export const DAY_PRIOR_AKL_HEADER_IMAGE_PATH = '/dayprioremailnotification.jpg'
export const DAY_PRIOR_WLG_HEADER_IMAGE_PATH =
  process.env.DAY_PRIOR_WLG_HEADER_IMAGE_PATH || '/wlgdayprioremailnotification.jpg'

/** Single header for app-sent fulfillment confirmation (non-regional). */
export const FULFILLMENT_CONFIRMATION_HEADER_PATH = '/confirmationheaderimage.jpg'

export function getFulfillmentConfirmationHeaderUrl(appUrl: string): string {
  const base = appUrl.replace(/\/$/, '')
  return `${base}${FULFILLMENT_CONFIRMATION_HEADER_PATH}`
}

export function getAppUrl(): string {
  const raw =
    process.env.ORDER_NOTIFICATION_PUBLIC_BASE_URL ||
    process.env.DAY_PRIOR_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PRODUCTION_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://caterstation1.vercel.app'
  return raw.replace(/\/$/, '')
}

export function getOptOutUrl(token: string, appUrl?: string): string {
  const base = (appUrl || getAppUrl()).replace(/\/$/, '')
  return `${base}/unsubscribe/${encodeURIComponent(token)}`
}

export function getDayPriorHeaderImageUrl(appUrl: string, isWellington: boolean): string {
  const path = isWellington ? DAY_PRIOR_WLG_HEADER_IMAGE_PATH : DAY_PRIOR_AKL_HEADER_IMAGE_PATH
  return `${appUrl}${path}`
}

export function parseOrderLineItems(order: any): any[] {
  if (Array.isArray(order?.lineItems)) return order.lineItems
  if (typeof order?.lineItems === 'string' && order.lineItems) {
    try {
      const parsed = JSON.parse(order.lineItems)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function formatShippingAddressText(shippingAddress: any): string {
  const addr =
    typeof shippingAddress === 'string'
      ? (() => {
          try {
            return JSON.parse(shippingAddress)
          } catch {
            return {}
          }
        })()
      : shippingAddress || {}

  const company = addr.company ? `${addr.company}, ` : ''
  const parts = [addr.address1, addr.address2, addr.city, addr.province, addr.zip].filter(Boolean)
  return `${company}${parts.join(', ')}`.trim()
}

function parseTimeToMinutes(value: string): number | null {
  const raw = String(value || '').trim()
  if (!raw) return null

  const ampmMatch = raw.match(/^(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?$/i)
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10)
    const minute = parseInt(ampmMatch[2], 10)
    const isPm = ampmMatch[3].toLowerCase() === 'p'
    if (hour < 1 || hour > 12 || minute > 59) return null
    if (isPm && hour < 12) hour += 12
    if (!isPm && hour === 12) hour = 0
    return hour * 60 + minute
  }

  const h24Match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (h24Match) {
    const hour = parseInt(h24Match[1], 10)
    const minute = parseInt(h24Match[2], 10)
    if (hour > 23 || minute > 59) return null
    return hour * 60 + minute
  }

  return null
}

function formatMinutesAs12Hour(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(normalized / 60)
  const minute = normalized % 60
  const period = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}.${String(minute).padStart(2, '0')}${period}`
}

/**
 * Formats a stored delivery/pickup start time (e.g. "14:00" or "2:00 PM") as a
 * 15-minute arrival window, e.g. "2.00pm - 2.15pm". Falls back to the raw
 * value when the time can't be parsed.
 */
export function formatDeliveryTimeWindow(time: string, windowMinutes = 15): string {
  const startMinutes = parseTimeToMinutes(time)
  if (startMinutes === null) return String(time || '').trim()
  return `${formatMinutesAs12Hour(startMinutes)} - ${formatMinutesAs12Hour(startMinutes + windowMinutes)}`
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderDayPriorOrderEmail(params: {
  order: DayPriorEmailOrderView
  optOutUrl: string
  headerImageUrl?: string
  copy?: DayPriorEmailCopy
}): string {
  const { order, optOutUrl, headerImageUrl, copy } = params
  const safeName = escapeHtml(order.customerName || 'there')
  const safeTime = escapeHtml(order.deliveryTime || 'TBC')
  const safeAddress = escapeHtml(order.shippingAddressText || 'Address not available')
  const isPickup = Boolean(order.isPickup)
  const safeOptOutUrl = escapeHtml(optOutUrl)
  const safeCustomerNote = escapeHtml((order.customerNote || '').trim())
  const defaultParagraphs = [
    "It's not too late to make any changes - please sing out if you would like to make any adjustments.",
    'You can email us here or call on 0800 300 653.',
    'As always - We appreciate your business, We look forward to catering your crew.',
  ]
  const bodyParagraphs = (copy?.bodyParagraphs || []).filter((p) => String(p || '').trim().length > 0)
  const paragraphHtml = (bodyParagraphs.length > 0 ? bodyParagraphs : defaultParagraphs)
    .map((paragraph) => `<p style="margin:0 0 14px 0;line-height:1.5;">${escapeHtml(paragraph)}</p>`)
    .join('')
  const itemsHtml =
    order.orderItems.length === 0
      ? '<li>No line items recorded</li>'
      : order.orderItems
          .map((item) => {
            const title = escapeHtml(item.title || 'Untitled item')
            const variant = item.variantTitle ? ` <span style="color:#6b7280;">(${escapeHtml(item.variantTitle)})</span>` : ''
            const qty = Number(item.quantity || 0)
            return `<li><strong>${qty}x</strong> ${title}${variant}</li>`
          })
          .join('')
  const customerNoteHtml = safeCustomerNote
    ? `
              <div style="text-align:center;margin:8px 0 20px 0;padding:14px 16px;border-radius:12px;background:rgba(0,194,255,0.2);border:1px solid rgba(0,194,255,0.45);color:#111111;">
                <p style="margin:0 0 8px 0;font-weight:700;">Note to ${safeName}</p>
                <p style="margin:0;font-style:italic;line-height:1.55;color:#111111;">${safeCustomerNote.replace(/\n/g, '<br/>')}</p>
              </div>
            `
    : ''
  const timeConnector = safeTime.includes(' - ') ? 'between' : 'at'
  const pickupIntroHtml = isPickup
    ? `
              <p style="margin:0 0 14px 0;line-height:1.5;">
                We are all set for your order tomorrow ${timeConnector} <strong>${safeTime}</strong> for Pick up at <strong>CaterStation - 562 Richmond Road, Grey Lynn</strong>.
              </p>
            `
    : `
              <p style="margin:0 0 14px 0;line-height:1.5;">
                We are all set for your order tomorrow ${timeConnector} <strong>${safeTime}</strong> delivered to
                <strong>${safeAddress}</strong>.
              </p>
            `
  const pickupInstructionsHtml = isPickup
    ? `
              <div style="margin:0 0 16px 0;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #dbeafe;color:#111827;">
                <p style="margin:0 0 8px 0;font-weight:700;">PICK UP instructions</p>
                <p style="margin:0 0 10px 0;line-height:1.6;">
                  We can be a little hard to find - But please head to 562 Richmond Road, Grey Lynn.
                  This is a large commercial block and car park - Please drive down the bottom of the car park behind the building on your left.
                  You will see a foyer, please head in there.
                </p>
                <p style="margin:0;line-height:1.6;">
                  If you are running early or late please give us a call on 0800 300 653 and we will make sure your order is fresh ready to go.
                </p>
              </div>
            `
    : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Notification</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:10px;overflow:hidden;">
          ${
            headerImageUrl
              ? `<tr><td><img src="${escapeHtml(headerImageUrl)}" alt="Cater Station" style="display:block;width:100%;height:auto;" /></td></tr>`
              : ''
          }
          <tr>
            <td style="padding:26px;">
              <p style="margin:0 0 14px 0;font-size:18px;">Hey ${safeName}</p>
              <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;">~ ${escapeHtml(String(order.orderNumber || ''))} ~</p>
              ${pickupIntroHtml}
              ${pickupInstructionsHtml}
              ${paragraphHtml}

              <p style="margin:16px 0 8px 0;font-weight:700;">On order we have:</p>
              <ul style="margin:0 0 18px 18px;padding:0;line-height:1.6;">
                ${itemsHtml}
              </ul>
              ${customerNoteHtml}

              <p style="margin:0 0 6px 0;">Kind regards</p>
              <p style="margin:0 0 20px 0;font-weight:700;">Cater Station</p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0 16px;" />
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                If you would rather not receive these <strong>order specific</strong> email notifications please
                <a href="${safeOptOutUrl}" style="color:#0f766e;">opt out here</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}

export interface FulfillmentConfirmationEmailCopy {
  bodyParagraphs?: string[]
}

export function renderFulfillmentConfirmationEmail(params: {
  order: DayPriorEmailOrderView
  optOutUrl: string
  headerImageUrl?: string
  copy?: FulfillmentConfirmationEmailCopy
  /** Staff message to customer (fulfillment confirmation). */
  clientConfirmationNote?: string | null
}): string {
  const { order, optOutUrl, headerImageUrl, copy, clientConfirmationNote } = params
  const safeName = escapeHtml(order.customerName || 'there')
  const safeOptOutUrl = escapeHtml(optOutUrl)
  const defaultParagraphs = [
    'Your order has been marked as fulfilled. Thank you for choosing Cater Station.',
    'If you have any questions about your order, reply to this email or call 0800 300 653.',
  ]
  const bodyParagraphs = (copy?.bodyParagraphs || []).filter((p) => String(p || '').trim().length > 0)
  const paragraphHtml = (bodyParagraphs.length > 0 ? bodyParagraphs : defaultParagraphs)
    .map((paragraph) => `<p style="margin:0 0 14px 0;line-height:1.5;">${escapeHtml(paragraph)}</p>`)
    .join('')
  const itemsHtml =
    order.orderItems.length === 0
      ? '<li>No line items recorded</li>'
      : order.orderItems
          .map((item) => {
            const title = escapeHtml(item.title || 'Untitled item')
            const variant = item.variantTitle ? ` <span style="color:#6b7280;">(${escapeHtml(item.variantTitle)})</span>` : ''
            const qty = Number(item.quantity || 0)
            return `<li><strong>${qty}x</strong> ${title}${variant}</li>`
          })
          .join('')
  const noteRaw = String(clientConfirmationNote || '').trim()
  const clientNoteHtml = noteRaw
    ? `
              <div style="text-align:center;margin:8px 0 20px 0;padding:14px 16px;border-radius:12px;background:rgba(15,118,110,0.12);border:1px solid rgba(15,118,110,0.35);color:#111111;">
                <p style="margin:0 0 8px 0;font-weight:700;">A note for you</p>
                <p style="margin:0;font-style:italic;line-height:1.55;color:#111111;">${escapeHtml(noteRaw).replace(/\n/g, '<br/>')}</p>
              </div>
            `
    : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order fulfilled</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:10px;overflow:hidden;">
          ${
            headerImageUrl
              ? `<tr><td><img src="${escapeHtml(headerImageUrl)}" alt="Cater Station" style="display:block;width:100%;height:auto;" /></td></tr>`
              : ''
          }
          <tr>
            <td style="padding:26px;">
              <p style="margin:0 0 14px 0;font-size:18px;">Hey ${safeName}</p>
              ${paragraphHtml}
              <p style="margin:16px 0 8px 0;font-weight:700;">Order #${escapeHtml(String(order.orderNumber))} — on order we have:</p>
              <ul style="margin:0 0 18px 18px;padding:0;line-height:1.6;">
                ${itemsHtml}
              </ul>
              ${clientNoteHtml}
              <p style="margin:0 0 6px 0;">Kind regards</p>
              <p style="margin:0 0 20px 0;font-weight:700;">Cater Station</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0 16px;" />
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                If you would rather not receive these <strong>order specific</strong> email notifications please
                <a href="${safeOptOutUrl}" style="color:#0f766e;">opt out here</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}
