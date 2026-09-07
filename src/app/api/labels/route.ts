import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBundleItems } from '@/lib/product-service'
import { getDayWindowForYmd } from '@/lib/calendar-query'
import { parseLocalDate } from '@/lib/date-utils'

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

function parseAddressObject(addr: unknown): {
  company: string
  address1: string
  address2: string
  city: string
  province: string
  zip: string
} {
  try {
    const a = typeof addr === 'string' ? JSON.parse(addr) : (addr || {})
    return {
      company: String(a?.company || ''),
      address1: String(a?.address1 || ''),
      address2: String(a?.address2 || ''),
      city: String(a?.city || ''),
      province: String(a?.province || ''),
      zip: String(a?.zip || ''),
    }
  } catch {
    return { company: '', address1: '', address2: '', city: '', province: '', zip: '' }
  }
}

function parseDispatchMinutes(order: { deliveryTime?: string | null; tags?: string | null; travelTime?: string | null }) {
  const deliveryTime =
    order.deliveryTime ||
    order.tags?.match(/(\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M)/)?.[1]

  if (!deliveryTime) return null

  let timeMatch = deliveryTime.match(/(\d{1,2}:\d{2})\s*([AP]M)/)
  let deliveryTimeStr: string | undefined
  if (timeMatch) {
    deliveryTimeStr = `${timeMatch[1]} ${timeMatch[2]}`
  } else {
    timeMatch = deliveryTime.match(/(\d{1,2}:\d{2})/)
    if (timeMatch) deliveryTimeStr = timeMatch[1]
  }
  if (!deliveryTimeStr) return null

  const parsed = new Date(`2000-01-01 ${deliveryTimeStr}`)
  if (Number.isNaN(parsed.getTime())) return null

  const deliveryMinutes = parsed.getHours() * 60 + parsed.getMinutes()
  const travelTimeMinutes = order.travelTime ? parseInt(order.travelTime, 10) || 0 : 0
  return deliveryMinutes - travelTimeMinutes
}

function extractIngredientNames(ingredientsRaw: unknown): string[] {
  if (!Array.isArray(ingredientsRaw)) return []
  return ingredientsRaw
    .map((ingredient) => {
      if (typeof ingredient === 'string') return ingredient.trim()
      if (ingredient && typeof ingredient === 'object' && 'name' in ingredient) {
        return String((ingredient as { name?: unknown }).name || '').trim()
      }
      return ''
    })
    .filter(Boolean)
}

type IngredientRef = {
  id?: string
  name?: string
  source?: string
}

function extractIngredientRefs(ingredientsRaw: unknown): IngredientRef[] {
  if (!Array.isArray(ingredientsRaw)) return []
  return ingredientsRaw
    .map((ingredient) => {
      if (typeof ingredient === 'string') return { name: ingredient.trim() }
      if (ingredient && typeof ingredient === 'object') {
        const row = ingredient as Record<string, unknown>
        return {
          id: row.id ? String(row.id) : undefined,
          name: row.name ? String(row.name).trim() : undefined,
          source: row.source ? String(row.source) : undefined,
        }
      }
      return { name: '' }
    })
    .filter((row) => Boolean(row.id || row.name))
}

function getComponentAllergenTags(component: {
  hasGluten: boolean
  hasDairy: boolean
  hasSoy: boolean
  hasOnionGarlic: boolean
  hasSesame: boolean
  hasNuts: boolean
  hasEgg: boolean
  isVegetarian: boolean
  isVegan: boolean
  isHalal: boolean
}): string[] {
  const tags: string[] = []
  if (component.hasGluten) tags.push('Contains Gluten')
  if (component.hasDairy) tags.push('Contains Dairy')
  if (component.hasSoy) tags.push('Contains Soy')
  if (component.hasOnionGarlic) tags.push('Contains Onion/Garlic')
  if (component.hasSesame) tags.push('Contains Sesame')
  if (component.hasNuts) tags.push('Contains Nuts')
  if (component.hasEgg) tags.push('Contains Egg')
  if (component.isVegetarian) tags.push('Vegetarian')
  if (component.isVegan) tags.push('Vegan')
  if (component.isHalal) tags.push('Halal')
  return tags
}

function getPreferredAllergenTags(allergens: string[] | null | undefined): string[] {
  if (!Array.isArray(allergens)) return []
  const labelMap: Record<string, string> = {
    gluten: 'Contains Gluten',
    sesame: 'Contains Sesame',
    soy: 'Contains Soy',
    garlic: 'Contains Garlic',
    onion: 'Contains Onion',
    dairy: 'Contains Dairy',
    milk: 'Contains Milk',
    egg: 'Contains Egg',
    fish: 'Contains Fish',
    nuts: 'Contains Nuts',
    sulphites: 'Contains Sulphites',
  }
  return Array.from(
    new Set(
      allergens
        .map((item) => String(item || '').trim().toLowerCase())
        .map((item) => labelMap[item])
        .filter(Boolean)
    )
  )
}

