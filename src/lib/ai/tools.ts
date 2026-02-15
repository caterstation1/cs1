import { prisma } from '@/lib/prisma'
import { ToolResult, SpendByItemParams, ForecastParams, AllergenParams, DeliveryDetailsParams, CountForDateParams } from './schemas'
import { Prisma } from '@/generated/prisma'

function clampConfidence(x: number): number {
  if (Number.isNaN(x)) return 0.4
  return Math.max(0.1, Math.min(0.95, x))
}

export async function toolSpendByItem(params: SpendByItemParams): Promise<ToolResult> {
  const from = params.from ? new Date(params.from) : new Date(new Date().getFullYear() - 1, 0, 1)
  const to = params.to ? new Date(params.to) : new Date()
  const like = `%${params.itemName.toLowerCase()}%`

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT
      soi."supplierNameSnapshot" AS supplier,
      soi."nameSnapshot"        AS item_name,
      soi.qty                   AS qty,
      (soi."unitPriceExGst")::numeric AS unit_price_ex_gst,
      (soi."lineTotalExGst")::numeric AS line_total_ex_gst,
      so."createdAt"            AS created_at
    FROM "StockOrderItem" soi
    JOIN "StockOrder" so ON so.id = soi."orderId"
    WHERE so."createdAt" BETWEEN $1 AND $2
      AND (LOWER(soi."nameSnapshot") LIKE $3 OR LOWER(soi."sku") LIKE $3)
    ORDER BY so."createdAt" DESC
    LIMIT 50
  `,
    from, to, like,
  )

  const totals = await prisma.$queryRawUnsafe<{ total: string }[]>(
    `
    SELECT COALESCE(SUM((soi."lineTotalExGst")::numeric), 0) AS total
    FROM "StockOrderItem" soi
    JOIN "StockOrder" so ON so.id = soi."orderId"
    WHERE so."createdAt" BETWEEN $1 AND $2
      AND (LOWER(soi."nameSnapshot") LIKE $3 OR LOWER(soi."sku") LIKE $3)
  `,
    from, to, like,
  )

  const total = totals[0]?.total ?? '0'

  return {
    answer: `Total spend on "${params.itemName}" between ${from.toISOString().slice(0,10)} and ${to.toISOString().slice(0,10)} is $${Number(total).toFixed(2)} (ex GST).`,
    confidence: clampConfidence(0.8),
    evidence: {
      totals: { totalExGst: Number(total) },
      tables: [{ name: 'Top matching purchase lines', rows }],
      sql: 'SELECT ... FROM "StockOrderItem" JOIN "StockOrder" WHERE createdAt BETWEEN $1 AND $2 AND LOWER(nameSnapshot) LIKE $3',
    },
  }
}

export async function toolForecastRequirement(params: ForecastParams): Promise<ToolResult> {
  const lookbackDays = params.lookbackDays ?? 84
  const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  const like = `%${params.product.toLowerCase()}%`

  const rows = await prisma.$queryRawUnsafe<{ d: string; qty: number }[]>(
    `
    SELECT
      DATE_TRUNC('day', o."createdAt")::date AS d,
      SUM( (li->>'quantity')::numeric )      AS qty
    FROM "Order" o
    CROSS JOIN LATERAL jsonb_array_elements(o."lineItems"::jsonb) li
    WHERE o."createdAt" >= $1
      AND LOWER(li->>'title') LIKE $2
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 120
  `,
    from, like,
  )

  const dailyAvg = rows.length ? rows.reduce((s, r) => s + Number(r.qty), 0) / rows.length : 0
  const growth = (params.growthPct ?? 10) / 100
  const forecast = dailyAvg * (1 + growth)

  return {
    answer: `Baseline average daily "${params.product}" usage over ${lookbackDays} days is ${dailyAvg.toFixed(1)}. With ${params.growthPct ?? 10}% growth, forecast requirement is ${forecast.toFixed(1)} per day.`,
    confidence: clampConfidence(rows.length ? 0.7 : 0.4),
    evidence: {
      totals: { dailyAvg: Number(dailyAvg.toFixed(2)), forecastDaily: Number(forecast.toFixed(2)) },
      tables: [{ name: 'Daily usage series', rows }],
      sql: 'SELECT date_trunc(day, createdAt), SUM(li.quantity) FROM "Order", jsonb_array_elements(lineItems) WHERE LOWER(li.title) LIKE $2',
    },
  }
}

export async function toolCountForDate(params: CountForDateParams): Promise<ToolResult> {
  // Normalize incoming date to YYYY-MM-DD
  const d = new Date(params.date)
  if (isNaN(d.getTime())) {
    return {
      answer: `Could not parse date "${params.date}". Please use YYYY-MM-DD.`,
      confidence: 0.2,
    }
  }
  const isoDate = d.toISOString().slice(0, 10)
  const like = `%${params.product.toLowerCase()}%`

  const totalRows = await prisma.$queryRawUnsafe<{ qty: string }[]>(
    `
    SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) AS qty
    FROM "Order" o
    CROSS JOIN LATERAL jsonb_array_elements(o."lineItems"::jsonb) li
    WHERE (o."deliveryDate"::date) = $1::date
      AND LOWER(li->>'title') LIKE $2
  `,
    isoDate, like,
  )

  const examples = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT
      o.id, o."orderNumber", o."deliveryDate",
      (li->>'title') AS title,
      (li->>'quantity')::numeric AS qty
    FROM "Order" o
    CROSS JOIN LATERAL jsonb_array_elements(o."lineItems"::jsonb) li
    WHERE (o."deliveryDate"::date) = $1::date
      AND LOWER(li->>'title') LIKE $2
    ORDER BY o."orderNumber" ASC
    LIMIT 50
  `,
    isoDate, like,
  )

  const qty = Number(totalRows?.[0]?.qty ?? 0)
  return {
    answer: `Planned "${params.product}" on ${isoDate}: ${qty}.`,
    confidence: clampConfidence(qty > 0 ? 0.85 : 0.6),
    evidence: {
      totals: { quantity: qty, date: isoDate },
      tables: [{ name: 'Matching orders and items', rows: examples }],
      sql: 'SELECT SUM(li.quantity) FROM "Order", jsonb_array_elements(lineItems) WHERE deliveryDate = $1 AND LOWER(li.title) LIKE $2',
    },
  }
}

