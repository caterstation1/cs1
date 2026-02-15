import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppInteractiveMessage, sendWhatsAppText, sendWhatsAppTemplate } from '@/lib/whatsapp'
import { signDriverToken } from '@/lib/dd-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, payout, dispatchTime, notes } = body || {}
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Create DeliveryJob
    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        pickupAddress: process.env.BASE_ADDRESS || 'Base, Auckland',
        dropoffAddress: (() => {
          const sa = (order as any).shippingAddress || {}
          const parts = [sa.address1, sa.address2, sa.city, sa.province, sa.zip, 'New Zealand'].filter(Boolean)
          return parts.join(', ')
        })(),
        payout: Number(payout || 0),
        notes: notes || null,
        status: 'offered',
      },
    })

    // Shortlist available drivers (3–5)
    const drivers = await prisma.dataDriver.findMany({
      where: { status: 'active', availability: true },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    })
    if (drivers.length === 0) {
      return NextResponse.json({ job, offers: [], warning: 'No available drivers' })
    }

    // Create JobOffers
    const offers = await Promise.all(
      drivers.map((d) =>
        prisma.jobOffer.create({
          data: { jobId: job.id, driverId: d.id, status: 'offered' },
        }),
      ),
    )

    // Send WhatsApp messages
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || ''
    const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || ''
    const deliverySuburb = (() => {
      const sa = (order as any).shippingAddress || {}
      return sa.city || sa.province || 'Suburb'
    })()
    const itemsCount = Array.isArray((order as any).lineItems) ? (order as any).lineItems.reduce((a: number, li: any) => a + (Number(li.quantity || 0)), 0) : 0
    const baseBody = `New job offer:
Items: ${itemsCount}
Suburb: ${deliverySuburb}
Dispatch: ${dispatchTime || (order as any).leaveTime || 'TBC'}
Delivery: ${(order as any).deliveryTime || 'TBC'}
Payrate: $${Number(payout || 0).toFixed(2)}`
    await Promise.all(
      offers.map(async (o, i) => {
        const driver = drivers[i]
        if (!driver?.phone) return
        // Normalize NZ mobiles like 021..., +6421..., or 6421... to WA expected digits with country code
        const normalized = (() => {
          let n = String(driver.phone || '').trim()
          // remove spaces and non-digits except leading +
          n = n.replace(/[^\d+]/g, '')
          if (n.startsWith('+')) n = n.slice(1)
          if (n.startsWith('0')) n = '64' + n.slice(1)
          if (!n.startsWith('64') && /^\d{8,15}$/.test(n)) {
            // if looks like local without country code, assume NZ
            n = '64' + n
          }
          return n
        })()
        const tokenLink = signDriverToken(driver.id, 3600)
        const portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://caterstation1.vercel.app'}/dd?token=${encodeURIComponent(tokenLink)}`
        const textBody = `${baseBody}\n\nOpen to respond: ${portalUrl}`
        try {
          // Open a 24h session with a template if needed
          try {
            const tmpl = process.env.WHATSAPP_TEMPLATE_NAME || 'delivery_confirmation_5'
            await sendWhatsAppTemplate({ phoneId, token, toPhoneE164: normalized, templateName: tmpl })
            console.log('WA template sent to', normalized)
          } catch (te) {
            console.warn('WA template failed (continuing)', normalized, te instanceof Error ? te.message : te)
          }
          // Send interactive and a text with the portal link
          await sendWhatsAppInteractiveMessage({
            phoneId,
            token,
            toPhoneE164: normalized,
            header: 'CaterStation Offer',
            body: baseBody,
            buttons: [
              { type: 'reply', reply: { id: `offer:${o.id}:accept`, title: 'Accept' } },
              { type: 'reply', reply: { id: `offer:${o.id}:decline`, title: 'Decline' } },
            ],
          })
          await sendWhatsAppText({ phoneId, token, toPhoneE164: normalized, text: textBody })
        } catch (e) {
          console.error('WA send failed for driver', driver.id, normalized, e)
        }
      }),
    )

    await prisma.jobEvent.create({ data: { jobId: job.id, eventType: 'offer_sent', actor: 'system', data: { offerCount: offers.length } } })
    return NextResponse.json({ job, offers })
  } catch (e) {
    console.error('dispatch jobs error', e)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

