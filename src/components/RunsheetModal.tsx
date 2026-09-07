'use client'

import { useMemo, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { fetchProducts } from '@/lib/product-service'
import { resolveBundleItems } from '@/lib/product-service'

interface RunsheetModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date
  orders: any[]
  productsMap: Record<string, any>
  isWLG?: boolean
}

export function RunsheetModal({ isOpen, onClose, date, orders, productsMap, isWLG = false }: RunsheetModalProps) {
  const [nextDayOrders, setNextDayOrders] = useState<any[]>([])
  const [componentsCatalog, setComponentsCatalog] = useState<any[]>([])
  const [otherCatalog, setOtherCatalog] = useState<any[]>([])
  const [nextDayProductsMap, setNextDayProductsMap] = useState<Record<string, any>>({})
  const [rosterAssignments, setRosterAssignments] = useState<any[]>([])

  const isAddon = (sku?: string) => !!sku && (sku.startsWith('ADD') || sku.startsWith('AA'))
  
  const isWLGOrder = (order: any): boolean => {
    // 1) Check note_attributes City
    const noteProps = Array.isArray(order.noteAttributes) ? order.noteAttributes : (Array.isArray(order.note_attributes) ? order.note_attributes : [])
    const cityAttr = noteProps.find((p: any) => (p?.name || '').toLowerCase() === 'city')
    if (cityAttr && String(cityAttr.value || '').toUpperCase() === 'WLG') return true
    
    // 2) Fallback: line items properties
    let items: any[] = []
    if (Array.isArray(order.lineItems)) items = order.lineItems
    else if (typeof order.lineItems === 'string' && order.lineItems) {
      try { items = JSON.parse(order.lineItems) } catch { items = [] }
    }
    if (items.some(it => Array.isArray(it?.properties) && it.properties.some((p: any) => (p?.name || '').toLowerCase() === 'city' && String(p?.value).toUpperCase() === 'WLG'))) return true
    
    // 3) Fallback: shipping address
    const ship = order.shippingAddress || order.shipping_address || {}
    const shipCity = String(ship?.city || '').toLowerCase()
    const shipProvince = String(ship?.province || '').toLowerCase()
    const provinceCode = String(ship?.province_code || '').toUpperCase()
    
    if (shipCity.includes('wellington') || shipProvince === 'wellington' || provinceCode === 'WGN') return true
    
    return false
  }
  const firstTimeTo24 = (range: string) => {
    try {
      if (!range) return ''
      // Normalize to ASCII hyphen to avoid unicode parsing issues
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

  const formatAddressForCell = (shippingAddress: any) => {
    if (!shippingAddress) return 'No address'
    const addr = typeof shippingAddress === 'string' ? (() => {
      try { return JSON.parse(shippingAddress) } catch { return {} }
    })() : shippingAddress
    const parts = [addr.address1, addr.address2, addr.city].filter(Boolean)
    return parts.length ? parts.join(', ') : 'No address'
  }

  const extractOrderPhone = (order: any) => {
    const direct = order?.customerPhone || order?.customer_phone
    if (direct) return String(direct)
    const ship = order?.shippingAddress || order?.shipping_address || {}
    if (ship?.phone) return String(ship.phone)
    return 'No phone'
  }

  const formatDeliveryBadge = (order: any) => {
    const time = firstTimeTo24((order as any).deliveryTime || '')
    return time || (order?.deliveryTime ? String(order.deliveryTime) : 'No time')
  }

  const { orderCount, boxesCount, servewareBoxes, productsList, addonsList, proteinsByInitial } = useMemo(() => {
    const cutoff = 14 * 60
    const toMinutes = (hhmm: string) => { if (!hhmm) return 24*60; const [h,m] = hhmm.split(':').map(Number); return h*60+m }
    let orderCount = 0
    let boxesCount = 0
    let servewareBoxes = 0

    const productMap: Record<string, { total: number; am: number; name: string }> = {}
    const addonsMap: Record<string, { total: number; am: number }> = {}
    const proteins: Record<string, { total: number; am: number }> = {}

    for (const o of orders) {
      orderCount += 1
      const deliveryTime = firstTimeTo24((o as any).deliveryTime || (o as any).tags || '')
      const am = toMinutes(deliveryTime) <= cutoff
      const items = parseLineItems(o)
      for (const it of items) {
        const qty = Number(it.quantity || 0)
        const variantId = it.variant_id?.toString() || it.variantId?.toString()
        const product = variantId ? productsMap[variantId] : undefined
        // If pack, expand and count children as products
        if (product) {
          const children = resolveBundleItems(product)
          if (children.length > 0) {
            for (const child of children) {
              const childProduct = productsMap[child.variantId]
              if (!childProduct) continue
              const totalQty = qty * Math.max(1, Number(child.quantity || 1))
              // Addons list
              if (isAddon(childProduct?.shopifySku)) {
                const key = childProduct?.productDisplayName?.trim() ? childProduct.productDisplayName : (childProduct?.displayName?.trim() ? childProduct.displayName : (childProduct?.shopifyName && childProduct.shopifyName !== 'Default Title' ? childProduct.shopifyName : childProduct?.shopifyTitle))
                if (!addonsMap[key]) addonsMap[key] = { total: 0, am: 0 }
                addonsMap[key].total += totalQty
                if (am) addonsMap[key].am += totalQty
              } else {
                boxesCount += totalQty
                if (childProduct?.serveware) servewareBoxes += totalQty
                const name = childProduct?.productDisplayName?.trim() ? childProduct.productDisplayName : (childProduct?.displayName?.trim() ? childProduct.displayName : (childProduct?.shopifyName && childProduct.shopifyName !== 'Default Title' ? childProduct.shopifyName : childProduct?.shopifyTitle))
                if (!productMap[name]) productMap[name] = { total: 0, am: 0, name }
                productMap[name].total += totalQty
                if (am) productMap[name].am += totalQty
                const initials = [childProduct?.meat1, childProduct?.meat2].filter(Boolean).map((s: string) => s!.trim()[0]?.toUpperCase()).filter(Boolean)
                for (const init of initials) {
                  if (!proteins[init]) proteins[init] = { total: 0, am: 0 }
                  proteins[init].total += totalQty
                  if (am) proteins[init].am += totalQty
                }
              }
            }
            continue
          }
        }
        if (isAddon(it.sku)) {
          // Prefer productDisplayName for addons too
          const key = product?.productDisplayName?.trim() ? product.productDisplayName : (product?.displayName?.trim() ? product.displayName : (product?.shopifyName && product.shopifyName !== 'Default Title' ? product.shopifyName : it.title))
          if (!addonsMap[key]) addonsMap[key] = { total: 0, am: 0 }
          addonsMap[key].total += qty
          if (am) addonsMap[key].am += qty
          continue
        }
        boxesCount += qty
        if (product?.serveware) servewareBoxes += qty
        // Prefer productDisplayName (from parent ShopifyProduct) over variant displayName, then shopifyName
        const name = product?.productDisplayName?.trim() ? product.productDisplayName : (product?.displayName?.trim() ? product.displayName : (product?.shopifyName && product.shopifyName !== 'Default Title' ? product.shopifyName : product?.shopifyTitle || it.title))
        if (!productMap[name]) productMap[name] = { total: 0, am: 0, name }
        productMap[name].total += qty
        if (am) productMap[name].am += qty

        // Include option1/option2 selections as addon tallies
        const variantTitleRaw = (it.variant_title || (it as any).variantTitle || '').toString()
        if ((product?.option1 || product?.option2) && variantTitleRaw && variantTitleRaw !== 'Default Title') {
          const parts = variantTitleRaw.split('/').map((s: string) => s.trim()).filter(Boolean)
          const maybePush = (label?: string) => {
            if (!label || label === 'Default Title' || label === '-' ) return
            const k = label
            if (!addonsMap[k]) addonsMap[k] = { total: 0, am: 0 }
            addonsMap[k].total += qty
            if (am) addonsMap[k].am += qty
          }
          if (product?.option1 && parts[0]) maybePush(parts[0])
          if (product?.option2 && parts[1]) maybePush(parts[1])
        }

        const initials = [product?.meat1, product?.meat2].filter(Boolean).map((s: string) => s!.trim()[0]?.toUpperCase()).filter(Boolean)
        for (const init of initials) {
          if (!proteins[init]) proteins[init] = { total: 0, am: 0 }
          proteins[init].total += qty
          if (am) proteins[init].am += qty
        }
      }
    }

    const productsList = Object.values(productMap).sort((a,b)=>a.name.localeCompare(b.name))
    const addonsList = Object.entries(addonsMap).map(([name, v]) => ({ name, total: v.total, am: v.am })).sort((a,b)=>a.name.localeCompare(b.name))
    const proteinsByInitial = Object.entries(proteins).map(([k,v]) => ({ initial: k, total: v.total, am: v.am })).sort((a,b)=>a.initial.localeCompare(b.initial))

    return { orderCount, boxesCount, servewareBoxes, productsList, addonsList, proteinsByInitial }
  }, [orders, productsMap])

  useEffect(() => {
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    const y = next.getFullYear(); const m = String(next.getMonth()+1).padStart(2,'0'); const d = String(next.getDate()).padStart(2,'0')
    const key = `${y}-${m}-${d}`
    const load = async () => {
      try {
        const res = await fetch(`/api/orders?deliveryDateResolved=${key}&limit=10000`)
        if (res.ok) {
          const data = await res.json()
          let arr = Array.isArray(data) ? data : (Array.isArray(data.orders) ? data.orders : [])
          // Filter to WLG orders only if this is the WLG calendar
          if (isWLG) {
            arr = arr.filter(isWLGOrder)
          }
          setNextDayOrders(arr)
        } else {
          setNextDayOrders([])
        }
      } catch { setNextDayOrders([]) }
    }
    if (isOpen) load()
  }, [isOpen, date, isWLG])

  // Fetch products for next-day orders so proteins and sections compute correctly
  useEffect(() => {
    const loadNextProducts = async () => {
      try {
        const ids = new Set<string>()
        for (const o of nextDayOrders) {
          const items = parseLineItems(o)
          for (const it of items) {
            const vid = it.variant_id || it.variantId || it.variantid
            if (vid) ids.add(String(vid))
          }
        }
        if (ids.size > 0) {
          const map = await fetchProducts(Array.from(ids))
          setNextDayProductsMap(map || {})
        } else {
          setNextDayProductsMap({})
        }
      } catch {
        setNextDayProductsMap({})
      }
    }
    if (isOpen && nextDayOrders.length) {
      loadNextProducts()
    }
  }, [isOpen, nextDayOrders])

  const headerDate = useMemo(() => date.toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), [date])

  // Load catalogs for grouping tasks by prepCategory
  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, oRes] = await Promise.all([fetch('/api/components'), fetch('/api/other')])
        const cData = cRes.ok ? await cRes.json() : []
        const oData = oRes.ok ? await oRes.json() : { products: [] }
        const components = Array.isArray(cData) ? cData : (cData.components || [])
        const others = Array.isArray(oData) ? oData : (oData.products || [])
        console.log('📋 Runsheet loaded components catalog:', components.length, 'components')
        console.log('📋 Sample component:', components[0])
        setComponentsCatalog(components)
        setOtherCatalog(others)
      } catch {
        setComponentsCatalog([])
        setOtherCatalog([])
      }
    }
    if (isOpen) load()
  }, [isOpen])

  // Fetch roster assignments for the day
  useEffect(() => {
    const loadRoster = async () => {
      try {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        const dateString = `${y}-${m}-${d}`
        
        const res = await fetch(`/api/roster-assignments?date=${dateString}`)
        if (res.ok) {
          const data = await res.json()
          setRosterAssignments(Array.isArray(data.assignments) ? data.assignments : [])
        } else {
          setRosterAssignments([])
        }
      } catch {
        setRosterAssignments([])
      }
    }
    if (isOpen) loadRoster()
  }, [isOpen, date])

  // Group tasks by prepCategory (helper reused for today and tomorrow)
  const computeTasksByCategory = (ordersArr: any[], productsLookup: Record<string, any> = productsMap) => {
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
    const itemsForOrder = (o: any) => {
      const list = parseLineItems(o)
      const cutoff = 14 * 60
      const deliveryTime = firstTimeTo24((o as any).deliveryTime || (o as any).tags || '')
      const [hh, mm] = deliveryTime ? deliveryTime.split(':').map(Number) : [23, 59]
      const am = (hh * 60 + mm) <= cutoff
      for (const it of list) {
        const qty = Number(it.quantity || 0)
        const variantId = it.variant_id?.toString() || it.variantId?.toString()
        const product = variantId ? productsLookup[variantId] : undefined
        if (!product || isAddon(it.sku)) continue

        // Expand party pack bundles into child items (client-side UI runsheet)
        const bundleChildren = resolveBundleItems(product)
        if (bundleChildren.length > 0) {
          for (const child of bundleChildren) {
            const childProduct = productsLookup[child.variantId]
            if (!childProduct) continue
            const totalQty = qty * Math.max(1, Number(child.quantity || 1))
            const baseIngs = Array.isArray(childProduct.baseIngredients) ? childProduct.baseIngredients : []
            const variantIngs = Array.isArray(childProduct.ingredients) ? childProduct.ingredients : []
            const ings = [...baseIngs, ...variantIngs]
            for (const ing of ings) {
              const src = (ing.source || '').toString()
              const name = ing.name || ''
              const addQty = (Number(ing.quantity) || 0) * totalQty
              if (src === 'Components') {
                const found = componentsCatalog.find((c:any)=> (c?.id===ing.id) || ((c?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
                const categories = found?.prepCategories ? (Array.isArray(found.prepCategories) ? found.prepCategories : [found.prepCategories]) : (found?.prepCategory ? [found.prepCategory] : [])
                for (const cat of categories) { addItem(cat as string, name, addQty, am) }
              } else if (src === 'Other') {
                const found = otherCatalog.find((p:any)=> (p?.id===ing.id) || ((p?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
                const categories = found?.prepCategories ? (Array.isArray(found.prepCategories) ? found.prepCategories : [found.prepCategories]) : (found?.prepCategory ? [found.prepCategory] : [])
                for (const cat of categories) { addItem(cat as string, name, addQty, am) }
              }
            }
          }
          continue
        }
        // Combine base ingredients (from parent product) with variant-specific ingredients
        const baseIngs = Array.isArray(product.baseIngredients) ? product.baseIngredients : []
        const variantIngs = Array.isArray(product.ingredients) ? product.ingredients : []
        const ings = [...baseIngs, ...variantIngs]
        console.log(`🔍 Product ${product.shopifyName} (${variantId}) has ${baseIngs.length} base + ${variantIngs.length} variant = ${ings.length} total ingredients`)
        if (ings.length > 0) console.log('🔍 Sample ingredient:', ings[0])
        for (const ing of ings) {
          const src = (ing.source || '').toString()
          const name = ing.name || ''
          const totalQty = (Number(ing.quantity) || 0) * qty
          if (src === 'Components') {
            const found = componentsCatalog.find((c:any)=> (c?.id===ing.id) || ((c?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
            console.log(`🔍 Looking for component "${name}" (id: ${ing.id}), found:`, found ? `${found.name} with prepCategories: ${JSON.stringify(found.prepCategories)}` : 'NOT FOUND')
            // Support both prepCategories (array) and prepCategory (legacy single)
            const categories = found?.prepCategories ? (Array.isArray(found.prepCategories) ? found.prepCategories : [found.prepCategories]) : (found?.prepCategory ? [found.prepCategory] : [])
            console.log(`🔍 Categories to add to:`, categories)
            for (const cat of categories) {
              addItem(cat, name, totalQty, am)
            }
          } else if (src === 'Other') {
            const found = otherCatalog.find((p:any)=> (p?.id===ing.id) || ((p?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
            // Support both prepCategories (array) and prepCategory (legacy single)
            const categories = found?.prepCategories ? (Array.isArray(found.prepCategories) ? found.prepCategories : [found.prepCategories]) : (found?.prepCategory ? [found.prepCategory] : [])
            for (const cat of categories) {
              addItem(cat, name, totalQty, am)
            }
          }
        }
      }
    }
    for (const o of ordersArr) itemsForOrder(o)
    return sections
  }

  const tasksByCategory = useMemo(() => computeTasksByCategory(orders, productsMap), [orders, productsMap, componentsCatalog, otherCatalog])

  // Next-day summary (AM/PM)
  const nextDaySummary = useMemo(() => {
    if (!nextDayOrders || nextDayOrders.length === 0) return null
    const cutoff = 14 * 60
    const toMinutes = (hhmm: string) => { if (!hhmm) return 24*60; const [h,m] = hhmm.split(':').map(Number); return h*60+m }
    // Proteins by initial
    const proteins: Record<string, { am: number; pm: number; total: number }> = {}
    for (const o of nextDayOrders) {
      const t = firstTimeTo24((o as any).deliveryTime || (o as any).tags || '')
      const isAm = toMinutes(t) <= cutoff
      const items = parseLineItems(o)
      for (const it of items) {
        const qty = Number(it.quantity || 0)
        const variantId = it.variant_id?.toString() || it.variantId?.toString()
        const product = variantId ? (nextDayProductsMap[variantId] || productsMap[variantId]) : undefined
        if (!product || isAddon(it.sku)) continue
        const initials = [product?.meat1, product?.meat2].filter(Boolean).map((s: string) => s!.trim()[0]?.toUpperCase()).filter(Boolean)
        for (const init of initials) {
          if (!proteins[init]) proteins[init] = { am: 0, pm: 0, total: 0 }
          proteins[init].total += qty
          if (isAm) proteins[init].am += qty; else proteins[init].pm += qty
        }
      }
    }
    // Bakery and Pre day prep totals from tasks
    const sections = computeTasksByCategory(nextDayOrders, Object.keys(nextDayProductsMap || {}).length ? nextDayProductsMap : productsMap)
    const sumSection = (cat: string) => {
      const items = sections[cat]?.items || {}
      let am = 0, total = 0
      for (const v of Object.values(items)) { total += v.total; am += v.am }
      const pm = total - am
      return { am, pm, total }
    }
    const bakery = sumSection('Bakery')
    const prep = sumSection('Pre day prep')
    const bakeryItems = Object.entries(sections['Bakery']?.items || {}).map(([name, v]) => ({ name, am: (v as any).am, total: (v as any).total })).sort((a,b)=>a.name.localeCompare(b.name))
    const prepItems = Object.entries(sections['Pre day prep']?.items || {}).map(([name, v]) => ({ name, am: (v as any).am, total: (v as any).total })).sort((a,b)=>a.name.localeCompare(b.name))
    const proteinsList = Object.entries(proteins).map(([k,v]) => ({ initial: k, ...v })).sort((a,b)=>a.initial.localeCompare(b.initial))
    return { bakery, prep, proteinsList, bakeryItems, prepItems }
  }, [nextDayOrders, productsMap, componentsCatalog, otherCatalog])

  const printOrderCells = useMemo(() => {
    const cells = orders.map((order) => {
      const items = parseLineItems(order)
      const addons: string[] = []
      const products: string[] = []

      for (const item of items) {
        const qty = Number(item?.quantity || 1)
        const sku = String(item?.sku || '')
        const variantId = String(item?.variant_id || item?.variantId || '')
        const product = variantId ? productsMap[variantId] : undefined
        const displayName =
          product?.productDisplayName?.trim() ||
          product?.displayName?.trim() ||
          product?.shopifyName ||
          item?.title ||
          'Product'

        if (isAddon(sku)) {
          addons.push(`${qty}x ${displayName}`)
          continue
        }

        const meats = [product?.meat1, product?.meat2].filter(Boolean).join(' / ')
        const meta = meats ? ` - ${meats}` : ''
        products.push(`${qty}x ${displayName}${meta}`)
      }

      return {
        id: String(order?.id || order?.orderNumber || Math.random()),
        orderNumber: order?.orderNumber || 'N/A',
        customerName: `${order?.customerFirstName || ''} ${order?.customerLastName || ''}`.trim() || 'Customer',
        address: formatAddressForCell(order?.shippingAddress || order?.shipping_address),
        deliveryTime: formatDeliveryBadge(order),
        phone: extractOrderPhone(order),
        products,
        addons,
      }
    })

    return cells
  }, [orders, productsMap])

  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const runsheetPrintV2Html = useMemo(() => {
    const toRows = (items: Record<string, { total: number; am: number }>) => {
      const entries = Object.entries(items || {}).sort(([a], [b]) => a.localeCompare(b))
      if (!entries.length) return '<div class="empty-row">No items</div>'
      return entries
        .map(([name, q]) => `<div class="row"><span class="qty">${q.total}<sup>${q.am}</sup></span><span>${escapeHtml(name)}</span></div>`)
        .join('')
    }

    const productsRows = productsList.length
      ? productsList
          .map((p) => `<div class="row"><span class="qty">${p.total}<sup>${p.am}</sup></span><span>${escapeHtml(p.name)}</span></div>`)
          .join('')
      : '<div class="empty-row">No products</div>'

    const proteinsRows = proteinsByInitial.length
      ? proteinsByInitial
          .map((p) => `<div class="row"><span class="qty">${escapeHtml(p.initial)}</span><span>${p.total}<sup>${p.am}</sup></span></div>`)
          .join('')
      : '<div class="empty-row">No proteins</div>'

    const addonsRows = addonsList.length
      ? addonsList
          .map((a) => `<div class="row"><span class="qty">${a.total}<sup>${a.am}</sup></span><span>${escapeHtml(a.name)}</span></div>`)
          .join('')
      : '<div class="empty-row">No add-ons</div>'

    const rosterRows = rosterAssignments.length
      ? rosterAssignments
          .slice(0, 12)
          .map(
            (assignment: any) =>
              `<div class="roster-row"><strong>${escapeHtml(assignment.firstName || '')} ${escapeHtml((assignment.lastName || '').slice(0, 1))}.</strong> ${escapeHtml(assignment.startTime || '')}-${escapeHtml(assignment.endTime || '')}</div>`
          )
          .join('')
      : '<div class="empty-row">No staff rostered</div>'

    const orderCardRows = printOrderCells.length
      ? printOrderCells
          .map((cell) => {
            const products = cell.products.length
              ? cell.products.slice(0, 6).map((line) => `<div class="cell-product">${escapeHtml(line)}</div>`).join('')
              : '<div class="cell-product muted">No products</div>'
            const addons = cell.addons.length ? `<div class="cell-addons">Add-ons: ${escapeHtml(cell.addons.slice(0, 3).join(', '))}${cell.addons.length > 3 ? ' ...' : ''}</div>` : ''
            return `
              <article class="order-cell">
                <div class="cell-head">
                  <span>#${escapeHtml(cell.orderNumber)}</span>
                  <span>${escapeHtml(cell.deliveryTime)}</span>
                </div>
                <div class="cell-line cell-name">${escapeHtml(cell.customerName)}</div>
                <div class="cell-line">${escapeHtml(cell.address)}</div>
                <div class="cell-line">${escapeHtml(cell.phone)}</div>
                ${products}
                ${addons}
              </article>
            `
          })
          .join('')
      : '<div class="empty-row">No orders</div>'

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Runsheet Print v2 - ${escapeHtml(headerDate)}</title>
  <style>
    @page { size: landscape; margin: 6mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; }
    .sheet { width: 100%; }
    .topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin-bottom: 6px; }
    .title { font-size: 18px; font-weight: 700; }
    .kpis { display: flex; gap: 6px; }
    .kpi { min-width: 56px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; padding: 4px; text-align: center; }
    .kpi-label { font-size: 8px; text-transform: uppercase; color: #64748b; }
    .kpi-value { font-size: 16px; font-weight: 700; line-height: 1.15; }
    .layout { display: grid; grid-template-columns: 4.9fr 1.1fr; gap: 6px; align-items: start; }
    .left-grid { display: grid; grid-template-columns: 1fr 1.26fr 1fr 1.08fr; gap: 5px; }
    .shared-col { display: grid; grid-template-rows: 1fr 1fr; gap: 5px; min-height: 0; }
    .panel { background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px; min-height: 24px; }
    .panel-title { margin: 0 0 4px 0; font-size: 11px; color: #0369a1; font-weight: 700; }
    .rows { display: grid; gap: 1px; }
    .row { display: grid; grid-template-columns: 38px 1fr; gap: 4px; align-items: baseline; font-size: 10px; line-height: 1.18; }
    .qty { font-weight: 700; font-variant-numeric: tabular-nums; }
    .qty sup { font-size: 8px; margin-left: 1px; }
    .roster-row { font-size: 9px; line-height: 1.2; margin-bottom: 1px; }
    .orders-pages { break-before: page; page-break-before: always; }
    .orders-title { margin: 0 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; }
    .order-cells-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .order-cell { border: 1px solid #d1d5db; border-radius: 6px; padding: 4px; break-inside: avoid; page-break-inside: avoid; }
    .cell-head { display: flex; justify-content: space-between; gap: 4px; font-size: 10px; font-weight: 700; margin-bottom: 2px; }
    .cell-line { font-size: 8px; line-height: 1.2; margin-bottom: 1px; }
    .cell-name { font-weight: 700; }
    .cell-product { font-size: 8px; line-height: 1.2; margin-top: 1px; }
    .cell-addons { font-size: 7.5px; line-height: 1.2; margin-top: 2px; color: #334155; }
    .muted, .empty-row { color: #64748b; font-size: 9px; }
    .timesheet { margin: 0 0 6px 0; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar">
      <div>
        <div class="title">Runsheet — ${escapeHtml(headerDate)}</div>
        <div class="panel timesheet">
          <h3 class="panel-title">Time Sheet</h3>
          ${rosterRows}
        </div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-label">Boxes</div><div class="kpi-value">${boxesCount}</div></div>
        <div class="kpi"><div class="kpi-label">Orders</div><div class="kpi-value">${orderCount}</div></div>
        <div class="kpi"><div class="kpi-label">Serveware</div><div class="kpi-value">${servewareBoxes}</div></div>
      </div>
    </div>
    <section class="first-page">
      <div class="layout">
        <div class="left-grid">
          <section class="panel"><h3 class="panel-title">Products</h3><div class="rows">${productsRows}</div></section>
          <section class="panel"><h3 class="panel-title">Cold kitchen</h3><div class="rows">${toRows(tasksByCategory['Cold kitchen']?.items || {})}</div></section>
          <section class="panel"><h3 class="panel-title">Hot kitchen</h3><div class="rows">${toRows(tasksByCategory['Hot kitchen']?.items || {})}</div></section>
          <div class="shared-col">
            <section class="panel"><h3 class="panel-title">Desserts</h3><div class="rows">${toRows(tasksByCategory['Desserts']?.items || {})}</div></section>
            <section class="panel"><h3 class="panel-title">Pre day prep</h3><div class="rows">${toRows(tasksByCategory['Pre day prep']?.items || {})}</div></section>
          </div>
        </div>
        <div>
          <section class="panel"><h3 class="panel-title">Proteins</h3><div class="rows">${proteinsRows}</div></section>
          <section class="panel" style="margin-top: 5px;"><h3 class="panel-title">Add-ons</h3><div class="rows">${addonsRows}</div></section>
        </div>
      </div>
    </section>
    <section class="orders-pages">
      <h3 class="orders-title">Dispatch Order Cells</h3>
      <div class="order-cells-grid">${orderCardRows}</div>
    </section>
  </div>
</body>
</html>`
  }, [headerDate, rosterAssignments, boxesCount, orderCount, servewareBoxes, productsList, tasksByCategory, proteinsByInitial, addonsList, printOrderCells])

  const handlePrintV2 = () => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.width = '1px'
    iframe.style.height = '1px'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    iframe.style.bottom = '0'
    iframe.style.right = '0'

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove()
      }, 1000)
    }

    let printed = false
    const printWhenReady = () => {
      if (printed) return
      printed = true
      try {
        const frameWindow = iframe.contentWindow
        if (!frameWindow) {
          cleanup()
          return
        }
        frameWindow.focus()
        frameWindow.print()
      } finally {
        cleanup()
      }
    }

    iframe.onload = () => {
      const frameDoc = iframe.contentDocument
      const isReady = frameDoc?.readyState === 'complete' && (frameDoc.body?.children.length || 0) > 0
      if (!isReady) return
      window.setTimeout(printWhenReady, 120)
    }

    // Set srcdoc before attaching to avoid printing initial about:blank document
    iframe.srcdoc = runsheetPrintV2Html
    document.body.appendChild(iframe)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o)=>{ if(!o) onClose() }}>
      <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-[310mm]">
        <div className="bg-white p-6 rounded-lg runsheet-print-shell" style={{ width: '100%', maxWidth: '297mm', minHeight: 'auto' }}>
        <DialogHeader className="print-hide">
          <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 via-sky-500 to-sky-400 text-white px-4 py-3 rounded-md shadow">
            <div className="flex items-center gap-3">
              {/* Optional brand logo - place /public/caterstation-logo.png to display */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/caterstation-logo.png" alt="Cater Station" className="h-8 w-auto hidden sm:block" onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }} />
              <DialogTitle className="text-white text-xl sm:text-2xl">Runsheet — {headerDate}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button className="no-print bg-white/10 hover:bg-white/20 border-white/30" variant="outline" onClick={handlePrintV2}>
                Print v2 (beta)
              </Button>
              <Button className="no-print bg-white/10 hover:bg-white/20 border-white/30" variant="outline" onClick={() => window.print()}>
                Print (legacy)
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="runsheet relative z-10 space-y-5 bg-gray-50 p-5 rounded-lg h-[calc(210mm-70px)] overflow-auto">
          {/* Top row: Date — Time Sheet — KPI squares */}
          <div className="runsheet-top-grid grid grid-cols-[auto_1fr_80px_80px_80px] print:grid-cols-[auto_1fr_80px_80px_80px] gap-4 items-stretch">
            <div className="flex items-center">
              <div className="text-2xl font-semibold">{headerDate}</div>
            </div>
            <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm px-3 py-2 flex flex-col justify-start min-h-[80px]">
              <div className="font-semibold text-sky-700 text-sm mb-1.5">Time Sheet</div>
              <div className="flex-1 overflow-auto">
                {rosterAssignments.length > 0 ? (
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                    {rosterAssignments.slice(0, 9).map((assignment: any) => (
                      <div key={assignment.id} className="text-[10px] leading-tight">
                        <div className="font-medium">
                          {assignment.firstName} {assignment.lastName.charAt(0)}.
                        </div>
                        <div className="text-gray-600">
                          {assignment.startTime}-{assignment.endTime}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">No staff rostered</div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm flex flex-col items-center justify-center h-20 w-20">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Boxes</div>
              <div className="text-xl font-bold">{boxesCount}</div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm flex flex-col items-center justify-center h-20 w-20">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Orders</div>
              <div className="text-xl font-bold">{orderCount}</div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm flex flex-col items-center justify-center h-20 w-20">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Serveware</div>
              <div className="text-xl font-bold">{servewareBoxes}</div>
            </div>
          </div>

          {/* Main dashboard grid */}
          <div className="runsheet-main-grid grid grid-cols-[4.35fr_0.78fr] print:grid-cols-[4.35fr_0.78fr_2.35fr] gap-5">
            {/* Left: four columns - Products, Cold (wider), Hot, Shared (Desserts + Pre day prep) */}
            <div className="runsheet-left-grid grid grid-cols-1 md:grid-cols-[1fr_1.28fr_1fr_1.08fr] print:grid-cols-[1fr_1.28fr_1fr_1.08fr] gap-4">
              {/* Products column */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-2">
                <div className="font-semibold mb-2 text-sky-700">Products</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-1">
                  {productsList.map((p) => (
                    <div key={p.name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-[1.05rem] leading-tight">
                      <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p.total}
                        <sup className="ml-1 align-super text-[10px]">{p.am}</sup>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{p.name}</span>
                        {typeof (p as any).avgUnitCost === 'number' && typeof (p as any).totalCost === 'number' && (
                          <span className="text-xs text-gray-600 whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            ${((p as any).avgUnitCost ?? 0).toFixed(2)} avg • ${((p as any).totalCost ?? 0).toFixed(2)} total
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cold */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-2">
                <div className="font-semibold mb-2 text-sky-700">Cold kitchen</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-1">
                  {Object.entries(tasksByCategory['Cold kitchen'].items).map(([name, q]) => (
                    <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                      <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                      <div>{name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hot */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-2">
                <div className="font-semibold mb-2 text-sky-700">Hot kitchen</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-1">
                  {Object.entries(tasksByCategory['Hot kitchen'].items).map(([name, q]) => (
                    <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                      <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                      <div>{name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shared: Desserts + Pre day prep */}
              <div className="runsheet-shared-prep-column space-y-3">
                <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-2">
                  <div className="font-semibold mb-2 text-sky-700">Desserts</div>
                  <div className="space-y-1 max-h-[28vh] overflow-auto pr-1">
                    {Object.entries(tasksByCategory['Desserts'].items).map(([name, q]) => (
                      <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                        <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                        <div>{name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-2">
                  <div className="font-semibold mb-2 text-sky-700">Pre day prep</div>
                  <div className="space-y-1 max-h-[28vh] overflow-auto pr-1">
                    {Object.entries(tasksByCategory['Pre day prep'].items).map(([name, q]) => (
                      <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                        <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                        <div>{name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Proteins (narrow) + Addons underneath */}
            <div className="space-y-4">
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-4">
                <div className="font-semibold mb-2 text-sky-700">Proteins</div>
                <div className="space-y-1">
                  {proteinsByInitial.map(p => (
                    <div key={p.initial} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-base">
                      <span className="font-medium">{p.initial}</span>
                      <span className="font-normal" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.total}<sup className="ml-1 align-super text-[10px]">{p.am}</sup></span>
                    </div>
                  ))}
                  {/* Removed All row per request */}
                </div>
              </div>

              {addonsList.length > 0 && (
                <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-4">
                  <div className="font-semibold mb-2 text-sky-700">Addons</div>
                  <div className="space-y-1 max-h-[40vh] overflow-auto pr-2 text-sm">
                    {addonsList.map(a => (
                      <div key={a.name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline">
                        <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{a.total}<sup className="ml-1 align-super text-[10px]">{a.am}</sup></div>
                        <div>{a.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Print-only compact order cells rail */}
            <div className="runsheet-print-cells-rail hidden print:block bg-white border border-gray-200 rounded-lg p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 mb-2">
                Dispatch Order Cells
              </div>
              <div className="print-order-cells-list">
                {printOrderCells.map((cell) => (
                  <div key={cell.id} className="print-order-cell">
                    <div className="print-order-cell__head">
                      <span className="print-order-cell__order">#{cell.orderNumber}</span>
                      <span className="print-order-cell__time">{cell.deliveryTime}</span>
                    </div>
                    <div className="print-order-cell__line print-order-cell__name">{cell.customerName}</div>
                    <div className="print-order-cell__line">{cell.address}</div>
                    <div className="print-order-cell__line">{cell.phone}</div>
                    {cell.products.slice(0, 5).map((line, idx) => (
                      <div key={`${cell.id}-p-${idx}`} className="print-order-cell__product">{line}</div>
                    ))}
                    {cell.products.length > 5 ? (
                      <div className="print-order-cell__line">+{cell.products.length - 5} more products</div>
                    ) : null}
                    {cell.addons.length > 0 ? (
                      <div className="print-order-cell__addon">
                        Add-ons: {cell.addons.slice(0, 3).join(', ')}
                        {cell.addons.length > 3 ? ' ...' : ''}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tomorrow footer */}
          <div className="border-t pt-4 tomorrow-break">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tomorrow</div>
            {nextDaySummary ? (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-semibold text-sky-700 mb-1">Bakery</div>
                  <div className="mb-2">{nextDaySummary.bakery.am} / {nextDaySummary.bakery.pm} = <span className="font-medium">{nextDaySummary.bakery.total}</span></div>
                  <div className="space-y-1">
                    {nextDaySummary.bakeryItems.map(item => (
                      <div key={item.name} className="grid grid-cols-[auto_1fr] gap-2 items-baseline">
                        <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{item.am} / {item.total - item.am} = <span className="font-semibold">{item.total}</span></div>
                        <div>{item.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-sky-700 mb-1">Proteins</div>
                  <div className="space-y-1">
                    {nextDaySummary.proteinsList.map(p => (
                      <div key={p.initial}>{p.initial}: {p.am} / {p.pm} = <span className="font-medium">{p.total}</span></div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-sky-700 mb-1">Pre day prep</div>
                  <div className="mb-2">{nextDaySummary.prep.am} / {nextDaySummary.prep.pm} = <span className="font-medium">{nextDaySummary.prep.total}</span></div>
                  <div className="space-y-1">
                    {nextDaySummary.prepItems.map(item => (
                      <div key={item.name} className="grid grid-cols-[auto_1fr] gap-2 items-baseline">
                        <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{item.am} / {item.total - item.am} = <span className="font-semibold">{item.total}</span></div>
                        <div>{item.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">No next-day orders found.</div>
            )}
          </div>
        </div>

        </div>
      </DialogContent>
      
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 3mm;
          }
          
          html, body {
            background: #ffffff !important;
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Hide everything first, then selectively show */
          body * {
            visibility: hidden !important;
          }
          
          /* Remove Radix dialog positioning so it prints from top-left */
          [data-radix-dialog-content] {
            position: static !important;
            transform: none !important;
            inset: auto !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            box-shadow: none !important;
            background: transparent !important;
            border: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            visibility: visible !important; /* make sure container is visible */
          }

          .runsheet-print-shell {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            max-width: 100% !important;
            min-height: auto !important;
            border-radius: 0 !important;
            padding: 1.5mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }

          .runsheet {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 1.5mm !important;
            margin: 0 !important;
          }

          .runsheet-main-grid {
            grid-template-columns: 4.55fr 0.82fr 2.65fr !important;
            gap: 1.5mm !important;
            align-items: start !important;
          }

          .runsheet-left-grid {
            grid-template-columns: 1fr 1.24fr 1fr 1.08fr !important;
            gap: 1.25mm !important;
          }

          .runsheet-shared-prep-column {
            display: grid !important;
            grid-template-rows: 1fr 1fr !important;
            gap: 1.25mm !important;
            min-height: 0 !important;
          }

          .runsheet-top-grid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 1.5mm !important;
          }

          .runsheet-print-cells-rail {
            padding: 1.25mm !important;
            min-height: 0 !important;
          }
          
          /* Ensure overlay is hidden */
          [data-radix-dialog-overlay] {
            display: none !important;
          }
          
          /* Ensure only the runsheet content is visible and can flow across pages */
          .runsheet {
            width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            visibility: visible !important; /* show runsheet */
          }
          .runsheet * {
            max-height: none !important;
            overflow: visible !important;
            visibility: visible !important; /* show all children */
          }

          .print-order-cells-list {
            height: auto !important;
            max-height: none !important;
            column-count: 2;
            column-gap: 6px;
            column-fill: auto;
            overflow: visible !important;
          }

          .print-order-cell {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 6px;
            margin-bottom: 6px;
            background: #ffffff;
          }

          .print-order-cell__head {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            margin-bottom: 2px;
          }

          .print-order-cell__order {
            font-size: 10px;
            font-weight: 700;
          }

          .print-order-cell__time {
            font-size: 10px;
            font-weight: 700;
          }

          .print-order-cell__line {
            font-size: 8px;
            line-height: 1.18;
            margin-bottom: 1px;
            color: #1f2937;
          }

          .print-order-cell__name {
            font-weight: 700;
          }

          .print-order-cell__product {
            font-size: 8px;
            line-height: 1.15;
            color: #111827;
            margin-top: 1px;
          }

          .print-order-cell__addon {
            font-size: 7.5px;
            line-height: 1.15;
            margin-top: 2px;
            color: #374151;
          }
          
          /* Colors */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </Dialog>
  )
}