export async function toolCheckAllergen(params: AllergenParams): Promise<ToolResult> {
  const like = `%${params.menuName.toLowerCase()}%`

  // Check components flags first
  const comps = await prisma.component.findMany({
    where: { name: { contains: params.menuName, mode: 'insensitive' } },
    select: {
      id: true, name: true,
      hasGluten: true, hasDairy: true, hasSoy: true, hasOnionGarlic: true, hasSesame: true, hasNuts: true, hasEgg: true,
    },
    take: 10,
  })

  const flagMap: Record<string, keyof typeof comps[0]> = {
    gluten: 'hasGluten',
    dairy: 'hasDairy',
    soy: 'hasSoy',
    onionGarlic: 'hasOnionGarlic',
    sesame: 'hasSesame',
    nuts: 'hasNuts',
    egg: 'hasEgg',
  } as any

  const flagKey = flagMap[params.allergen]
  const anyTrue = comps.some((c: any) => Boolean(c[flagKey]))

  return {
    answer: anyTrue
      ? `Yes, at least one matching component for "${params.menuName}" indicates it contains ${params.allergen}.`
      : `No matching component flagged for ${params.allergen} for "${params.menuName}".`,
    confidence: clampConfidence(comps.length ? 0.7 : 0.4),
    evidence: { tables: [{ name: 'Matching components', rows: comps }] },
  }
}

export async function toolOrderDeliveryDetails(params: DeliveryDetailsParams): Promise<ToolResult> {
  const orderNumber = Number(params.orderNumber)
  const order = await prisma.order.findFirst({
    where: { orderNumber },
    select: {
      id: true, orderNumber: true, deliveryTime: true, deliveryDate: true,
      driverId: true, carId: true, travelTime: true, leaveTime: true,
      shippingAddress: true, customerFirstName: true, customerLastName: true,
    },
  })

  if (!order) {
    return { answer: `Order ${orderNumber} not found.`, confidence: 0.2 }
  }

  // Extract delivery address from shippingAddress JSON if present
  const addrObj = (order as any)?.shippingAddress || {}
  const addrParts = [
    addrObj.address1,
    addrObj.address2,
    addrObj.city,
    addrObj.province || addrObj.region,
    addrObj.zip || addrObj.postcode,
    addrObj.country,
  ].filter(Boolean)
  const addressText = addrParts.join(', ')

  let driver = null as any
  if (order.driverId) {
    driver = await prisma.staff.findUnique({
      where: { id: order.driverId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })
  }

  return {
    answer: `Order ${order.orderNumber} delivery address: ${addressText || 'Unavailable'}. Scheduled ${order.deliveryDate ?? ''} ${order.deliveryTime ?? ''}. Driver: ${driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned'}. Vehicle: ${order.carId ?? 'Unassigned'}.`,
    confidence: 0.8,
    evidence: {
      tables: [
        { name: 'Order', rows: [order] },
        { name: 'Address (parsed)', rows: [addrObj] },
        ...(driver ? [{ name: 'Driver', rows: [driver] }] : []),
      ],
      links: [{ label: `Open order ${order.orderNumber}`, href: `/orders?search=${order.orderNumber}` }],
    },
  }
}