function buildAllergenRowsForIngredients(
  ingredients: IngredientRef[],
  componentById: Map<string, { name: string } & Record<string, any>>,
  componentByName: Map<string, { name: string } & Record<string, any>>,
  otherById: Map<string, { name: string; preferredAllergens: string[] | null; listOnLabel: boolean }>,
  otherByName: Map<string, { name: string; preferredAllergens: string[] | null; listOnLabel: boolean }>,
  namePrefix?: string
): Array<{ name: string; allergens: string[] }> {
  const rows: Array<{ name: string; allergens: string[] }> = []
  for (const ingredient of ingredients) {
    const source = (ingredient.source || '').toLowerCase()
    if (source === 'other') {
      const byId = ingredient.id ? otherById.get(ingredient.id) : null
      const byName = ingredient.name ? otherByName.get(ingredient.name.toLowerCase()) : null
      const otherProduct = byId || byName
      if (!otherProduct) continue
      if (!otherProduct.listOnLabel) continue
      const allergens = getPreferredAllergenTags(otherProduct.preferredAllergens)
      if (allergens.length === 0) continue
      rows.push({
        name: namePrefix ? `${namePrefix}${otherProduct.name}` : otherProduct.name,
        allergens,
      })
      continue
    }

    // Mirror runsheet behavior: prefer explicit Components source when present, but
    // also allow fallback name matching for historical ingredient data.
    if (source && source !== 'components') continue

    const byId = ingredient.id ? componentById.get(ingredient.id) : null
    const byName = ingredient.name ? componentByName.get(ingredient.name.toLowerCase()) : null
    const component = byId || byName
    if (!component) continue

    const allergens = getComponentAllergenTags(component as any)
    if (allergens.length === 0) continue
    rows.push({
      name: namePrefix ? `${namePrefix}${component.name}` : component.name,
      allergens,
    })
  }
  return rows
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

    const range = (() => {
      try {
        return getDayWindowForYmd(date)
      } catch {
        const start = parseLocalDate(date) || new Date(date)
        const endExclusive = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
        return { start, endExclusive }
      }
    })()

    const fallbackResolvedStart = parseLocalDate(date) || new Date(date)
    const fallbackResolvedEnd = new Date(
      fallbackResolvedStart.getFullYear(),
      fallbackResolvedStart.getMonth(),
      fallbackResolvedStart.getDate() + 1
    )

    const orders = await prisma.order.findMany({
      where: {
        cancelledAt: null,
        OR: [
          {
            deliveryDateTime: {
              gte: range.start,
              lt: range.endExclusive,
            },
          },
          {
            deliveryDateTime: null,
            deliveryDateResolved: {
              gte: fallbackResolvedStart,
              lt: fallbackResolvedEnd,
            } as any,
          },
        ],
        ...(orderIdFilter ? { id: { in: orderIdFilter } } : {}),
      },
    })
    orders.sort((a, b) => {
      const dispatchA = parseDispatchMinutes(a)
      const dispatchB = parseDispatchMinutes(b)
      if (dispatchA !== null && dispatchB !== null) return dispatchA - dispatchB
      if (dispatchA !== null && dispatchB === null) return -1
      if (dispatchA === null && dispatchB !== null) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    type Label = {
      orderId: string
      orderNumber: number
      labelIndex: number
      labelCount: number
      customerName: string
      company: string
      address: string
      shippingAddress1: string
      shippingAddress2: string
      shippingCity: string
      shippingProvince: string
      shippingZip: string
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
      secondary?: {
        productTitle: string
        components: Array<{ name: string; allergens: string[] }>
        dietaryMarker?: string | null
      }
    }

    const allLabels: Label[] = []
    const components = await prisma.component.findMany({
      select: {
        id: true,
        name: true,
        hasGluten: true,
        hasDairy: true,
        hasSoy: true,
        hasOnionGarlic: true,
        hasSesame: true,
        hasNuts: true,
        hasEgg: true,
        isVegetarian: true,
        isVegan: true,
        isHalal: true,
      },
    })
    const componentByName = new Map(components.map((component) => [component.name.toLowerCase(), component]))
    const componentById = new Map(components.map((component) => [component.id, component]))
    const otherProducts = await prisma.otherProduct.findMany({
      select: {
        id: true,
        name: true,
        preferredAllergens: true,
        listOnLabel: true,
      },
    })
    const otherByName = new Map(otherProducts.map((product) => [product.name.toLowerCase(), product]))
    const otherById = new Map(otherProducts.map((product) => [product.id, product]))

    // Fetch all product variants needed for bundle resolution
    const allVariantIds = new Set<string>()
    for (const o of orders) {
      let items: any[] = []
      if (Array.isArray(o.lineItems)) items = o.lineItems as any[]
      else if (typeof o.lineItems === 'string') {
        try { items = JSON.parse(o.lineItems as any) } catch { items = [] }
      }
      items.forEach((it: any) => {
        const variantId = it.variant_id?.toString() || it.variantId?.toString()
        if (variantId) allVariantIds.add(variantId)
      })
    }

    // Fetch all product variants
    const productVariants = await prisma.productVariant.findMany({
      where: { variantId: { in: Array.from(allVariantIds) } },
      include: { product: true }
    })
    const productsMap: Record<string, any> = {}
    productVariants.forEach(v => {
      productsMap[v.variantId] = {
        ...v,
        baseIngredients: v.product.baseIngredients,
        productDietaryMarker: (v.product as any).dietaryMarker || null,
        isPartyPack: v.isPartyPack,
        bundleItems: v.bundleItems,
        productIsPartyPackDefault: v.product.isPartyPackDefault,
        productBundleDefaultItems: v.product.bundleDefaultItems
      }
    })

    // Fetch child variants that might be in bundles
    const childVariantIds = new Set<string>()
    productVariants.forEach(v => {
      const children = resolveBundleItems({
        ...v,
        isPartyPack: v.isPartyPack,
        bundleItems: v.bundleItems,
        productIsPartyPackDefault: v.product.isPartyPackDefault,
        productBundleDefaultItems: v.product.bundleDefaultItems
      })
      children.forEach(c => childVariantIds.add(c.variantId))
    })
    
    if (childVariantIds.size > 0) {
      const childVariants = await prisma.productVariant.findMany({
        where: { variantId: { in: Array.from(childVariantIds) } },
        include: { product: true }
      })
      childVariants.forEach(v => {
        productsMap[v.variantId] = {
          ...v,
          baseIngredients: v.product.baseIngredients,
          productDietaryMarker: (v.product as any).dietaryMarker || null,
          isPartyPack: v.isPartyPack,
          bundleItems: v.bundleItems,
          productIsPartyPackDefault: v.product.isPartyPackDefault,
          productBundleDefaultItems: v.product.bundleDefaultItems
        }
      })
    }

    for (const o of orders) {
      // Parse line items (array of items with quantity)
      let items: any[] = []
      if (Array.isArray(o.lineItems)) items = o.lineItems as any[]
      else if (typeof o.lineItems === 'string') {
        try { items = JSON.parse(o.lineItems as any) } catch { items = [] }
      }

      // Expand party packs into their nested products
      const expandedItems: any[] = []
      for (const item of items) {
        const variantId = item.variant_id?.toString() || item.variantId?.toString()
        const product = variantId ? productsMap[variantId] : null
        const qty = Number(item.quantity || 1)
        
        if (product) {
          const bundleChildren = resolveBundleItems(product)
          if (bundleChildren.length > 0) {
            // This is a party pack - expand it
            for (const child of bundleChildren) {
              const childProduct = productsMap[child.variantId]
              expandedItems.push({
                ...item,
                variant_id: child.variantId,
                variantId: child.variantId,
                quantity: qty * Math.max(1, parseInt(String(child.quantity || '1'), 10)),
                title: childProduct?.displayName || childProduct?.shopifyName || item.title,
                sku: childProduct?.shopifySku || item.sku,
                _isPackChild: true
              })
            }
          } else {
            // Not a party pack, add as-is
            expandedItems.push(item)
          }
        } else {
          // Product not found, add as-is
          expandedItems.push(item)
        }
      }

      // split addons by SKU prefix ADD or AA
      const addons = expandedItems.filter((it) => typeof it.sku === 'string' && (it.sku.startsWith('ADD') || it.sku.startsWith('AA')))
      const products = expandedItems.filter((it) => !(typeof it.sku === 'string' && (it.sku.startsWith('ADD') || it.sku.startsWith('AA'))))

      const addonNames = addons.map((it) => {
        // For addons, we need to get the displayName from the custom data
        const addonVariantId = it.variant_id?.toString?.() || it.variantId?.toString?.() || ''
        // We'll fetch the displayName for addons in the loop below
        return { item: it, variantId: addonVariantId }
      }).filter(Boolean)

      // Build label count by expanding quantities
      const expanded: Array<{ item: any; idx: number }> = []
      products.forEach((item) => {
        const qty = Number(item.quantity || 1)
        for (let i = 0; i < qty; i++) expanded.push({ item, idx: i })
      })

      const labelCount = Math.max(expanded.length, 1)
      const deliveryWindow = o.deliveryTime || ''
      const address = formatAddress(o.shippingAddress)
      const shipping = parseAddressObject(o.shippingAddress)
      const customerName = `${o.customerFirstName || ''} ${o.customerLastName || ''}`.trim()
      const phonePrimary = o.customerPhone || ''

      const note = stripDateTimeFromNote(o.note)

      // If no products (edge case), still produce one label for the order header
      const labelsToIterate = expanded.length ? expanded : [{ item: {}, idx: 0 }]

      let orderLabelIndex = 0
      for (const { item } of labelsToIterate) {
        orderLabelIndex++

        const variantId = item.variant_id?.toString?.() || item.variantId?.toString?.() || ''
        let meta: any = variantId ? productsMap[variantId] : null
        if (!meta && variantId) {
          meta = await prisma.productVariant.findUnique({ where: { variantId } })
        }

        // Get addon metadata for the first label only
        let addonDisplayNames: string[] = []
        let addonMetas: any[] = []
        if (orderLabelIndex === 1 && addonNames.length > 0) {
          for (const addon of addonNames) {
            if (addon.variantId) {
              const addonMeta =
                productsMap[addon.variantId] ||
                (await prisma.productVariant.findUnique({
                  where: { variantId: addon.variantId },
                  include: { product: { select: { baseIngredients: true } } },
                }))
              if (addonMeta) addonMetas.push(addonMeta)
              const addonDisplayName = addonMeta?.displayName || addon.item.title || ''
              if (addonDisplayName) {
                addonDisplayNames.push(addonDisplayName)
              }
            }
          }
        }

        const baseIngredients = extractIngredientRefs(meta?.baseIngredients)
        const variantIngredients = extractIngredientRefs(meta?.ingredients)
        const productAllergenRows = buildAllergenRowsForIngredients(
          [...baseIngredients, ...variantIngredients],
          componentById,
          componentByName
          ,
          otherById,
          otherByName
        )

        const addonAllergenRows = addonMetas.flatMap((addonMeta) => {
          const addonBase = extractIngredientRefs(addonMeta?.baseIngredients ?? addonMeta?.product?.baseIngredients)
          const addonVariant = extractIngredientRefs(addonMeta?.ingredients)
          const addonName = addonMeta?.displayName || addonMeta?.shopifyName || ''
          const prefix = addonName ? `Add-on ${addonName}: ` : 'Add-on: '
          return buildAllergenRowsForIngredients(
            [...addonBase, ...addonVariant],
            componentById,
            componentByName,
            otherById,
            otherByName,
            prefix
          )
        })

        const dedupeRows = new Map<string, { name: string; allergens: string[] }>()
        for (const row of [...productAllergenRows, ...addonAllergenRows]) {
          const key = `${row.name}::${row.allergens.join('|')}`
          if (!dedupeRows.has(key)) dedupeRows.set(key, row)
        }
        const secondaryComponents = Array.from(dedupeRows.values())

        allLabels.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          labelIndex: orderLabelIndex,
          labelCount,
          customerName,
          company: shipping.company || '',
          address,
          shippingAddress1: shipping.address1,
          shippingAddress2: shipping.address2,
          shippingCity: shipping.city,
          shippingProvince: shipping.province,
          shippingZip: shipping.zip,
          deliveryWindow,
          phonePrimary,
          phoneSecondary: '',
          productTitle: meta?.displayName || item.title || '', // Use displayName from custom data
          peopleText: item.peopleText || '',
          meat1: item.variant_title || undefined, // Use variant_title for meat/variant info
          meat2: undefined, // No longer using separate meat2 field
          option1: meta?.option1 || undefined,
          option2: meta?.option2 || undefined,
          flags: [meta?.meat1 && 'GF' && undefined].filter(Boolean).join(''), // placeholder; flags can be enriched later
          serveware: !!meta?.serveware,
          addonsForOrder: addonDisplayNames.join(', '),
          notes: note,
          secondary: {
            productTitle: meta?.displayName || item.title || '',
            components: secondaryComponents,
            dietaryMarker: meta?.productDietaryMarker || null,
          },
        })
      }
    }

    return NextResponse.json({ date, count: allLabels.length, labels: allLabels })
  } catch (error) {
    console.error('labels API error', error)
    return NextResponse.json({ error: 'Failed to generate labels' }, { status: 500 })
  }
}



