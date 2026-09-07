/**
 * VIP shop order intake.
 *
 * Receives the payload from the storefront /pages/vipshop page, creates a
 * Shopify draft order and completes it with payment pending. That produces a
 * real order with financial status PENDING, which the existing sync-orders
 * cron ingests and Parex syncs to Xero as an Awaiting Payment invoice. No
 * Xero calls here by design.
 *
 * Requires SHOPIFY_ACCESS_TOKEN to carry write_draft_orders. Without it the
 * draftOrderCreate call returns an access-denied error, surfaced as a 502.
 *
 * This path is allowlisted in src/middleware.ts (PUBLIC_PREFIXES) because the
 * caller is an anonymous storefront visitor, not a NextAuth session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SHOP = process.env.SHOPIFY_SHOP_URL || ''
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10'
const BUUNTO_URL =
  process.env.BUUNTO_SETTINGS_URL ||
  'https://cdn.buunto.com/datepicker_settings/cater-station.myshopify.com.json'

/** Optional shared secret. When set, the page must send it as x-vip-key. */
const VIP_KEY = process.env.VIP_SHOP_KEY || ''

const MINIMUM_CENTS = Number(process.env.VIP_MINIMUM_CENTS || 20000)
const ALLOWED_ORIGINS = (
  process.env.VIP_ALLOWED_ORIGINS ||
  'https://caterstation.co.nz,https://www.caterstation.co.nz'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

/* ------------------------------------------------------------------ types */

type LineItemIn = {
  variant_id: number | string
  quantity: number
  title?: string
  sku?: string | null
}

type AddressIn = {
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  zip?: string | null
  country?: string | null
  company?: string | null
  phone?: string | null
}

type Payload = {
  source?: string
  region?: string
  shopifyCustomerId?: string | null
  customerEmail?: string
  customerFirstName?: string | null
  customerLastName?: string | null
  customerPhone?: string | null
  shippingAddress?: AddressIn | null
  billingAddress?: AddressIn | null
  lineItems?: LineItemIn[]
  note?: string | null
  deliveryDate?: string
  deliveryTime?: string
  deliveryInstructions?: string | null
  tags?: string
  _buunto?: Record<string, string>
  _savedNotesUpdate?: { addressId: string; note: string } | null
}

/* -------------------------------------------------------------- responses */

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-vip-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

/* ----------------------------------------------------------- shopify glue */

async function admin<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const body = await res.json()
  if (!res.ok || body.errors) {
    throw new Error(`Shopify ${res.status}: ${JSON.stringify(body.errors || body).slice(0, 400)}`)
  }
  return body.data as T
}

const gid = (id: number | string, type: string) =>
  String(id).startsWith('gid://') ? String(id) : `gid://shopify/${type}/${id}`

/* ------------------------------------------------------ buunto validation */

type Rules = {
  timezoneId?: string
  cutOffTime?: string
  cutOffByDay?: Record<
    string,
    { cutOffTime?: string; firstAvailableDateInDays?: number; lastAvailableDateInDays?: number }
  >
  disabledDates?: string[]
  availableWeekDays?: string[]
  availableDaysByMethod?: Record<string, string[]>
  timeSlotsByDay?: Record<string, { from: string; to: string }[]>
  availabilityStartDate?: string
  availabilityEndDate?: string
  firstAvailableDateInDays?: number
  lastAvailableDateInDays?: number
}

function akParts(tz: string) {
  const p = new Intl.DateTimeFormat('en-NZ', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {})
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    mins: Number(p.hour) * 60 + Number(p.minute),
  }
}

function shiftYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function weekday(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/**
 * Re-checks the delivery slot against Buunto's published rules. The page does
 * this too, but the page is editable by anyone with dev tools.
 */
async function deliveryProblem(ymd: string, from: string): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 'deliveryDate must be YYYY-MM-DD'
  if (!/^\d{1,2}:\d{2}$/.test(from)) return 'deliveryTime must be HH:MM'

  let rules: Rules
  try {
    const r = await fetch(BUUNTO_URL, { cache: 'no-store' })
    const j = await r.json()
    rules = (j?.widgetSettings || j || {}) as Rules
  } catch {
    // If Buunto is unreachable we accept the order rather than block a VIP.
    return null
  }

  const tz = rules.timezoneId || 'Pacific/Auckland'
  const now = akParts(tz)
  const today = weekday(now.ymd)
  const cut =
    rules.cutOffByDay?.[today] ||
    rules.cutOffByDay?.DEFAULT || {
      cutOffTime: rules.cutOffTime,
      firstAvailableDateInDays: rules.firstAvailableDateInDays,
      lastAvailableDateInDays: rules.lastAvailableDateInDays,
    }

  let lead = cut.firstAvailableDateInDays ?? 1
  if (cut.cutOffTime) {
    const [h, m] = cut.cutOffTime.split(':').map(Number)
    if (now.mins >= h * 60 + m) lead += 1
  }
  let min = shiftYmd(now.ymd, lead)
  if (rules.availabilityStartDate && rules.availabilityStartDate > min) min = rules.availabilityStartDate
  let max = shiftYmd(now.ymd, cut.lastAvailableDateInDays ?? 330)
  if (rules.availabilityEndDate && rules.availabilityEndDate < max) max = rules.availabilityEndDate

  if (ymd < min) return `Earliest available delivery is ${min}`
  if (ymd > max) return `Latest available delivery is ${max}`

  const day = weekday(ymd)
  const open = rules.availableDaysByMethod?.LOCAL_DELIVERY || rules.availableWeekDays || []
  if (open.length && !open.includes(day)) return `No delivery on ${day}`
  if ((rules.disabledDates || []).includes(ymd)) return `Closed on ${ymd}`

  const slots = rules.timeSlotsByDay?.[day] || rules.timeSlotsByDay?.DEFAULT || []
  if (slots.length && !slots.some((s) => s.from === from)) {
    return `${from} is not a delivery window on ${day}`
  }
  return null
}

