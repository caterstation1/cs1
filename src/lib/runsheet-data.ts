import { prisma } from './prisma'
import { isWellingtonOrder } from './region'
import { resolveBundleItems } from './product-service'
import { format, addDays } from 'date-fns'

interface ComponentCatalog {
  id: string
  name: string
  prepCategory?: string
  prepCategories?: any
}

export async function fetchRunsheetData(date: Date, isWLG: boolean = false, excludeDispatched: boolean = false) {
  // Helper functions
  const isAddon = (sku?: string) => !!sku && (sku.startsWith('ADD') || sku.startsWith('AA'))
  
  const firstTimeTo24 = (range: string) => {
    try {
      if (!range) return ''
      const normalized = String(range).replace(/[\u2012-\u2015]/g, '-')
      const firstPart = normalized.split('-')[0].trim()
      const m = firstPart.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i)
      if (m) {
        let h = parseInt(m[1], 10)
        const mm = m[2]
        const p = m[3].toUpperCase()
        if (p === 'PM' && h < 12) h += 12
        if (p === 'AM' && h === 12) h = 0
        return `${h.toString().padStart(2, '0')}:${mm}`
      }
      if (/^\d{2}:\d{2}$/.test(firstPart)) return firstPart
      return ''
    } catch {
      return ''
    }
  }

  const parseLineItems = (o: any): any[] => {
    if (Array.isArray(o.lineItems)) return o.lineItems
    if (typeof o.lineItems === 'string') {
      try { return JSON.parse(o.lineItems) } catch {}
    }
    return []
  }

  // centralized WLG detection now in src/lib/region.ts

  // Fetch today's orders
  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)
  const dateEnd = new Date(date)
  dateEnd.setHours(23, 59, 59, 999)

  const ordersRaw = await prisma.order.findMany({
    where: {
      deliveryDateResolved: {
        gte: dateStart,
        lte: dateEnd
      },
      ...(excludeDispatched ? { isDispatched: false } as any : {})
    },
    orderBy: { deliveryTime: 'asc' }
  })

  const orders = isWLG ? ordersRaw.filter(isWellingtonOrder) : ordersRaw.filter(o => !isWellingtonOrder(o))

  // Fetch products for these orders
  const variantIds = new Set<string>()
  orders.forEach(o => {
    const items = parseLineItems(o)
    items.forEach(it => {
      const vid = it.variant_id || it.variantId
      if (vid) variantIds.add(String(vid))
    })
  })

  const variants = await prisma.productVariant.findMany({
    where: { variantId: { in: Array.from(variantIds) } },
    include: {
      product: {
        select: {
          displayName: true,
          baseIngredients: true,
          isPartyPackDefault: true,
          bundleDefaultItems: true
        }
      }
    }
  })


  const productsMap: Record<string, any> = {}
  variants.forEach(v => {
    productsMap[v.variantId] = {
      ...v,
      productDisplayName: v.product.displayName,
      baseIngredients: v.product.baseIngredients,
      productIsPartyPackDefault: (v.product as any).isPartyPackDefault ?? false,
      productBundleDefaultItems: (v.product as any).bundleDefaultItems ?? null
    }
  })

  // Ensure child variants referenced by packs are present in productsMap
  const childIds = new Set<string>()
  variants.forEach(v => {
    // Variant-level bundle
    if ((v as any).isPartyPack && (v as any).bundleItems) {
      try {
        const arr = Array.isArray((v as any).bundleItems) ? (v as any).bundleItems : JSON.parse((v as any).bundleItems as any)
        arr.forEach((it: any) => { if (it?.variantId) childIds.add(String(it.variantId)) })
      } catch {}
    }
    // Product-level defaults
    const pDefault = (v.product as any).isPartyPackDefault
    const pItems = (v.product as any).bundleDefaultItems
    if (pDefault && pItems) {
      try {
        const arr = Array.isArray(pItems) ? pItems : JSON.parse(pItems as any)
        arr.forEach((it: any) => { if (it?.variantId) childIds.add(String(it.variantId)) })
      } catch {}
    }
  })
  // Remove already-known ids
  Array.from(Object.keys(productsMap)).forEach(id => childIds.delete(id))
  if (childIds.size > 0) {
    const extra = await prisma.productVariant.findMany({
      where: { variantId: { in: Array.from(childIds) } },
      include: { product: { select: { displayName: true, baseIngredients: true, isPartyPackDefault: true, bundleDefaultItems: true } } }
    })
    extra.forEach(v => {
      productsMap[v.variantId] = {
        ...v,
        productDisplayName: v.product.displayName,
        baseIngredients: v.product.baseIngredients,
        productIsPartyPackDefault: (v.product as any).isPartyPackDefault ?? false,
        productBundleDefaultItems: (v.product as any).bundleDefaultItems ?? null
      }
    })
  }

  // Fetch component catalogs
  const componentsCatalog = await prisma.component.findMany()
  const otherCatalog = await prisma.otherProduct.findMany()

  // Compute products, addons, proteins
  const cutoff = 14 * 60
  const toMinutes = (hhmm: string) => { if (!hhmm) return 24*60; const [h,m] = hhmm.split(':').map(Number); return h*60+m }
  
  let orderCount = 0
  let boxesCount = 0
  let servewareBoxes = 0
  const productMap: Record<string, { total: number; am: number; name: string }> = {}
  const addonsMap: Record<string, { total: number; am: number }> = {}
  const proteins: Record<string, { total: number; am: number }> = {}
  // Cost aggregation per displayed product name
  const productCostAgg: Record<string, { qty: number; totalCost: number }> = {}

  for (const o of orders) {
    orderCount++
    const deliveryTime = firstTimeTo24((o as any).deliveryTime || '')
    const am = toMinutes(deliveryTime) <= cutoff
    const items = parseLineItems(o)
    for (const it of items) {
      const qty = Number(it.quantity || 0)
      const variantId = it.variant_id?.toString() || it.variantId?.toString()
      const product = variantId ? productsMap[variantId] : undefined
      // Expand party pack bundles into child items for counting; skip counting the pack itself
      const bundleChildren = product ? resolveBundleItems(product) : []
      if (bundleChildren.length > 0) {
        for (const child of bundleChildren) {
          const childProduct = productsMap[child.variantId]
          if (!childProduct) continue
          const totalQty = qty * child.quantity
          // Treat as regular item below via inline logic
          // Count boxes, serveware
          boxesCount += totalQty
          if (childProduct?.serveware) servewareBoxes += totalQty
          const name = childProduct?.productDisplayName?.trim() || childProduct?.shopifyName || it.title
          if (!productMap[name]) productMap[name] = { total: 0, am: 0, name }
          productMap[name].total += totalQty
          if (am) productMap[name].am += totalQty
          // Cost aggregation for bundle child
          const unitCostChild = Number(childProduct?.totalCost ?? 0) || 0
          if (!productCostAgg[name]) productCostAgg[name] = { qty: 0, totalCost: 0 }
          productCostAgg[name].qty += totalQty
          productCostAgg[name].totalCost += totalQty * unitCostChild
          const initials = [childProduct?.meat1, childProduct?.meat2].filter(Boolean).map((s: string) => s!.trim()[0]?.toUpperCase()).filter(Boolean)
          for (const init of initials) {
            if (!proteins[init]) proteins[init] = { total: 0, am: 0 }
            proteins[init].total += totalQty
            if (am) proteins[init].am += totalQty
          }
        }
        continue // skip pack itself
      }

      if (isAddon(it.sku)) {
        const key = product?.productDisplayName?.trim() || product?.shopifyName || it.title
        if (!addonsMap[key]) addonsMap[key] = { total: 0, am: 0 }
        addonsMap[key].total += qty
        if (am) addonsMap[key].am += qty
        continue
      }
      
      boxesCount += qty
      if (product?.serveware) servewareBoxes += qty
      const name = product?.productDisplayName?.trim() || product?.shopifyName || it.title
      if (!productMap[name]) productMap[name] = { total: 0, am: 0, name }
      productMap[name].total += qty
      if (am) productMap[name].am += qty
      // Cost aggregation for regular item
      const unitCost = Number(product?.totalCost ?? 0) || 0
      if (!productCostAgg[name]) productCostAgg[name] = { qty: 0, totalCost: 0 }
      productCostAgg[name].qty += qty
      productCostAgg[name].totalCost += qty * unitCost

      const initials = [product?.meat1, product?.meat2].filter(Boolean).map((s: string) => s!.trim()[0]?.toUpperCase()).filter(Boolean)
      for (const init of initials) {
        if (!proteins[init]) proteins[init] = { total: 0, am: 0 }
        proteins[init].total += qty
        if (am) proteins[init].am += qty
      }
    }
  }

  const productsList = Object.values(productMap)
    .map(p => {
      const agg = productCostAgg[p.name]
      const totalCost = agg ? Number(agg.totalCost.toFixed(2)) : 0
      const avgUnitCost = agg && agg.qty > 0 ? Number((agg.totalCost / agg.qty).toFixed(2)) : 0
      return { ...p, totalCost, avgUnitCost }
    })
    .sort((a,b)=>a.name.localeCompare(b.name))
  const addonsList = Object.entries(addonsMap).map(([name, v]) => ({ name, total: v.total, am: v.am })).sort((a,b)=>a.name.localeCompare(b.name))
  const proteinsByInitial = Object.entries(proteins).map(([k,v]) => ({ initial: k, total: v.total, am: v.am })).sort((a,b)=>a.initial.localeCompare(b.initial))

  // Compute kitchen tasks
  const sections: Record<string, { name: string; items: Record<string, { total: number; am: number }> }> = {
    'Cold kitchen': { name: 'Cold kitchen', items: {} },
    'Hot kitchen': { name: 'Hot kitchen', items: {} },
    'Desserts': { name: 'Desserts', items: {} },
    'Pre day prep': { name: 'Pre day prep', items: {} },
    'Bakery': { name: 'Bakery', items: {} },
  }

  const addItem = (cat: string | undefined | null, name: string, qty: number, am: boolean) => {
    if (!cat || !(cat in sections)) return
    const bucket = sections[cat]
    if (!bucket.items[name]) bucket.items[name] = { total: 0, am: 0 }
    bucket.items[name].total += qty
    if (am) bucket.items[name].am += qty
  }

  for (const o of orders) {
    const deliveryTime = firstTimeTo24((o as any).deliveryTime || '')
    const [hh, mm] = deliveryTime ? deliveryTime.split(':').map(Number) : [23, 59]
    const am = (hh * 60 + mm) <= cutoff
    const items = parseLineItems(o)
    for (const it of items) {
      const qty = Number(it.quantity || 0)
      const variantId = it.variant_id?.toString() || it.variantId?.toString()
      const product = variantId ? productsMap[variantId] : undefined
      if (!product || isAddon(it.sku)) continue
      // Expand bundles for task computation too
      const bundleChildren = resolveBundleItems(product)
      if (bundleChildren.length > 0) {
        for (const child of bundleChildren) {
          const childProduct = productsMap[child.variantId]
          if (!childProduct) continue
          const totalQty = (qty * child.quantity)
          const baseIngs = Array.isArray(childProduct.baseIngredients) ? childProduct.baseIngredients : []
          const variantIngs = Array.isArray(childProduct.ingredients) ? childProduct.ingredients : []
          const ings = [...baseIngs, ...variantIngs]
          for (const ing of ings) {
            const src = (ing.source || '').toString()
            const name = ing.name || ''
            const addQty = (Number(ing.quantity) || 0) * totalQty
            if (src === 'Components') {
              const found = componentsCatalog.find((c:any)=> (c?.id===ing.id) || ((c?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
              const prepCats = found?.prepCategories as any
              const categories = prepCats ? (Array.isArray(prepCats) ? prepCats : [prepCats]) : (found?.prepCategory ? [found.prepCategory] : [])
              for (const cat of categories) { addItem(cat as string, name, addQty, am) }
            } else if (src === 'Other') {
              const found = otherCatalog.find((p:any)=> (p?.id===ing.id) || ((p?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
              const prepCats = found?.prepCategories as any
              const categories = prepCats ? (Array.isArray(prepCats) ? prepCats : [prepCats]) : (found?.prepCategory ? [found.prepCategory] : [])
              for (const cat of categories) { addItem(cat as string, name, addQty, am) }
            }
          }
        }
        continue
      }
      
      const baseIngs = Array.isArray(product.baseIngredients) ? product.baseIngredients : []
      const variantIngs = Array.isArray(product.ingredients) ? product.ingredients : []
      const ings = [...baseIngs, ...variantIngs]
      
      for (const ing of ings) {
        const src = (ing.source || '').toString()
        const name = ing.name || ''
        const totalQty = (Number(ing.quantity) || 0) * qty
        if (src === 'Components') {
          const found = componentsCatalog.find((c:any)=> (c?.id===ing.id) || ((c?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
          const prepCats = found?.prepCategories as any
          const categories = prepCats ? (Array.isArray(prepCats) ? prepCats : [prepCats]) : (found?.prepCategory ? [found.prepCategory] : [])
          for (const cat of categories) {
            addItem(cat as string, name, totalQty, am)
          }
        } else if (src === 'Other') {
          const found = otherCatalog.find((p:any)=> (p?.id===ing.id) || ((p?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
          const prepCats = found?.prepCategories as any
          const categories = prepCats ? (Array.isArray(prepCats) ? prepCats : [prepCats]) : (found?.prepCategory ? [found.prepCategory] : [])
          for (const cat of categories) {
            addItem(cat as string, name, totalQty, am)
          }
        }
      }
    }
  }

  // Fetch next day orders for tomorrow prep
  const nextDay = addDays(date, 1)
  const nextDayStart = new Date(nextDay)
  nextDayStart.setHours(0, 0, 0, 0)
  const nextDayEnd = new Date(nextDay)
  nextDayEnd.setHours(23, 59, 59, 999)

  const nextDayOrdersRaw = await prisma.order.findMany({
    where: {
      deliveryDateResolved: {
        gte: nextDayStart,
        lte: nextDayEnd
      }
    }
  })

  const nextDayOrders = isWLG ? nextDayOrdersRaw.filter(isWellingtonOrder) : nextDayOrdersRaw.filter(o => !isWellingtonOrder(o))

  // Fetch products for next day
  const nextDayVariantIds = new Set<string>()
  nextDayOrders.forEach(o => {
    const items = parseLineItems(o)
    items.forEach(it => {
      const vid = it.variant_id || it.variantId
      if (vid) nextDayVariantIds.add(String(vid))
    })
  })

  const nextDayVariants = await prisma.productVariant.findMany({
    where: { variantId: { in: Array.from(nextDayVariantIds) } },
    include: {
      product: { select: { displayName: true, isPartyPackDefault: true, bundleDefaultItems: true } }
    }
  })

  const nextDayProductsMap: Record<string, any> = {}
  nextDayVariants.forEach(v => {
    nextDayProductsMap[v.variantId] = {
      ...v,
      productDisplayName: v.product.displayName,
      productIsPartyPackDefault: (v.product as any).isPartyPackDefault ?? false,
      productBundleDefaultItems: (v.product as any).bundleDefaultItems ?? null
    }
  })

  // Ensure next-day child variants are also present
  const nextChildIds = new Set<string>()
  nextDayVariants.forEach(v => {
    if ((v as any).isPartyPack && (v as any).bundleItems) {
      try {
        const arr = Array.isArray((v as any).bundleItems) ? (v as any).bundleItems : JSON.parse((v as any).bundleItems as any)
        arr.forEach((it: any) => { if (it?.variantId) nextChildIds.add(String(it.variantId)) })
      } catch {}
    }
    const pDefault = (v.product as any).isPartyPackDefault
    const pItems = (v.product as any).bundleDefaultItems
    if (pDefault && pItems) {
      try {
        const arr = Array.isArray(pItems) ? pItems : JSON.parse(pItems as any)
        arr.forEach((it: any) => { if (it?.variantId) nextChildIds.add(String(it.variantId)) })
      } catch {}
    }
  })
  Array.from(Object.keys(nextDayProductsMap)).forEach(id => nextChildIds.delete(id))
  if (nextChildIds.size > 0) {
    const extra = await prisma.productVariant.findMany({
      where: { variantId: { in: Array.from(nextChildIds) } },
      include: { product: { select: { displayName: true, baseIngredients: true, isPartyPackDefault: true, bundleDefaultItems: true } } }
    })
    extra.forEach(v => {
      nextDayProductsMap[v.variantId] = {
        ...v,
        productDisplayName: v.product.displayName,
        baseIngredients: v.product.baseIngredients,
        productIsPartyPackDefault: (v.product as any).isPartyPackDefault ?? false,
        productBundleDefaultItems: (v.product as any).bundleDefaultItems ?? null
      }
    })
  }

  // Compute next-day proteins and prep tasks
  let nextDaySummary = null
  if (nextDayOrders.length > 0) {
    const nextProteins: Record<string, { am: number; pm: number; total: number }> = {}
    for (const o of nextDayOrders) {
      const t = firstTimeTo24((o as any).deliveryTime || '')
      const isAm = toMinutes(t) <= cutoff
      const items = parseLineItems(o)
      for (const it of items) {
        const qty = Number(it.quantity || 0)
        const variantId = it.variant_id?.toString() || it.variantId?.toString()
        const product = variantId ? (nextDayProductsMap[variantId] || productsMap[variantId]) : undefined
        if (!product || isAddon(it.sku)) continue
        const initials = [product?.meat1, product?.meat2].filter(Boolean).map((s: string) => s!.trim()[0]?.toUpperCase()).filter(Boolean)
        for (const init of initials) {
          if (!nextProteins[init]) nextProteins[init] = { am: 0, pm: 0, total: 0 }
          nextProteins[init].total += qty
          if (isAm) nextProteins[init].am += qty
          else nextProteins[init].pm += qty
        }
      }
    }

    // Compute next-day bakery and prep tasks
    const nextSections: Record<string, { name: string; items: Record<string, { total: number; am: number }> }> = {
      'Bakery': { name: 'Bakery', items: {} },
      'Pre day prep': { name: 'Pre day prep', items: {} },
    }
    const addNextItem = (cat: string | undefined | null, name: string, qty: number, am: boolean) => {
      if (!cat || !(cat in nextSections)) return
      const bucket = nextSections[cat]
      if (!bucket.items[name]) bucket.items[name] = { total: 0, am: 0 }
      bucket.items[name].total += qty
      if (am) bucket.items[name].am += qty
    }

    for (const o of nextDayOrders) {
      const deliveryTime = firstTimeTo24((o as any).deliveryTime || '')
      const [hh, mm] = deliveryTime ? deliveryTime.split(':').map(Number) : [23, 59]
      const am = (hh * 60 + mm) <= cutoff
      const items = parseLineItems(o)
      for (const it of items) {
        const qty = Number(it.quantity || 0)
        const variantId = it.variant_id?.toString() || it.variantId?.toString()
        const product = variantId ? (nextDayProductsMap[variantId] || productsMap[variantId]) : undefined
        if (!product || isAddon(it.sku)) continue
        
        const baseIngs = Array.isArray(product.baseIngredients) ? product.baseIngredients : []
        const variantIngs = Array.isArray(product.ingredients) ? product.ingredients : []
        const ings = [...baseIngs, ...variantIngs]
        
        for (const ing of ings) {
          const src = (ing.source || '').toString()
          const name = ing.name || ''
          const totalQty = (Number(ing.quantity) || 0) * qty
          if (src === 'Components') {
            const found = componentsCatalog.find((c:any)=> (c?.id===ing.id) || ((c?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
            const prepCats = found?.prepCategories as any
            const categories = prepCats ? (Array.isArray(prepCats) ? prepCats : [prepCats]) : (found?.prepCategory ? [found.prepCategory] : [])
            for (const cat of categories) {
              if (cat === 'Bakery' || cat === 'Pre day prep') {
                addNextItem(cat as string, name, totalQty, am)
              }
            }
          } else if (src === 'Other') {
            const found = otherCatalog.find((p:any)=> (p?.id===ing.id) || ((p?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
            const prepCats = found?.prepCategories as any
            const categories = prepCats ? (Array.isArray(prepCats) ? prepCats : [prepCats]) : (found?.prepCategory ? [found.prepCategory] : [])
            for (const cat of categories) {
              if (cat === 'Bakery' || cat === 'Pre day prep') {
                addNextItem(cat as string, name, totalQty, am)
              }
            }
          }
        }
      }
    }

    const sumSection = (cat: string) => {
      const items = nextSections[cat]?.items || {}
      let am = 0, total = 0
      for (const v of Object.values(items)) { total += v.total; am += v.am }
      const pm = total - am
      return { am, pm, total }
    }

    const bakery = sumSection('Bakery')
    const prep = sumSection('Pre day prep')
    const bakeryItems = Object.entries(nextSections['Bakery']?.items || {}).map(([name, v]) => ({ name, am: (v as any).am, total: (v as any).total })).sort((a,b)=>a.name.localeCompare(b.name))
    const prepItems = Object.entries(nextSections['Pre day prep']?.items || {}).map(([name, v]) => ({ name, am: (v as any).am, total: (v as any).total })).sort((a,b)=>a.name.localeCompare(b.name))
    const proteinsList = Object.entries(nextProteins).map(([k,v]) => ({ initial: k, ...v })).sort((a,b)=>a.initial.localeCompare(b.initial))

    nextDaySummary = { bakery, prep, proteinsList, bakeryItems, prepItems }
  }

  return {
    date: format(date, 'EEEE, MMMM d, yyyy'),
    orderCount,
    boxesCount,
    servewareBoxes,
    productsList,
    addonsList,
    proteinsByInitial,
    tasksByCategory: sections,
    nextDaySummary,
    nextDayDate: nextDaySummary ? format(nextDay, 'EEEE, MMMM d, yyyy') : undefined
  }
}

