import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CLICKSEND_BASE_URL = 'https://rest.clicksend.com/v3'
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY
const CLICKSEND_SENDER_ID = process.env.CLICKSEND_SENDER_ID || 'CaterStation'

const getAuthHeader = () => {
  if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
    throw new Error('Clicksend credentials not configured')
  }
  const credentials = `${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`
  const encodedCredentials = Buffer.from(credentials).toString('base64')
  return `Basic ${encodedCredentials}`
}

function renderLineItemsList(raw: any): string {
  let items: any[] = []
  if (Array.isArray(raw)) items = raw
  else if (typeof raw === 'string' && raw) {
    try { items = JSON.parse(raw) } catch { items = [] }
  }
  return items.map(li => {
    const title = li?.title || li?.name || ''
    const vt = li?.variant_title || li?.variantTitle
    return `- ${title}${vt ? ` (${vt})` : ''}`
  }).join('\n')
}

function renderTokens(template: string, order: any): string {
  const shipping = typeof order.shippingAddress === 'string'
    ? (()=>{ try { return JSON.parse(order.shippingAddress) } catch { return {} } })()
    : (order.shippingAddress || {})
  const replacements: Record<string, string> = {
    '{{CustomerFirstName}}': order.customerFirstName || '',
    '{{DeliveryTime}}': order.deliveryTime || '',
    '{{ShippingAddress.company}}': shipping.company || '',
    '{{ShippingAddress.address1}}': shipping.address1 || '',
    '{{ShippingAddress.address2}}': shipping.address2 || '',
    '{{LineItemsList}}': renderLineItemsList(order.lineItems),
  }
  let out = template
  for (const [k, v] of Object.entries(replacements)) {
    out = out.split(k).join(v)
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const { orderIds, templateType, customMessage, includeOptOut = true } = await request.json()
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds required' }, { status: 400 })
    }
    const orders = await prisma.order.findMany({ where: { id: { in: orderIds } } })
    // Load templates
    const templates = await prisma.smsTemplate.findMany()
    const delivery = templates.find(t => (t as any).type === 'delivery')?.content || ''
    const pickup = templates.find(t => (t as any).type === 'pickup')?.content || ''
    const baseTemplate = templateType === 'custom' ? (customMessage || '') : (templateType === 'pickup' ? pickup : delivery)
    if (!baseTemplate) {
      return NextResponse.json({ error: 'Template not configured' }, { status: 400 })
    }

    const results: any[] = []
    for (const o of orders) {
      try {
        const to = o.customerPhone || (typeof o.shippingAddress === 'string' ? (()=>{ try { return (JSON.parse(o.shippingAddress) as any).phone || '' } catch { return '' } })() : (o.shippingAddress as any)?.phone || '')
        if (!to) {
          results.push({ orderId: o.id, success: false, error: 'Missing phone' })
          continue
        }
        let message = renderTokens(baseTemplate, o)
        if (includeOptOut) {
          message = `${message}\n\nReply STOP to opt out.`
        }
        // Send SMS
        const resp = await fetch(`${CLICKSEND_BASE_URL}/sms/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader()
          },
          body: JSON.stringify({ messages: [{ source: CLICKSEND_SENDER_ID, body: message, to }] })
        })
        if (!resp.ok) {
          const err = await resp.json().catch(()=> ({}))
          results.push({ orderId: o.id, success: false, error: 'Provider error', provider: err })
          continue
        }
        const providerData = await resp.json().catch(()=> ({}))
        // Update order sms history
        const smsHistory = o.smsHistory ? JSON.parse(JSON.stringify(o.smsHistory)) : []
        smsHistory.push({
          timestamp: new Date().toISOString(),
          phone: to,
          message,
          status: 'sent',
          provider: 'clicksend',
          providerData
        })
        await prisma.order.update({
          where: { id: o.id },
          data: { lastSmsSent: new Date(), smsHistory }
        })
        results.push({ orderId: o.id, success: true })
      } catch (err) {
        console.error('SMS send failed for order', o.id, err)
        results.push({ orderId: o.id, success: false, error: 'Unexpected error' })
      }
    }
    return NextResponse.json({ results })
  } catch (e) {
    console.error('POST /api/sms/send failed', e)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}



