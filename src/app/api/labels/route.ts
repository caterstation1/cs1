import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function stripDateTimeFromNote(note: string | null | undefined): string {
  if (!note) return ''
  let cleaned = note
  // Remove time ranges like 11:30 AM - 11:45 AM
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}\s*[AP]M\s*[-–]\s*\d{1,2}:\d{2}\s*[AP]M\b/gi, '')
  // Remove single times like 11:30 AM
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}\s*[AP]M\b/gi, '')
  // Remove day-of-week with trailing date string heuristically (keeps free text)
  cleaned = cleaned.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b[^\n]*/gi, '')
  // Collapse extra spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return cleaned
}

function formatAddress(addr: any): string {
  if (!addr) return ''
  try {
    const a = typeof addr === 'string' ? JSON.parse(addr) : addr
    const company = a.company ? `${a.company}, ` : ''
    const parts = [a.address1, a.city, a.province, a.zip].filter(Boolean)
    return `${company}${parts.join(', ')}`
  } catch {
    return typeof addr === 'string' ? addr : ''
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const orderIdsParam = searchParams.get('orderIds')

    if (!date) {
      return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const orderIdFilter = orderIdsParam ? orderIdsParam.split(',').filter(Boolean) : undefined

    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: date,
        ...(orderIdFilter ? { id: { in: orderIdFilter } } : {}),
      },
      orderBy: { orderNumber: 'asc' },
    })

    type Label = {
      orderId: string
      orderNumber: number
      labelIndex: number
      labelCount: number
      customerName: string
      company: string
      address: string
      deliveryWindow: string
      phonePrimary: string
      phoneSecondary: string
      productTitle: string
      peopleText?: string
      meat1?: string
      meat2?: string
      option1?: string
      option2?: string
      flags?: string
      serveware?: boolean
      addonsForOrder?: string
      notes?: string
    }

    const allLabels: Label[] = []

    for (const o of orders) {
      // Parse line items (array of items with quantity)
      let items: any[] = []
      if (Array.isArray(o.lineItems)) items = o.lineItems as any[]
      else if (typeof o.lineItems === 'string') {
        try { items = JSON.parse(o.lineItems as any) } catch { items = [] }
      }

      // split addons by SKU prefix ADD
      const addons = items.filter((it) => typeof it.sku === 'string' && it.sku.startsWith('ADD'))
      const products = items.filter((it) => !(typeof it.sku === 'string' && it.sku.startsWith('ADD')))

      const addonNames = addons.map((it) => it.variant_title || it.title).filter(Boolean)

      // Build label count by expanding quantities
      const expanded: Array<{ item: any; idx: number }> = []
      products.forEach((item) => {
        const qty = Number(item.quantity || 1)
        for (let i = 0; i < qty; i++) expanded.push({ item, idx: i })
      })

      const labelCount = Math.max(expanded.length, 1)
      const deliveryWindow = o.deliveryTime || ''
      const address = formatAddress(o.shippingAddress)
      const customerName = `${o.customerFirstName || ''} ${o.customerLastName || ''}`.trim()
      const phonePrimary = o.customerPhone || ''

      const note = stripDateTimeFromNote(o.note)

      // If no products (edge case), still produce one label for the order header
      const labelsToIterate = expanded.length ? expanded : [{ item: {}, idx: 0 }]

      let orderLabelIndex = 0
      for (const { item } of labelsToIterate) {
        orderLabelIndex++

        const variantId = item.variant_id?.toString?.() || item.variantId?.toString?.() || ''
        let meta: any = null
        if (variantId) {
          meta = await prisma.productWithCustomData.findUnique({ where: { variantId } })
        }

        allLabels.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          labelIndex: orderLabelIndex,
          labelCount,
          customerName,
          company: (typeof o.shippingAddress === 'string' ? (() => { try { const a = JSON.parse(o.shippingAddress); return a.company || '' } catch { return '' } })() : (o.shippingAddress as any)?.company) || '',
          address,
          deliveryWindow,
          phonePrimary,
          phoneSecondary: '',
          productTitle: item.variant_title || item.title || '',
          peopleText: item.peopleText || '',
          meat1: item.variant_title || undefined,
          meat2: undefined, // No longer using separate meat2 field
          option1: meta?.option1 || undefined,
          option2: meta?.option2 || undefined,
          flags: [meta?.meat1 && 'GF' && undefined].filter(Boolean).join(''), // placeholder; flags can be enriched later
          serveware: !!meta?.serveware,
          addonsForOrder: orderLabelIndex === 1 && addonNames.length ? addonNames.join(', ') : '',
          notes: note,
        })
      }
    }

    return NextResponse.json({ date, count: allLabels.length, labels: allLabels })
  } catch (error) {
    console.error('labels API error', error)
    return NextResponse.json({ error: 'Failed to generate labels' }, { status: 500 })
  }
}



