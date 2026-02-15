'use client'

import { useEffect, useMemo, useState } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type ProductVariant = {
  id: string
  variantId: string
  productId: string
  shopifyProductId: string
  shopifySku?: string | null
  shopifyName: string
  shopifyTitle: string
  shopifyPrice: number
  displayName?: string | null
  shopifyVendor?: string | null
  shopifyMarket?: string | null
  heroImageUrl?: string | null
  ingredients?: any
  totalCost?: number
}

type Station = {
  id: string
  title: string
  imageUrl?: string
  variants: ProductVariant[]
}

type IngredientKey = { source?: string; code?: string; unit?: string }

export default function PricingLabPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [targetMargin, setTargetMargin] = useState<number>(0.7)
  const [regionId, setRegionId] = useState<string>('all')
  const [regionOptions, setRegionOptions] = useState<string[]>(['all'])
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [inspector, setInspector] = useState<any | null>(null)
  const [shopifyImageMap, setShopifyImageMap] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [childrenMap, setChildrenMap] = useState<Record<string, any[]>>({})
  const [compUnitCostMap, setCompUnitCostMap] = useState<Record<string, number>>({})
  const [editingText, setEditingText] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/products')
        if (!res.ok) throw new Error('Failed to load products')
        const productsData = await res.json()
        
        // Transform the new format (products with variants) to flat array of variants
        const allVariants: ProductVariant[] = []
        for (const product of productsData) {
          if (product.variants && Array.isArray(product.variants)) {
            for (const variant of product.variants) {
              // Transform variant to match expected interface
              allVariants.push({
                id: variant.id,
                variantId: variant.variantId,
                productId: variant.productId,
                shopifyProductId: product.shopifyProductId,
                shopifySku: variant.shopifySku,
                shopifyName: variant.shopifyName,
                shopifyTitle: variant.shopifyTitle,
                shopifyPrice: parseFloat(variant.shopifyPrice.toString()),
                displayName: variant.displayName,
                shopifyVendor: product.shopifyVendor,
                shopifyMarket: product.shopifyMarket,
                heroImageUrl: product.heroImageUrl,
                ingredients: variant.ingredients,
                totalCost: variant.totalCost
              })
            }
          }
        }
        
        // Group by shopifyTitle (family). Variants are shopifyName.
        const map = new Map<string, Station>()
        const tagSet = new Set<string>()
        for (const p of allVariants) {
          const key = p.shopifyTitle || 'Unknown'
          if (!map.has(key)) map.set(key, { id: key, title: key, variants: [] })
          map.get(key)!.variants.push(p)
          // capture a hero image to display for the station
          if (!map.get(key)!.imageUrl && p.heroImageUrl) {
            map.get(key)!.imageUrl = p.heroImageUrl || undefined
          }
          // collect markets from shopifyMarket (tags string)
          const market = (p.shopifyMarket || '').toString()
          if (market) {
            for (const raw of market.split(/[\s,\/|;]+/g)) {
              const t = raw.trim()
              if (t) tagSet.add(t)
            }
          }
        }
        const list = Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))
        setStations(list)
        setRegionOptions(['all', ...Array.from(tagSet).sort((a, b) => a.localeCompare(b))])
        if (list[0]) {
          setSelectedStationId(list[0].id)
          if (list[0].variants[0]) setSelectedVariantId(list[0].variants[0].variantId)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Best-effort: load Shopify products to map hero images by product id
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/shopify/products')
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : []
        const map: Record<string, string> = {}
        for (const p of list) {
          const id = String((p as any)?.product_id ?? '')
          const src = (p as any)?.product_image || ''
          if (id && src) map[id] = src
        }
        setShopifyImageMap(map)
      } catch {}
    }
    run()
  }, [])

  const includesTag = (market: string | null | undefined, tag: string) => {
    if (!tag || tag === 'all') return true
    const text = (market || '').toLowerCase()
    if (!text) return false
    const parts = text.split(/[\s,\/|;]+/g)
    return parts.includes(tag.toLowerCase()) || text.includes(tag.toLowerCase())
  }

  const visibleStations = useMemo(() => {
    if (regionId === 'all') return stations
    const filtered = stations
      .map(st => ({
        ...st,
        variants: st.variants.filter(v => includesTag(v.shopifyMarket, regionId))
      }))
      .filter(st => st.variants.length > 0)
    return filtered
  }, [stations, regionId])

  const selectedStation = useMemo(
    () => visibleStations.find(s => s.id === selectedStationId) || null,
    [visibleStations, selectedStationId]
  )

  useEffect(() => {
    if (selectedStation && selectedStation.variants.some(v => v.variantId === selectedVariantId)) return
    const first = visibleStations[0]
    setSelectedStationId(first ? first.id : null)
    setSelectedVariantId(first?.variants?.[0]?.variantId || null)
  }, [regionId, visibleStations])

  const encodeKey = (ink: IngredientKey) => `${ink.source || ''}|${ink.code || ''}|${(ink.unit || '').toLowerCase()}`
  const isComponentRef = (src?: string) => {
    const s = String(src || '').toLowerCase()
    return s.startsWith('component') || s === 'components' || s === 'component'
  }

  // Unit helpers for proportional scaling by component yield
  const normalizeToBase = (qty: number, unit?: string): { value: number; kind: 'mass' | 'volume' | 'unit' } => {
    const u = String(unit || '').toLowerCase()
    if (u === 'g') return { value: qty / 1000, kind: 'mass' }
    if (u === 'kg') return { value: qty, kind: 'mass' }
    if (u === 'ml') return { value: qty / 1000, kind: 'volume' }
    if (u === 'l') return { value: qty, kind: 'volume' }
    // default: treat as unit count
    return { value: qty, kind: 'unit' }
  }
  const computeScaleFromComponentUse = (
    parentQty: number,
    parentUnit: string | undefined,
    producedQty: number | undefined,
    producedUnit: string | undefined
  ) => {
    const a = normalizeToBase(Number(parentQty || 0), parentUnit)
    const b = normalizeToBase(Number(producedQty || 0), producedUnit)
    // If recipe yield is zero or invalid, avoid NaN; return 0 to drop children impact
    if (!isFinite(b.value) || b.value <= 0) return 0
    // If kinds differ (mass vs volume vs unit), still divide numerically; caller owns data sanity
    return a.value / b.value
  }

  // Optional: cache of fully expanded leaves per variant (not used to drive UI)
  const [variantLeaves, setVariantLeaves] = useState<Record<string, any[]>>({})
  const [flattenedIngredients, setFlattenedIngredients] = useState<any[]>([])

  useEffect(() => {
    if (!selectedStation) {
      setVariantLeaves({})
      return
    }
    const cache = new Map<string, any>() // componentId -> component

    const fetchComponent = async (id: string) => {
      if (cache.has(id)) return cache.get(id)
      const res = await fetch(`/api/components/${id}`)
      if (!res.ok) return null
      const data = await res.json()
      cache.set(id, data)
      return data
    }

    const expandLines = async (lines: any[], mult = 1): Promise<any[]> => {
      const out: any[] = []
      for (const line of (Array.isArray(lines) ? lines : [])) {
        const qty = Number(line.quantity || 0) * mult
        const unit = line.unit
        const src = String(line.source || '').toLowerCase()
        const isComponentRef = (src.startsWith('component') || src === 'components' || src === 'component') && line.id
        if (isComponentRef) {
          const comp = await fetchComponent(line.id)
          if (comp && Array.isArray(comp.ingredients)) {
            // Determine how much of the component batch we need relative to its produced output
            const scale = computeScaleFromComponentUse(qty, unit, comp.producedQuantity, comp.normalizedOutputUnit)
            const childLeaves = await expandLines(comp.ingredients, scale)
            out.push(...childLeaves)
          }
        } else {
          out.push({
            source: line.source,
            code: line.id || line.sku || line.productCode || line.code || line.handle || line.name,
            name: line.name,
            unit,
            quantity: qty,
            price: Number((line as any).price ?? line.cost ?? 0),
            raw: line,
          })
        }
      }
      return out
    }

    const run = async () => {
      const leavesMap: Record<string, any[]> = {}
      for (const v of selectedStation.variants) {
        const lines: any[] = Array.isArray(v.ingredients) ? v.ingredients : []
        const leaves = await expandLines(lines, 1)
        leavesMap[v.variantId] = leaves
      }
      setVariantLeaves(leavesMap)
    }
    run()
  }, [selectedStation])

  // When variant selection changes, refresh right panel to that variant's top-level lines
  useEffect(() => {
    if (!selectedVariantId) { setFlattenedIngredients([]); return }
    const v = selectedStation?.variants.find(x => x.variantId === selectedVariantId)
    const lines: any[] = Array.isArray(v?.ingredients) ? v!.ingredients : []
    const list = lines.map((line, idx) => ({
      key: encodeKey({ source: line.source, code: line.id || line.sku || line.productCode, unit: line.unit }),
      uid: `${encodeKey({ source: line.source, code: line.id || line.sku || line.productCode, unit: line.unit })}#${idx}`,
      source: line.source,
      code: line.id || line.sku || line.productCode,
      name: line.name,
      unit: line.unit,
      price: Number((line as any).cost ?? 0),
      quantity: Number(line.quantity || 0),
      raw: line,
    }))
    console.log('[PricingLab] variant selected', selectedVariantId, 'top-level lines', list.length)
    setFlattenedIngredients(list)
    setExpanded({})
    setChildrenMap({})
  }, [selectedVariantId, selectedStation])

  // Compute rows; prefer fully-expanded leaves so nested overrides roll up.
  const variantRows = useMemo(() => {
    if (!selectedStation) return []
    return selectedStation.variants.map(v => {
      const leaves = variantLeaves[v.variantId]
      let cost: number
      if (Array.isArray(leaves) && leaves.length > 0) {
        cost = leaves.reduce((sum: number, leaf: any) => {
          const key = encodeKey({ source: leaf.source, code: leaf.code, unit: leaf.unit })
          const unitPrice = overrides[key] ?? Number((leaf as any).price ?? leaf.cost ?? 0)
          const qty = Number(leaf.quantity || 0)
          return sum + unitPrice * qty
        }, 0)
      } else {
        // Fallback to top-level lines if leaves not ready
        const lines: any[] = Array.isArray(v.ingredients) ? v.ingredients : []
        cost = lines.reduce((sum: number, line: any) => {
          const key = encodeKey({ source: line.source, code: line.id || line.sku || line.productCode, unit: line.unit })
          const unitPrice = overrides[key] ?? Number((line as any).cost ?? 0)
          const qty = Number(line.quantity || 0)
          return sum + unitPrice * qty
        }, 0)
      }
      const rrpInclusive = Number(v.shopifyPrice || 0)
      const rrpEx = rrpInclusive / 1.15
      const margin = rrpEx > 0 ? (rrpEx - cost) / rrpEx : 0
      const targetRrpEx = cost / (1 - targetMargin)
      return { v, cost, rrpEx, margin, targetRrpEx }
    })
  }, [selectedStation, overrides, targetMargin, variantLeaves])

  const currency = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n)

  const loadChildren = async (row: any) => {
    if (!row?.code) return
    const existing = childrenMap[row.uid]
    if (existing) return
    try {
      const res = await fetch(`/api/components/${row.code}`)
      if (!res.ok) return
      const comp = await res.json()
      const ing: any[] = Array.isArray(comp?.ingredients) ? comp.ingredients : []
      // Store component cost per normalized output unit to allow accurate collapsed subtotal
      try {
        const produced = normalizeToBase(Number(comp?.producedQuantity ?? 0), comp?.normalizedOutputUnit)
        const perUnit = Number(comp?.costPerOutputUnit ?? (produced.value > 0 ? Number(comp?.totalCost ?? 0) / produced.value : 0))
        setCompUnitCostMap(prev => ({ ...prev, [row.uid]: perUnit }))
      } catch {}
      const scale = computeScaleFromComponentUse(Number(row.quantity || 0), row.unit, comp.producedQuantity, comp.normalizedOutputUnit)
      const mapped = ing.map((line: any, idx: number) => ({
        key: encodeKey({ source: line.source, code: line.id || line.sku || line.productCode, unit: line.unit }),
        uid: `${row.uid}/${encodeKey({ source: line.source, code: line.id || line.sku || line.productCode, unit: line.unit })}#${idx}`,
        source: line.source,
        code: line.id || line.sku || line.productCode,
        name: line.name,
        unit: line.unit,
        // child qty scaled by portion of component batch used
        quantity: Number(line.quantity || 0) * scale,
        price: Number((line as any).cost ?? 0),
        raw: line,
      }))
      setChildrenMap(prev => ({ ...prev, [row.uid]: mapped }))
      console.log('[PricingLab] loaded children for', row.uid, 'count', mapped.length)
    } catch {}
  }

  const resolveUnitPrice = (row: any) => {
    if (isComponentRef(row.source)) return null
    const ov = overrides[row.key]
    return ov != null ? ov : Number(row.price || 0)
  }

  const computeComponentSubtotal = (row: any): number | null => {
    if (!isComponentRef(row.source)) return null
    const kids = childrenMap[row.uid]
    if (!kids) return null
    return kids.reduce((sum, k) => {
      const unit = resolveUnitPrice(k) ?? 0
      return sum + unit * Number(k.quantity || 0)
    }, 0)
  }

  const getCodeSkuForDisplay = (row: any): string => {
    const src = String(row?.source || '').toLowerCase()
    if (src === 'gilmours') {
      return String(row?.raw?.sku || row?.sku || '')
    }
    if (src === 'bidfood') {
      return String(row?.raw?.productCode || row?.productCode || row?.raw?.code || '')
    }
    if (src === 'components' || src.startsWith('component') || src === 'other') {
      return ''
    }
    return ''
  }

  const Row = ({ row, depth }: { row: any; depth: number }) => {
    const isComp = isComponentRef(row.source)
    const subtotal = computeComponentSubtotal(row)
    // Preload children for components so collapsed rows can show true subtotal
    useEffect(() => {
      if (isComp && !childrenMap[row.uid]) {
        // Fire and forget; avoids UI jitter but ensures values soon reflect
        void loadChildren(row)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isComp, row.uid])
    return (
      <>
        <tr className="border-b">
          <td className="px-3 py-2 whitespace-nowrap">{row.source}</td>
          <td className="px-3 py-2 whitespace-nowrap">{getCodeSkuForDisplay(row)}</td>
          <td className="px-3 py-2">
            <div style={{ paddingLeft: depth * 12 }} className="flex items-center gap-2">
              {isComp && (
                <button
                  className="text-xs border rounded px-1"
                  onClick={async ()=>{
                    const next = !expanded[row.uid]
                    setExpanded(prev => ({ ...prev, [row.uid]: next }))
                    if (next && !childrenMap[row.uid]) await loadChildren(row)
                    console.log('[PricingLab] toggle', row.uid, 'expanded =>', next)
                  }}
                >
                  {expanded[row.uid] ? '▾' : '▸'}
                </button>
              )}
              <button className="underline" onClick={()=>setInspector(row)}>{row.name}</button>
            </div>
          </td>
          <td className="px-3 py-2 whitespace-nowrap">{row.unit}</td>
          <td className="px-3 py-2 whitespace-nowrap">
            {isComp ? (
              expanded[row.uid]
                ? (subtotal != null ? currency(subtotal) : '—')
                : (
                    compUnitCostMap[row.uid] != null
                      ? (() => {
                          const usage = normalizeToBase(Number(row.quantity || 0), row.unit).value
                          return currency(compUnitCostMap[row.uid] * usage)
                        })()
                      : (
                          childrenMap[row.uid]
                            ? (subtotal != null ? currency(subtotal) : '—')
                            : currency(Number(row.price || 0) * Number(row.quantity || 0))
                        )
                  )
            ) : (
              currency(resolveUnitPrice(row) ?? 0)
            )}
          </td>
          <td className="px-3 py-2 whitespace-nowrap">
            {isComp ? (
              <span className="text-gray-400">n/a</span>
            ) : (
              <input
                type="number"
                step="0.01"
                className="w-28 border rounded px-2 py-1"
                value={editingText[row.key] ?? (overrides[row.key] != null ? String(overrides[row.key]) : '')}
                onChange={e=>{
                  const txt = e.target.value
                  setEditingText(prev => ({ ...prev, [row.key]: txt }))
                }}
                onBlur={e=>{
                  const txt = e.target.value
                  setEditingText(prev => ({ ...prev, [row.key]: txt }))
                  const val = txt === '' ? undefined : Number(txt)
                  setOverrides(prev => {
                    const next = { ...prev }
                    if (val == null || Number.isNaN(val)) delete next[row.key]
                    else next[row.key] = val
                    return next
                  })
                }}
                onKeyDown={e=>{
                  if (e.key === 'Enter') {
                    ;(e.target as HTMLInputElement).blur()
                  }
                  if (e.key === 'Escape') {
                    setEditingText(prev => {
                      const next = { ...prev }
                      delete next[row.key]
                      return next
                    })
                  }
                }}
              />
            )}
          </td>
        </tr>
        {expanded[row.uid] && Array.isArray(childrenMap[row.uid]) && childrenMap[row.uid].map(child => (
          <Row key={child.uid} row={child} depth={depth+1} />
        ))}
      </>
    )
  }

  if (loading) return <div className="p-6">Loading Pricing Lab…</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Pricing Lab</h1>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <label>Region</label>
          <select value={regionId} onChange={e=>setRegionId(e.target.value)} className="border rounded px-2 py-1">
            {regionOptions.map(opt => (
              <option key={opt} value={opt}>{opt === 'all' ? 'All regions' : opt}</option>
            ))}
          </select>
          <label>Target margin</label>
          <input type="number" step="0.05" min="0" max="0.95" value={targetMargin} onChange={e=>setTargetMargin(Number(e.target.value))} className="w-20 border rounded px-2 py-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-6">
        {/* Left column: stations only */}
        <div className="space-y-4 max-h-[70vh] overflow-auto">
          {/* Stations grid (shopifyTitle) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {visibleStations.map(st => (
              <button key={st.id} onClick={()=>{setSelectedStationId(st.id); setSelectedVariantId(st.variants[0]?.variantId || null)}} className={`border rounded p-3 text-left hover:bg-gray-50 ${selectedStationId===st.id?'border-blue-500':'border-gray-200'}`}>
                <div className="aspect-[4/3] bg-gray-100 rounded mb-2 overflow-hidden">
                  {(() => {
                    const pid = st.variants?.[0]?.shopifyProductId
                    const src = pid ? (shopifyImageMap[String(pid)] || st.imageUrl || '') : (st.imageUrl || '')
                    return src ? (<img src={src} alt="" className="w-full h-full object-cover" />) : null
                  })()}
                </div>
                <div className="font-medium text-sm truncate">{st.title}</div>
                <div className="text-xs text-gray-500">{st.variants.length} variants</div>
              </button>
            ))}
          </div>
        </div>
        {/* Right column: variants (top) + ingredient overrides (bottom) */}
        <div className="space-y-4 max-h-[70vh] overflow-auto">
          {/* Variants table */}
          <div className="border rounded">
            <div className="px-3 py-2 text-sm font-medium border-b bg-gray-50">Variants</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2">COST (ex GST)</th>
                  <th className="px-3 py-2">RRP (ex GST)</th>
                  <th className="px-3 py-2">Margin</th>
                  <th className="px-3 py-2">Target @ {Math.round(targetMargin*100)}% (ex GST)</th>
                </tr>
              </thead>
              <tbody>
                {variantRows.map(({ v, cost, rrpEx, margin, targetRrpEx }) => (
                  <tr key={v.variantId} className={`border-b hover:bg-gray-50 cursor-pointer ${selectedVariantId===v.variantId?'bg-blue-50':''}`} onClick={()=>setSelectedVariantId(v.variantId)}>
                    <td className="px-3 py-2 whitespace-nowrap">{v.shopifyName || v.shopifyTitle}</td>
                    <td className="px-3 py-2">{currency(cost)}</td>
                    <td className="px-3 py-2">{currency(rrpEx)}</td>
                    <td className="px-3 py-2" style={{color: margin >= targetMargin ? '#059669' : '#dc2626'}}>{(margin*100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{currency(targetRrpEx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ingredient overrides */}
          <div className="border rounded h-full">
            <div className="px-3 py-2 text-sm font-medium border-b bg-gray-50 flex items-center justify-between">
              <span>Ingredient Prices (in-memory overrides)</span>
              <button className="text-xs border rounded px-2 py-1" onClick={()=>setOverrides({})}>Reset</button>
            </div>
            <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Code/SKU</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Current</th>
                  <th className="px-3 py-2">Override</th>
                </tr>
              </thead>
              <tbody>
                {flattenedIngredients.map(row => (
                  <Row key={row.uid} row={row} depth={0} />
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
      {inspector && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={()=>setInspector(null)}>
          <div className="bg-white rounded shadow-lg max-w-lg w-full p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Raw Item Data</h3>
              <button className="text-xs border rounded px-2 py-1" onClick={()=>setInspector(null)}>Close</button>
            </div>
            <pre className="text-xs bg-gray-50 rounded p-2 max-h-[60vh] overflow-auto">{JSON.stringify(inspector?.raw || inspector, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}


