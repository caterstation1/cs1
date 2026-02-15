import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_DELIVERY = `Hi {{CustomerFirstName}}

Peter here from CaterStation. We are all set with your delivery today to {{ShippingAddress.company}}, {{ShippingAddress.address1}}, {{ShippingAddress.address2}}. We will be there at or just a bit after {{DeliveryTime}}.
On order we have
{{LineItemsList}}

Please be in touch on 0800 300 653 if you need anything.
All the Best
CS Team`

const DEFAULT_PICKUP = `Hi {{CustomerFirstName}}

Peter here from CaterStation. We are all set with your pick up order for today.

On order we have
{{LineItemsList}}

We have your pick up time set for {{DeliveryTime}} - But if this changes, please just sing out.

We can be a little hard to find - But if you get to 562 Richmond Road, Grey Lynn please head right down to the bottom of the car park - we are the rear tenancy on the building to your left as you arrive. Here is a Google Pin to help. https://maps.app.goo.gl/3ZbfXndpAPn4raYs8

Please call 0800 300 653 if you need any help. See you soon!.`

export async function GET() {
  try {
    const [delivery, pickup] = await Promise.all([
      prisma.smsTemplate.findUnique({ where: { type: 'delivery' as any } }),
      prisma.smsTemplate.findUnique({ where: { type: 'pickup' as any } }),
    ])
    return NextResponse.json({
      delivery: delivery?.content ?? DEFAULT_DELIVERY,
      pickup: pickup?.content ?? DEFAULT_PICKUP,
    })
  } catch (e) {
    console.error('GET /api/settings/sms-templates failed', e)
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { delivery, pickup } = body || {}
    if (typeof delivery !== 'string' || typeof pickup !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    // Basic guardrails
    if (delivery.length > 4000 || pickup.length > 4000) {
      return NextResponse.json({ error: 'Template too long' }, { status: 400 })
    }
    // Upsert both templates
    const [d, p] = await Promise.all([
      prisma.smsTemplate.upsert({
        where: { type: 'delivery' as any },
        create: { type: 'delivery' as any, content: delivery },
        update: { content: delivery },
      }),
      prisma.smsTemplate.upsert({
        where: { type: 'pickup' as any },
        create: { type: 'pickup' as any, content: pickup },
        update: { content: pickup },
      }),
    ])
    return NextResponse.json({ success: true, delivery: d.content, pickup: p.content })
  } catch (e) {
    console.error('PUT /api/settings/sms-templates failed', e)
    return NextResponse.json({ error: 'Failed to save templates' }, { status: 500 })
  }
}



