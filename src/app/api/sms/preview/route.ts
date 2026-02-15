import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type TemplateType = 'delivery' | 'pickup' | 'custom'

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
    const { orderIds, templateType, customMessage } = await request.json()
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds required' }, { status: 400 })
    }
    const type: TemplateType = (templateType || 'delivery')
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } }
    })
    // Load templates
    const templates = await prisma.smsTemplate.findMany()
    const delivery = templates.find(t => (t as any).type === 'delivery')?.content || ''
    const pickup = templates.find(t => (t as any).type === 'pickup')?.content || ''
    const baseTemplate = type === 'custom' ? (customMessage || '') : (type === 'pickup' ? pickup : delivery)
    if (!baseTemplate) {
      return NextResponse.json({ error: 'Template not configured' }, { status: 400 })
    }
    const previews = orders.map(o => {
      const to = o.customerPhone || (typeof o.shippingAddress === 'string' ? (()=>{ try { return (JSON.parse(o.shippingAddress) as any).phone || '' } catch { return '' } })() : (o.shippingAddress as any)?.phone || '')
      const message = renderTokens(baseTemplate, o)
      return { orderId: o.id, to, message }
    })
    return NextResponse.json({ previews })
  } catch (e) {
    console.error('POST /api/sms/preview failed', e)
    return NextResponse.json({ error: 'Failed to preview' }, { status: 500 })
  }
}



