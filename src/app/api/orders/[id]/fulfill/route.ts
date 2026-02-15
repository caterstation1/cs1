import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/env.mjs'

// Fulfill an order in Shopify by creating a fulfillment that includes all line items
// Path param [id] accepts our DB order id OR the Shopify order id OR the orderNumber
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    // Prefer query param, but allow JSON body override
    let notifyCustomer = url.searchParams.get('notify') === '1' || url.searchParams.get('notify') === 'true'
    try {
      const body = await request.json().catch(() => null) as any
      if (body && typeof body.notifyCustomer === 'boolean') {
        notifyCustomer = body.notifyCustomer
      }
    } catch {}
    // Resolve order by DB id, then by orderNumber, then by shopifyId
    let order = await prisma.order.findUnique({ where: { id } })
    if (!order && !Number.isNaN(Number(id))) {
      order = await prisma.order.findFirst({ where: { orderNumber: Number(id) } })
    }
    if (!order) {
      order = await prisma.order.findFirst({ where: { shopifyId: id } })
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const shopUrl = env.SHOPIFY_SHOP_URL
    const accessToken = env.SHOPIFY_ACCESS_TOKEN
    const apiVersion = env.SHOPIFY_API_VERSION
    if (!shopUrl || !accessToken || !apiVersion) {
      return NextResponse.json({ error: 'Shopify credentials not configured' }, { status: 500 })
    }

    // Fetch Shopify order to get line_item ids
    const getUrl = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}.json`
    const sres = await fetch(getUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    if (!sres.ok) {
      const txt = await sres.text().catch(() => '')
      return NextResponse.json({ error: 'Failed to load Shopify order', details: txt }, { status: 502 })
    }
    const sdata = await sres.json()
    const shopifyOrder = sdata?.order
    if (!shopifyOrder?.line_items?.length) {
      return NextResponse.json({ error: 'Shopify order has no line items' }, { status: 400 })
    }

    const line_items = shopifyOrder.line_items.map((li: any) => ({
      id: li.id,
      quantity: li.quantity,
    }))

    // Determine location_id: prefer order.location_id; otherwise use shop primary location
    let location_id = shopifyOrder.location_id
    if (!location_id) {
      const locUrl = `https://${shopUrl}/admin/api/${apiVersion}/locations.json`
      const lres = await fetch(locUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })
      if (lres.ok) {
        const ldata = await lres.json().catch(() => ({}))
        const locations = Array.isArray(ldata?.locations) ? ldata.locations : []
        const primary = locations.find((l: any) => l.primary) || locations[0]
        if (primary?.id) location_id = primary.id
      }
    }
    if (!location_id) {
      return NextResponse.json({ error: 'No Shopify location_id available to fulfill order' }, { status: 400 })
    }

    // Preferred: Fulfillment Orders API
    // 1) Fetch fulfillment orders for this order
    const foUrl = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}/fulfillment_orders.json`
    const fores = await fetch(foUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })
    let usedFO = false
    if (fores.ok) {
      const fodata = await fores.json().catch(() => ({} as any))
      const fulfillment_orders = Array.isArray(fodata?.fulfillment_orders) ? fodata.fulfillment_orders : []
      if (fulfillment_orders.length > 0) {
        const line_items_by_fulfillment_order = fulfillment_orders.map((fo: any) => {
          const items = Array.isArray(fo.line_items) ? fo.line_items : []
          return {
            fulfillment_order_id: fo.id,
            fulfillment_order_line_items: items.map((li: any) => ({
              id: li.id,
              quantity: li.remaining_quantity ?? li.quantity ?? 0,
            })).filter((li: any) => (li.quantity || 0) > 0),
          }
        }).filter((entry: any) => entry.fulfillment_order_line_items.length > 0)
        if (line_items_by_fulfillment_order.length > 0) {
          const createFulfillmentUrl = `https://${shopUrl}/admin/api/${apiVersion}/fulfillments.json`
          const fb = {
            fulfillment: {
              notify_customer: notifyCustomer,
              tracking_info: { number: null, url: null, company: null },
              line_items_by_fulfillment_order,
            },
          }
          const cfres = await fetch(createFulfillmentUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(fb),
          })
          const cftxt = await cfres.text().catch(() => '')
          if (!cfres.ok) {
            // Fall back to legacy endpoint below
            console.warn('Fulfillment Orders API failed, falling back. Status', cfres.status, cftxt)
          } else {
            usedFO = true
            // Attempt to explicitly send notification when requested (some stores/apps ignore notify_customer on FO flow)
            if (notifyCustomer) {
              try {
                const cfjson = JSON.parse(cftxt || '{}')
                const fulfillmentId = cfjson?.fulfillment?.id
                if (fulfillmentId) {
                  // Try explicit fulfillment notification
                  const notifyUrl = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}/fulfillments/${fulfillmentId}/send_notification.json`
                  await fetch(notifyUrl, {
                    method: 'POST',
                    headers: {
                      'X-Shopify-Access-Token': accessToken,
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify({}),
                  }).catch(() => undefined)
                  // If this was a local delivery, also create a 'delivered' fulfillment event to trigger local_delivered template
                  const isLocal = Array.isArray(shopifyOrder?.shipping_lines) && shopifyOrder.shipping_lines.some((sl: any) =>
                    (sl?.delivery_category && String(sl.delivery_category).toLowerCase() === 'local') ||
                    (sl?.title && /local/i.test(String(sl.title)))
                  )
                  if (isLocal) {
                    const evtUrl = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}/fulfillments/${fulfillmentId}/events.json`
                    await fetch(evtUrl, {
                      method: 'POST',
                      headers: {
                        'X-Shopify-Access-Token': accessToken,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                      },
                      body: JSON.stringify({ event: { status: 'delivered', message: 'Delivered by local delivery' } }),
                    }).catch(() => undefined)
                  }
                }
              } catch {}
            }
          }
        }
      }
    }
    // Fallback: legacy fulfillments endpoint with location_id + line_items
    if (!usedFO) {
      const fulfillUrl = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}/fulfillments.json`
      const body = {
        fulfillment: {
          location_id,
          line_items,
          notify_customer: notifyCustomer,
        },
      }
      const fres = await fetch(fulfillUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const ftxt = await fres.text().catch(() => '')
      if (!fres.ok) {
        return NextResponse.json({ error: 'Shopify fulfillment failed', status: fres.status, details: ftxt }, { status: 502 })
      }
      // Explicitly send notification as a backup (some stores ignore notify_customer here)
      if (notifyCustomer) {
        try {
          const fjson = JSON.parse(ftxt || '{}')
          const fulfillmentId = fjson?.fulfillment?.id
          if (fulfillmentId) {
            const notifyUrl = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}/fulfillments/${fulfillmentId}/send_notification.json`
            await fetch(notifyUrl, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({}),
            }).catch(() => undefined)
            // If this was a local delivery, also create a 'delivered' fulfillment event to target local_delivered template
            const isLocal = Array.isArray(shopifyOrder?.shipping_lines) && shopifyOrder.shipping_lines.some((sl: any) =>
              (sl?.delivery_category && String(sl.delivery_category).toLowerCase() === 'local') ||
              (sl?.title && /local/i.test(String(sl.title)))
            )
            if (isLocal) {
              const evtUrl = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}/fulfillments/${fulfillmentId}/events.json`
              await fetch(evtUrl, {
                method: 'POST',
                headers: {
                  'X-Shopify-Access-Token': accessToken,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify({ event: { status: 'delivered', message: 'Delivered by local delivery' } }),
              }).catch(() => undefined)
            }
          }
        } catch {}
      }
    }

    // Optionally, update our DB: mark fulfillmentStatus as 'fulfilled'
    await prisma.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: 'fulfilled', dbUpdatedAt: new Date() } as any,
    }).catch(() => undefined)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('POST /api/orders/[id]/fulfill failed', e)
    return NextResponse.json({ error: e?.message || 'Failed to fulfill order' }, { status: 500 })
  }
}