/* --------------------------------------------------------- CS order ref */

/**
 * CS-1001, CS-1002, ... from a Postgres sequence so concurrent submissions
 * can't collide. Created by migration 20260730000000_add_vip_order_ref_seq.
 *
 * Non-fatal: a missing sequence costs the reference, not the order.
 */
async function nextOrderRef(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
      "SELECT nextval('vip_order_ref_seq') AS nextval"
    )
    const n = rows?.[0]?.nextval
    return n ? `CS-${n.toString()}` : null
  } catch (err) {
    console.warn('[vip] order ref unavailable:', (err as Error).message)
    return null
  }
}

/**
 * Shopify rejects NZ local formats on DraftOrderInput.phone, so normalise to
 * E.164. Returns undefined rather than a bad value — an order without a phone
 * beats an order that won't create.
 */
function nzPhone(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const s = raw.replace(/[^\d+]/g, '')
  if (s.startsWith('+')) return s.length >= 11 ? s : undefined
  if (s.startsWith('64')) return `+${s}`
  if (s.startsWith('0')) return s.length >= 9 ? `+64${s.slice(1)}` : undefined
  return s.length >= 8 ? `+64${s}` : undefined
}

/* ------------------------------------------------------------------- POST */

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')

  if (!SHOP || !TOKEN) {
    return json({ ok: false, error: 'Shopify credentials not configured' }, 500, origin)
  }
  if (VIP_KEY && req.headers.get('x-vip-key') !== VIP_KEY) {
    return json({ ok: false, error: 'Unauthorised' }, 401, origin)
  }

  let p: Payload
  try {
    p = (await req.json()) as Payload
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400, origin)
  }

  const items = (p.lineItems || []).filter((l) => l?.variant_id && Number(l.quantity) > 0)
  if (!items.length) return json({ ok: false, error: 'No line items' }, 400, origin)
  if (!p.shopifyCustomerId) return json({ ok: false, error: 'Missing shopifyCustomerId' }, 400, origin)
  if (!p.shippingAddress?.address1) {
    return json({ ok: false, error: 'Missing shipping address' }, 400, origin)
  }
  if (!p.deliveryDate || !p.deliveryTime) {
    return json({ ok: false, error: 'Missing delivery date or window' }, 400, origin)
  }

  /* 1. The customer must exist and still be tagged VIPUSER. */
  let customer: { id: string; tags: string[]; email: string | null } | null = null
  try {
    const d = await admin<{ customer: { id: string; tags: string[]; email: string | null } | null }>(
      `query ($id: ID!) { customer(id: $id) { id tags email } }`,
      { id: gid(p.shopifyCustomerId, 'Customer') }
    )
    customer = d.customer
  } catch (err) {
    return json({ ok: false, error: `Customer lookup failed: ${(err as Error).message}` }, 502, origin)
  }
  if (!customer) return json({ ok: false, error: 'Customer not found' }, 403, origin)
  if (!customer.tags.includes('VIPUSER')) {
    return json({ ok: false, error: 'Not a VIP account' }, 403, origin)
  }

  /* 2. Price from Shopify, never from the client. */
  let priced: { total: number; byId: Record<string, number> }
  try {
    const ids = items.map((l) => gid(l.variant_id, 'ProductVariant'))
    const d = await admin<{ nodes: ({ id: string; price: string } | null)[] }>(
      `query ($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id price } } }`,
      { ids }
    )
    const byId: Record<string, number> = {}
    for (const n of d.nodes) if (n?.id) byId[n.id] = Math.round(parseFloat(n.price) * 100)
    const missing = ids.filter((id) => !(id in byId))
    if (missing.length) {
      return json({ ok: false, error: `Unknown variants: ${missing.join(', ')}` }, 400, origin)
    }
    const total = items.reduce(
      (s, l) => s + byId[gid(l.variant_id, 'ProductVariant')] * Number(l.quantity),
      0
    )
    priced = { total, byId }
  } catch (err) {
    return json({ ok: false, error: `Pricing failed: ${(err as Error).message}` }, 502, origin)
  }

  if (priced.total < MINIMUM_CENTS) {
    return json(
      {
        ok: false,
        error: `Order is under the $${(MINIMUM_CENTS / 100).toFixed(0)} minimum`,
        totalCents: priced.total,
      },
      400,
      origin
    )
  }

  /* 3. Delivery slot must still be legal server-side. */
  const slotProblem = await deliveryProblem(p.deliveryDate, p.deliveryTime)
  if (slotProblem) return json({ ok: false, error: slotProblem }, 400, origin)

  /* 4. Reference, then build the draft order. */
  const ref = await nextOrderRef()
  const region = p.region || 'AKL'

  const tags = Array.from(
    new Set(
      [...(p.tags ? p.tags.split(',').map((t) => t.trim()) : []), 'VIP', ref]
        .filter((t): t is string => Boolean(t))
    )
  )

  const attrs = Object.entries(p._buunto || {}).map(([key, value]) => ({ key, value: String(value) }))
  if (ref) attrs.push({ key: 'VIP Reference', value: ref })

  const addr = (a: AddressIn) => ({
    address1: a.address1 || undefined,
    address2: a.address2 || undefined,
    city: a.city || undefined,
    province: a.province || undefined,
    zip: a.zip || undefined,
    country: a.country || 'New Zealand',
    company: a.company || undefined,
    phone: nzPhone(a.phone || p.customerPhone),
    firstName: p.customerFirstName || undefined,
    lastName: p.customerLastName || undefined,
  })

  const input: Record<string, unknown> = {
    purchasingEntity: { customerId: gid(p.shopifyCustomerId, 'Customer') },
    email: p.customerEmail || customer.email || undefined,
    phone: nzPhone(p.customerPhone),
    note: p.note || p.deliveryInstructions || undefined,
    tags,
    customAttributes: attrs,
    shippingAddress: addr(p.shippingAddress),
    billingAddress: p.billingAddress ? addr(p.billingAddress) : undefined,
    useCustomerDefaultAddress: false,
    sourceName: 'vipshop',
    poNumber: ref || undefined,
    /* No prices sent — Shopify prices from the variants, GST-inclusive per
       the store settings, so the page's totals stay advisory only. */
    lineItems: items.map((l) => ({
      variantId: gid(l.variant_id, 'ProductVariant'),
      quantity: Number(l.quantity),
      customAttributes: [{ key: 'city', value: region }],
    })),
  }

  let draftId: string
  try {
    const d = await admin<{
      draftOrderCreate: {
        draftOrder: { id: string } | null
        userErrors: { field: string[]; message: string }[]
      }
    }>(
      `mutation ($input: DraftOrderInput!) {
         draftOrderCreate(input: $input) {
           draftOrder { id name }
           userErrors { field message }
         }
       }`,
      { input }
    )
    const ue = d.draftOrderCreate.userErrors
    if (ue?.length) return json({ ok: false, error: ue.map((e) => e.message).join('; ') }, 400, origin)
    if (!d.draftOrderCreate.draftOrder) {
      return json({ ok: false, error: 'Draft order not created' }, 502, origin)
    }
    draftId = d.draftOrderCreate.draftOrder.id
  } catch (err) {
    return json({ ok: false, error: `draftOrderCreate failed: ${(err as Error).message}` }, 502, origin)
  }

  /* 5. Complete as payment pending -> real order, financial status PENDING. */
  try {
    const d = await admin<{
      draftOrderComplete: {
        draftOrder: {
          id: string
          order: { id: string; name: string; legacyResourceId: string } | null
        } | null
        userErrors: { field: string[]; message: string }[]
      }
    }>(
      `mutation ($id: ID!) {
         draftOrderComplete(id: $id, paymentPending: true) {
           draftOrder { id order { id name legacyResourceId } }
           userErrors { field message }
         }
       }`,
      { id: draftId }
    )
    const ue = d.draftOrderComplete.userErrors
    if (ue?.length) {
      return json(
        { ok: false, error: ue.map((e) => e.message).join('; '), draftOrderId: draftId },
        400,
        origin
      )
    }
    const order = d.draftOrderComplete.draftOrder?.order
    if (!order) {
      return json({ ok: false, error: 'Draft created but not completed', draftOrderId: draftId }, 502, origin)
    }

    console.log('[vip] order created', { ref, order: order.name, customer: customer.id })

    return json(
      {
        ok: true,
        orderNumber: ref || order.name,
        shopifyOrderName: order.name,
        shopifyOrderId: order.legacyResourceId,
        totalCents: priced.total,
        deliveryDate: p.deliveryDate,
        deliveryTime: p.deliveryTime,
        adminUrl: `https://${SHOP.replace('.myshopify.com', '')}.myshopify.com/admin/orders/${order.legacyResourceId}`,
      },
      200,
      origin
    )
  } catch (err) {
    return json(
      { ok: false, error: `draftOrderComplete failed: ${(err as Error).message}`, draftOrderId: draftId },
      502,
      origin
    )
  }
}
