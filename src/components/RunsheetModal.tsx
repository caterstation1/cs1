'use client'

import { useMemo, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { fetchProducts } from '@/lib/product-service'

interface RunsheetModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date
  orders: any[]
  productsMap: Record<string, any>
}

export function RunsheetModal({ isOpen, onClose, date, orders, productsMap }: RunsheetModalProps) {
  const [nextDayOrders, setNextDayOrders] = useState<any[]>([])
  const [componentsCatalog, setComponentsCatalog] = useState<any[]>([])
  const [otherCatalog, setOtherCatalog] = useState<any[]>([])
  const [nextDayProductsMap, setNextDayProductsMap] = useState<Record<string, any>>({})
  const [rosterAssignments, setRosterAssignments] = useState<any[]>([])

  const isAddon = (sku?: string) => !!sku && (sku.startsWith('ADD') || sku.startsWith('AA'))
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
        if (isAddon(it.sku)) {
          const key = product?.displayName?.trim() ? product.displayName : (product?.shopifyName && product.shopifyName !== 'Default Title' ? product.shopifyName : it.title)
          if (!addonsMap[key]) addonsMap[key] = { total: 0, am: 0 }
          addonsMap[key].total += qty
          if (am) addonsMap[key].am += qty
          continue
        }
        boxesCount += qty
        if (product?.serveware) servewareBoxes += qty
        const name = product?.displayName?.trim() ? product.displayName : (product?.shopifyName && product.shopifyName !== 'Default Title' ? product.shopifyName : product?.shopifyTitle || it.title)
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
          const arr = Array.isArray(data) ? data : (Array.isArray(data.orders) ? data.orders : [])
          setNextDayOrders(arr)
        } else {
          setNextDayOrders([])
        }
      } catch { setNextDayOrders([]) }
    }
    if (isOpen) load()
  }, [isOpen, date])

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
        // walk ingredients
        const ings = Array.isArray(product.ingredients) ? product.ingredients : []
        for (const ing of ings) {
          const src = (ing.source || '').toString()
          const name = ing.name || ''
          const totalQty = (Number(ing.quantity) || 0) * qty
          if (src === 'Components') {
            const found = componentsCatalog.find((c:any)=> (c?.id===ing.id) || ((c?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
            addItem(found?.prepCategory, name, totalQty, am)
          } else if (src === 'Other') {
            const found = otherCatalog.find((p:any)=> (p?.id===ing.id) || ((p?.name||'').toLowerCase().trim()===(name||'').toLowerCase().trim()))
            addItem(found?.prepCategory, name, totalQty, am)
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

  return (
    <Dialog open={isOpen} onOpenChange={(o)=>{ if(!o) onClose() }}>
      <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-[310mm]">
        <div id="print-root" className="a4-page relative mx-auto" style={{ width: '297mm', height: '210mm' }}>
        {/* Watermark logo (prints only, behind content) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/caterstation-logo.png" alt="Cater Station" className="pointer-events-none select-none absolute top-6 left-6 opacity-10 hidden print:block" style={{ width: '260mm', zIndex: 0 }} onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }} />
        {/* Secondary subtle watermark near the date */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/caterstation-logo.png" alt="Cater Station" className="pointer-events-none select-none absolute hidden print:block" style={{ top: '22mm', left: '8mm', width: '120mm', opacity: 0.08 as any, zIndex: 0 }} onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }} />
        <DialogHeader className="print-hide">
          <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 via-sky-500 to-sky-400 text-white px-4 py-3 rounded-md shadow">
            <div className="flex items-center gap-3">
              {/* Optional brand logo - place /public/caterstation-logo.png to display */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/caterstation-logo.png" alt="Cater Station" className="h-8 w-auto hidden sm:block" onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }} />
              <DialogTitle className="text-white text-xl sm:text-2xl">Runsheet — {headerDate}</DialogTitle>
            </div>
            <Button className="no-print bg-white/10 hover:bg-white/20 border-white/30" variant="outline" onClick={() => window.print()}>Print</Button>
          </div>
        </DialogHeader>
        <div className="runsheet relative z-10 space-y-5 bg-gray-50 p-5 rounded-lg h-[calc(210mm-70px)] overflow-auto">
          {/* Top row: Date — Time Sheet — KPI squares */}
          <div className="grid grid-cols-[auto_1fr_80px_80px_80px] print:grid-cols-[auto_1fr_80px_80px_80px] gap-4 items-stretch">
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
          <div className="grid grid-cols-[4.2fr_0.72fr] print:grid-cols-[4.2fr_0.72fr] gap-5">
            {/* Left: five columns */}
            <div className="grid grid-cols-1 md:grid-cols-5 print:grid-cols-5 gap-4">
              {/* Products column */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-4">
                <div className="font-semibold mb-2 text-sky-700">Products</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-2">
                  {productsList.map((p) => (
                    <div key={p.name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-[1.05rem] leading-tight">
                      <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p.total}
                        <sup className="ml-1 align-super text-[10px]">{p.am}</sup>
                      </div>
                      <div>{p.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cold */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-4">
                <div className="font-semibold mb-2 text-sky-700">Cold kitchen</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-2">
                  {Object.entries(tasksByCategory['Cold kitchen'].items).map(([name, q]) => (
                    <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                      <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                      <div>{name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hot */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-4">
                <div className="font-semibold mb-2 text-sky-700">Hot kitchen</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-2">
                  {Object.entries(tasksByCategory['Hot kitchen'].items).map(([name, q]) => (
                    <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                      <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                      <div>{name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desserts */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-4">
                <div className="font-semibold mb-2 text-sky-700">Desserts</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-2">
                  {Object.entries(tasksByCategory['Desserts'].items).map(([name, q]) => (
                    <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                      <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                      <div>{name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pre day prep */}
              <div className="bg-sky-50 rounded-lg border border-sky-200 shadow-sm p-4">
                <div className="font-semibold mb-2 text-sky-700">Pre day prep</div>
                <div className="space-y-1 max-h-[60vh] overflow-auto pr-2">
                  {Object.entries(tasksByCategory['Pre day prep'].items).map(([name, q]) => (
                    <div key={name} className="grid grid-cols-[3ch_auto] gap-2 items-baseline text-sm">
                      <div className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{(q as any).total}<sup className="ml-1 align-super text-[10px]">{(q as any).am}</sup></div>
                      <div>{name}</div>
                    </div>
                  ))}
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

        {/* Print: Landscape page setup */}
        <style jsx global>{`
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            /* Print only our runsheet content and collapse everything else to avoid extra pages */
            body * { visibility: hidden !important; height: 0 !important; }
            #print-root, #print-root * { visibility: visible !important; height: auto !important; }
            #print-root { position: static !important; width: 297mm !important; height: auto !important; overflow: visible !important; }
            .runsheet { background: white !important; padding: 0 !important; overflow: visible !important; }
            .no-print { display: none !important; }
            .print-hide { display: none !important; }
            body, #print-root, .runsheet, .runsheet * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            /* Force tomorrow section onto a new page */
            .tomorrow-break { break-before: page; page-break-before: always; break-inside: avoid-page; page-break-inside: avoid; }
          }
        `}</style>
        </div>
      </DialogContent>
    </Dialog>
  )
}

