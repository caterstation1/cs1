'use client'

// Pricing Lab — operator price sheets, in the Recipe Builder shell.
//
// Product costs come from /api/pricing/lab/* (costVariant on the server). The
// only arithmetic in this file is pack-price → unit-cost preview so an
// operator can see what they just typed before they save. Saving writes a
// PriceSheet and nothing else.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CatalogList, Kpi, money, pct } from '@/components/pricing-ui'
import { deriveSheetUnitCost } from '@/lib/pricing/sheet-math'
import '@/styles/pricing-shell.css'
import './pricing-lab.css'

type CatalogueSource = 'Gilmours' | 'Bidfood' | 'ProduceCo' | 'Other'
type SizeUnit = 'kg' | 'g' | 'l' | 'ml' | 'each'
type CatTab = 'stations' | 'ingredients'

interface PriceSheet {
  id: string
  name: string
  notes: string | null
  entryCount: number
}

interface LabVariant {
  variantId: string
  name: string
  sku: string | null
  cost: number | null
  rrpInclGst: number
  rrpEx: number
  margin: number | null
  targetRrpEx: number | null
  belowTarget: boolean
  coveragePct: number
  resolvedLines: number
  totalLines: number
  isPartyPack: boolean
}

interface LabStation {
  id: string
  title: string
  heroImageUrl: string | null
  market: string | null
  margin: number | null
  belowTarget: boolean
  variants: LabVariant[]
}

interface CatalogPayload {
  stations: LabStation[]
  markets: string[]
  settings: { targetMargin: number; gstRate: number }
}

interface IngredientYours {
  supplierName: string | null
  packPrice: number
  unitsPerPack: number
  sizePerUnit: number
  sizeUnit: string
}

interface LabIngredient {
  key: string
  source: CatalogueSource
  sourceId: string
  code: string | null
    name: string
  packSize: string | null
  uom: string | null
  ctnQty: string | null
  unitCost: number | null
  unitCostUnit: string | null
  reason: string | null
  suggestedPack: { unitsPerPack: number; sizePerUnit: number; sizeUnit: string } | null
  recipeCount: number
  usedIn: Array<{ type: 'component' | 'variant'; id: string; name: string }>
  yours: IngredientYours | null
}

interface Draft {
  source: CatalogueSource
  sourceId: string
  supplierName: string
  packPrice: number | null
  unitsPerPack: number
  sizePerUnit: number
  sizeUnit: SizeUnit
}

interface TreeNode {
  path: string
  kind: 'ingredient' | 'component'
  source: string
  refId: string
  origin: string
  name: string
  quantity: number
  unit: string | null
  unitCost: number | null
  unitCostUnit: string | null
  lineCost: number | null
  supplier: string | null
  provenance: string | null
  reason: string | null
  note: string | null
  children?: TreeNode[]
}

interface RecipePayload {
  summary: {
    name: string
    subtitle: string
    totalCost: number | null
    rrpEx: number | null
    margin: number | null
    targetMargin?: number
    targetRrpEx: number | null
    coverage: { resolvedLines: number; totalLines: number; pct: number }
    reasons: string[]
  }
  nodes: TreeNode[]
}

interface ImpactRow {
  id: string
  name: string
  costBefore: number | null
  costAfter: number | null
  marginBefore: number | null
  marginAfter: number | null
}

const SIZE_UNITS: SizeUnit[] = ['kg', 'g', 'l', 'ml', 'each']
const STATION_ROW_H = 50
const INGREDIENT_ROW_H = 50

const matches = (name: string, extra: string | null, q: string) =>
  name.toLowerCase().includes(q) || (extra ?? '').toLowerCase().includes(q)

  const includesTag = (market: string | null | undefined, tag: string) => {
    if (!tag || tag === 'all') return true
    const text = (market || '').toLowerCase()
    if (!text) return false
  const parts = text.split(/[\s,/|;]+/g)
    return parts.includes(tag.toLowerCase()) || text.includes(tag.toLowerCase())
  }

const asSizeUnit = (value: string | null | undefined): SizeUnit =>
  SIZE_UNITS.includes(value as SizeUnit) ? (value as SizeUnit) : 'each'

const draftKey = (source: string, sourceId: string) => `${source}:${sourceId}`

function draftEqualsSaved(draft: Draft, saved: IngredientYours | null): boolean {
  if (!saved) return draft.packPrice == null
  return (
    draft.packPrice === saved.packPrice &&
    draft.unitsPerPack === saved.unitsPerPack &&
    draft.sizePerUnit === saved.sizePerUnit &&
    draft.sizeUnit === asSizeUnit(saved.sizeUnit) &&
    (draft.supplierName || '') === (saved.supplierName || '')
  )
}

export default function PricingLabPage() {
  const [sheets, setSheets] = useState<PriceSheet[]>([])
  const [sheetId, setSheetId] = useState<string>('')
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')

  const [catalog, setCatalog] = useState<CatalogPayload | null>(null)
  const [preview, setPreview] = useState<CatalogPayload | null>(null)
  const [ingredients, setIngredients] = useState<LabIngredient[]>([])
  const [recipe, setRecipe] = useState<RecipePayload | null>(null)

  const [catTab, setCatTab] = useState<CatTab>('stations')
  const [search, setSearch] = useState('')
  const [regionId, setRegionId] = useState('all')
  const [includePartyPacks, setIncludePartyPacks] = useState(false)
  const [selStationId, setSelStationId] = useState<string | null>(null)
  const [selVariantId, setSelVariantId] = useState<string | null>(null)
  const [selIngredientKey, setSelIngredientKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<{ text: string; bad: boolean } | null>(null)

  const draftList = useMemo(() => Object.values(drafts), [drafts])
  const dirty = draftList.length > 0
  const targetMargin = (preview ?? catalog)?.settings.targetMargin ?? 0.7

  const loadSheets = useCallback(async () => {
    const res = await fetch('/api/pricing/lab/sheets')
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Sheets failed (${res.status})`)
    const data = await res.json()
    const list: PriceSheet[] = data.sheets ?? []
    setSheets(list)
    return list
  }, [])

  const loadCatalog = useCallback(async (sid: string, packs: boolean) => {
    const qs = new URLSearchParams()
    if (sid) qs.set('sheetId', sid)
    if (packs) qs.set('includePartyPacks', 'true')
    const res = await fetch(`/api/pricing/lab/catalog?${qs}`)
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Catalog failed (${res.status})`)
    const data: CatalogPayload = await res.json()
    setCatalog(data)
    setPreview(null)
    return data
  }, [])

  const loadIngredients = useCallback(async (sid: string) => {
    const qs = sid ? `?sheetId=${encodeURIComponent(sid)}` : ''
    const res = await fetch(`/api/pricing/lab/ingredients${qs}`)
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Ingredients failed (${res.status})`)
    const data = await res.json()
    setIngredients(data.ingredients ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const list = await loadSheets()
        if (cancelled) return
        const first = list[0]?.id ?? ''
        setSheetId(first)
        const [data] = await Promise.all([loadCatalog(first, false), loadIngredients(first)])
        if (cancelled) return
        if (data.stations[0]) {
          setSelStationId(data.stations[0].id)
          setSelVariantId(data.stations[0].variants[0]?.variantId ?? null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load Pricing Lab')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadSheets, loadCatalog, loadIngredients])

  const reloadForFilters = useCallback(
    async (sid: string, packs: boolean) => {
      setBusy(true)
      setError(null)
      try {
        const data = await loadCatalog(sid, packs)
        const still = data.stations.find((s) => s.id === selStationId)
        if (still) {
          if (!still.variants.some((v) => v.variantId === selVariantId)) {
            setSelVariantId(still.variants[0]?.variantId ?? null)
          }
        } else if (data.stations[0]) {
          setSelStationId(data.stations[0].id)
          setSelVariantId(data.stations[0].variants[0]?.variantId ?? null)
        } else {
          setSelStationId(null)
          setSelVariantId(null)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reload catalog')
      } finally {
        setBusy(false)
      }
    },
    [loadCatalog, selStationId, selVariantId]
  )

  const switchSheet = async (nextId: string) => {
    if (nextId === sheetId) return
    if (dirty && !window.confirm('Switch price sheet? Unsaved prices on this sheet will be discarded.')) return
    setSheetId(nextId)
    setDrafts({})
    setBusy(true)
    setError(null)
    try {
      await Promise.all([loadCatalog(nextId, includePartyPacks), loadIngredients(nextId)])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sheet')
    } finally {
      setBusy(false)
    }
  }

  // Live preview: the same catalog, with unsaved pack prices overlaid. Debounced
  // so typing a price does not rebuild the index on every keystroke.
  const previewSeq = useRef(0)
  useEffect(() => {
    if (!dirty) {
      setPreview(null)
      return
    }
    const seq = ++previewSeq.current
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/pricing/lab/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetId: sheetId || null,
            includePartyPacks,
            drafts: draftList,
          }),
        })
        if (!res.ok || seq !== previewSeq.current) return
        setPreview(await res.json())
      } catch {
        // A stale preview is not worth an error banner; the next edit retries.
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [dirty, draftList, sheetId, includePartyPacks])

  const liveStations = preview?.stations ?? catalog?.stations ?? []

  const visibleStations = useMemo(() => {
    const q = search.trim().toLowerCase()
    return liveStations.filter((st) => {
      if (!includesTag(st.market, regionId)) return false
      if (!q) return true
      return (
        matches(st.title, null, q) ||
        st.variants.some((v) => matches(v.name, v.sku, q))
      )
    })
  }, [liveStations, search, regionId])

  const visibleIngredients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ingredients
    return ingredients.filter((ing) => matches(ing.name, `${ing.code ?? ''} ${ing.source}`, q))
  }, [ingredients, search])

  const selectedStation = liveStations.find((s) => s.id === selStationId) ?? null
  const selectedVariant = selectedStation?.variants.find((v) => v.variantId === selVariantId) ?? null
  const selectedIngredient = ingredients.find((i) => i.key === selIngredientKey) ?? null

  const loadRecipe = useCallback(
    async (variantId: string) => {
      try {
        const url = `/api/pricing/lab/recipe/${encodeURIComponent(variantId)}`
        const res = dirty
          ? await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sheetId: sheetId || null, drafts: draftList }),
            })
          : await fetch(`${url}${sheetId ? `?sheetId=${encodeURIComponent(sheetId)}` : ''}`)
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Recipe failed (${res.status})`)
        setRecipe(await res.json())
      } catch (e) {
        setRecipe(null)
        setStatus({ text: e instanceof Error ? e.message : 'Failed to load recipe', bad: true })
      }
    },
    [dirty, draftList, sheetId]
  )

  useEffect(() => {
    if (catTab !== 'stations' || !selVariantId) {
      setRecipe(null)
      return
    }
    loadRecipe(selVariantId)
  }, [catTab, selVariantId, loadRecipe])

  const impact = useMemo<ImpactRow[]>(() => {
    if (!catalog || !preview) return []
    const before = new Map<string, LabVariant>()
    for (const st of catalog.stations) for (const v of st.variants) before.set(v.variantId, v)
    const rows: ImpactRow[] = []
    for (const st of preview.stations) {
      for (const v of st.variants) {
        const was = before.get(v.variantId)
        if (!was) continue
        if (Math.abs((v.cost ?? 0) - (was.cost ?? 0)) <= 0.005) continue
        rows.push({
          id: v.variantId,
          name: v.name,
          costBefore: was.cost,
          costAfter: v.cost,
          marginBefore: was.margin,
          marginAfter: v.margin,
        })
      }
    }
    return rows
  }, [catalog, preview])

  const upsertDraft = (ingredient: LabIngredient, next: Draft) => {
    setDrafts((prev) => {
      const copy = { ...prev }
      if (draftEqualsSaved(next, ingredient.yours)) delete copy[ingredient.key]
      else copy[ingredient.key] = next
      return copy
    })
  }

  const save = async () => {
    if (!sheetId) {
      setStatus({ text: 'Create or pick a price sheet before saving.', bad: true })
      return
    }
    if (!dirty) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/pricing/lab/sheets/${encodeURIComponent(sheetId)}/entries`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: draftList }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`)
      setDrafts({})
      await Promise.all([loadCatalog(sheetId, includePartyPacks), loadIngredients(sheetId), loadSheets()])
      setStatus({ text: `Saved ${data.saved ?? 0} price${data.saved === 1 ? '' : 's'}${data.cleared ? `, cleared ${data.cleared}` : ''}.`, bad: false })
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : 'Save failed', bad: true })
    } finally {
      setBusy(false)
    }
  }

  const createSheet = async () => {
    const name = newSheetName.trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch('/api/pricing/lab/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not create sheet')
      setNewSheetOpen(false)
      setNewSheetName('')
      const list = await loadSheets()
      const created = list.find((s) => s.id === data.sheet?.id) ?? list.find((s) => s.name === name)
      if (created) await switchSheet(created.id)
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : 'Could not create sheet', bad: true })
    } finally {
      setBusy(false)
    }
  }

  const summary = recipe?.summary
  const marginOk = selectedVariant?.margin != null && selectedVariant.margin >= targetMargin

  if (loading) {
    return (
      <div className="rb">
        <div className="rb-loading">Loading Pricing Lab…</div>
      </div>
    )
  }

  return (
    <div className="rb">
      <header className="rb-header">
        <div className="rb-brand">
          Cater<em>Station</em> · Pricing Lab
        </div>
        <div className="pl-sheetBar">
          <span className="pl-lbl">Price sheet</span>
          <select value={sheetId} onChange={(e) => switchSheet(e.target.value)} disabled={busy}>
            {!sheets.length && <option value="">No sheets yet</option>}
            {sheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.entryCount})
              </option>
            ))}
          </select>
          <button className="rb-btn" type="button" onClick={() => setNewSheetOpen(true)} disabled={busy}>
            New sheet
          </button>
        </div>
        <div className="rb-spacer" />
        <div className="pl-sheetBar">
          <span className="pl-lbl">Region</span>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="all">All regions</option>
            {(catalog?.markets ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <label className="pl-toggle">
            <input
              type="checkbox"
              checked={includePartyPacks}
              onChange={(e) => {
                const next = e.target.checked
                setIncludePartyPacks(next)
                void reloadForFilters(sheetId, next)
              }}
            />
            Include party packs
          </label>
        </div>
        <button
          className={`rb-btn${dirty ? ' pl-save' : ''}`}
          type="button"
          onClick={save}
          disabled={busy || !dirty || !sheetId}
        >
          {busy ? 'Working…' : dirty ? 'Save prices' : 'Saved'}
          {dirty && <span className="pl-dirtyDot" />}
                </button>
      </header>

      {(error || status) && (
        <div className={`rb-warnBanner${status && !status.bad ? '' : ''}`} style={status && !status.bad ? { background: 'var(--good-soft)', color: 'var(--good)' } : undefined}>
          {error || status?.text}
        </div>
      )}

      <div className="rb-wrap">
        <section className="rb-panel">
          <div className="rb-catTabs" role="tablist">
            <button
              role="tab"
              aria-selected={catTab === 'stations'}
              className={`rb-catTab${catTab === 'stations' ? ' on' : ''}`}
              onClick={() => setCatTab('stations')}
            >
              Stations <span className="rb-count">{visibleStations.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={catTab === 'ingredients'}
              className={`rb-catTab${catTab === 'ingredients' ? ' on' : ''}`}
              onClick={() => setCatTab('ingredients')}
            >
              Ingredients <span className="rb-count">{visibleIngredients.length}</span>
            </button>
            </div>
          <input
            className="rb-search"
            placeholder={catTab === 'stations' ? 'Search stations…' : 'Search ingredients…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {catTab === 'stations' ? (
            <CatalogList
              items={visibleStations}
              rowHeight={STATION_ROW_H}
              resetKey={`stations:${search}:${regionId}:${includePartyPacks}`}
              keyOf={(s) => s.id}
              empty={catalog ? 'No stations match.' : 'Loading catalogue…'}
              renderRow={(st) => (
                <button
                  className={`rb-catItem${selStationId === st.id ? ' sel' : ''}`}
                  onClick={() => {
                    setSelStationId(st.id)
                    setSelVariantId(st.variants[0]?.variantId ?? null)
                    setCatTab('stations')
                  }}
                  title={st.title}
                >
                  <span className="nm">
                    {st.title}
                    <span className="sku">{st.variants.length} variant{st.variants.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className={`mg num ${st.margin == null ? '' : st.belowTarget ? 'low' : 'ok'}`}>
                    {pct(st.margin)}
                  </span>
                </button>
              )}
            />
          ) : (
            <CatalogList
              items={visibleIngredients}
              rowHeight={INGREDIENT_ROW_H}
              resetKey={`ingredients:${search}`}
              keyOf={(i) => i.key}
              empty={ingredients.length ? 'No ingredients match.' : 'Loading ingredients…'}
              renderRow={(ing) => {
                const draft = drafts[ing.key]
                const yours = draft ?? ing.yours
                const hasOwn = Boolean(draft ? draft.packPrice != null : ing.yours)
                return (
                  <button
                    className={`rb-catItem${selIngredientKey === ing.key ? ' sel' : ''}`}
                    onClick={() => {
                      setSelIngredientKey(ing.key)
                      setCatTab('ingredients')
                    }}
                    title={ing.name}
                  >
                    {hasOwn && <span className="pl-yours" title="You have a price on this sheet" />}
                    <span className="nm">
                      {ing.name}
                      <span className="sku">
                        {ing.source}
                        {ing.code ? ` · ${ing.code}` : ''} · {ing.recipeCount} recipe{ing.recipeCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="cost num">
                      {yours && 'packPrice' in yours && yours.packPrice != null
                        ? money(deriveSheetUnitCost({
                            packPrice: yours.packPrice,
                            unitsPerPack: yours.unitsPerPack,
                            sizePerUnit: yours.sizePerUnit,
                            sizeUnit: asSizeUnit(yours.sizeUnit),
                          })?.unitCost ?? null)
                        : money(ing.unitCost)}
                      <span className="pl-uses">/{ing.unitCostUnit ?? 'unit'}</span>
                    </span>
                  </button>
                )
              }}
            />
          )}
        </section>

        <section className="rb-panel">
          {catTab === 'stations' ? (
            !selectedStation ? (
              <div className="rb-loading">Select a station.</div>
            ) : (
              <>
                <div className="pl-hero">
                  <div className="shot">
                    {selectedStation.heroImageUrl ? (
                      <img src={selectedStation.heroImageUrl} alt="" />
                    ) : null}
                  </div>
                  <div className="meta">
                    <h1>{selectedStation.title}</h1>
                    <div className="sub">
                      {selectedStation.variants.length} variant{selectedStation.variants.length === 1 ? '' : 's'}
                      {selectedStation.market ? ` · ${selectedStation.market}` : ''}
                    </div>
                  </div>
                </div>
                <div className="pl-varCols">
                  <div>Variant</div>
                  <div className="r">Cost</div>
                  <div className="r">RRP ex</div>
                  <div className="r">Margin</div>
                  <div className="r">Target</div>
                </div>
                <div className="pl-varBody">
                  {selectedStation.variants.map((v) => (
                    <button
                      key={v.variantId}
                      className={`pl-varRow${selVariantId === v.variantId ? ' sel' : ''}`}
                      onClick={() => setSelVariantId(v.variantId)}
                    >
                      <span className="nm">
                        {v.name}
                        {v.isPartyPack && <span className="pack">pack</span>}
                      </span>
                      <span className="r num">{money(v.cost)}</span>
                      <span className="r num">{money(v.rrpEx)}</span>
                      <span className={`r num mg ${v.margin == null ? '' : v.belowTarget ? 'low' : 'ok'}`}>
                        {pct(v.margin)}
                      </span>
                      <span className="r num">{money(v.targetRrpEx)}</span>
                    </button>
                  ))}
                </div>
                <div className="pl-sectionHead">Recipe cost</div>
                <div className="rb-cols">
                  <div>Line</div>
                  <div className="r">Quantity</div>
                  <div className="r">Unit cost</div>
                  <div className="r">Line cost</div>
                </div>
                <div className="rb-tree">
                  {!recipe ? (
                    <div className="empty" style={{ padding: 12, color: 'var(--faint)' }}>
                      {selVariantId ? 'Loading recipe…' : 'Select a variant.'}
                    </div>
                  ) : recipe.nodes.length === 0 ? (
                    <div className="empty" style={{ padding: 12, color: 'var(--faint)' }}>
                      No recipe lines on this variant.
                    </div>
                  ) : (
                    recipe.nodes.map((node) => (
                      <ReadOnlyTreeRow
                        key={node.path}
                        node={node}
                        depth={0}
                        expanded={expanded}
                        onToggle={(path) =>
                          setExpanded((prev) => {
                            const next = new Set(prev)
                            next.has(path) ? next.delete(path) : next.add(path)
                    return next
                  })
                        }
                      />
                    ))
                  )}
                </div>
              </>
            )
          ) : !selectedIngredient ? (
            <div className="rb-loading">Select an ingredient to set the price you pay.</div>
          ) : (
            <IngredientEditor
              ingredient={selectedIngredient}
              draft={drafts[selectedIngredient.key]}
              onChange={(next) => upsertDraft(selectedIngredient, next)}
              onClear={() => {
                if (selectedIngredient.yours) {
                  upsertDraft(selectedIngredient, {
                    source: selectedIngredient.source,
                    sourceId: selectedIngredient.sourceId,
                    supplierName: '',
                    packPrice: null,
                    unitsPerPack: selectedIngredient.yours.unitsPerPack,
                    sizePerUnit: selectedIngredient.yours.sizePerUnit,
                    sizeUnit: asSizeUnit(selectedIngredient.yours.sizeUnit),
                  })
                } else {
                  setDrafts((prev) => {
                    const copy = { ...prev }
                    delete copy[selectedIngredient.key]
                    return copy
                    })
                  }
                }}
              />
            )}
        </section>

        <aside className="rb-side">
          <section className="rb-panel">
            {catTab === 'stations' && selectedVariant ? (
              <>
                <h2>Cost &amp; margin — live</h2>
                <div className="rb-kpis">
                  <Kpi label="Total cost" value={money(selectedVariant.cost)} />
                  <Kpi label="RRP ex GST" value={money(selectedVariant.rrpEx)} />
                  <Kpi label={`Target RRP @ ${(targetMargin * 100).toFixed(0)}%`} value={money(selectedVariant.targetRrpEx)} small="ex GST" />
                  <Kpi label="RRP incl GST" value={money(selectedVariant.rrpInclGst)} />
                </div>
                <div className="rb-marginBlock">
                  <div className="lineTop">
                    <span className="lbl">Gross margin</span>
                    <span className={`big num ${selectedVariant.margin == null ? '' : marginOk ? 'ok' : 'low'}`}>
                      {pct(selectedVariant.margin)}
                    </span>
                  </div>
                  <div className="rb-mbar">
                    <div
                      className={`fill${marginOk ? '' : ' low'}`}
                      style={{ width: `${Math.max(0, Math.min(100, (selectedVariant.margin ?? 0) * 100))}%` }}
                    />
                    <div className="target" style={{ left: `${targetMargin * 100}%` }} />
                    <div className="tlab" style={{ left: `${targetMargin * 100}%` }}>
                      target {(targetMargin * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>Your price</h2>
                <div className="rb-kpis">
                  <Kpi
                    label="House unit cost"
                    value={
                      selectedIngredient
                        ? `${money(selectedIngredient.unitCost)}/${selectedIngredient.unitCostUnit ?? 'unit'}`
                        : '—'
                    }
                  />
                  <Kpi label="Recipes using it" value={selectedIngredient ? String(selectedIngredient.recipeCount) : '—'} />
                </div>
              </>
            )}
            {summary && summary.coverage.totalLines > 0 && summary.coverage.pct < 1 && (
              <div className="rb-marginBlock" style={{ color: 'var(--crit)', fontSize: 12.5 }}>
                {summary.coverage.resolvedLines}/{summary.coverage.totalLines} lines costed
                {summary.reasons.length ? ` — ${summary.reasons.join(', ')}` : ''}. Totals shown are for the lines that resolved.
              </div>
            )}
            {selectedVariant && selectedVariant.totalLines > 0 && selectedVariant.coveragePct < 1 && !summary && (
              <div className="rb-marginBlock" style={{ color: 'var(--crit)', fontSize: 12.5 }}>
                {selectedVariant.resolvedLines}/{selectedVariant.totalLines} lines costed. Totals shown are for the lines that resolved.
              </div>
            )}
          </section>

          <section className="rb-panel">
            <h2>Unsaved price changes</h2>
            <div className="rb-sideList">
              {!dirty ? (
                <div className="empty">Type a pack price on an ingredient — every affected product shows here before you save.</div>
              ) : impact.length ? (
                impact.map((i) => {
                  const d = (i.marginAfter ?? 0) - (i.marginBefore ?? 0)
  return (
                    <div key={i.id} className="rb-impactItem">
                      <div className="top">
                        <b>{i.name}</b>
                        <span className={`rb-delta num ${d >= 0 ? 'up' : 'down'}`}>
                          {d >= 0 ? '+' : ''}
                          {(d * 100).toFixed(1)} pts
                        </span>
        </div>
                      <div className="num" style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                        cost {money(i.costBefore)} <span className="rb-arrow">→</span> {money(i.costAfter)} · margin{' '}
                        {pct(i.marginBefore)} <span className="rb-arrow">→</span> {pct(i.marginAfter)}
      </div>
                    </div>
                  )
                })
              ) : (
                <div className="empty">
                  {draftList.length} unsaved price{draftList.length === 1 ? '' : 's'} — preview is still calculating, or no sellable product moved.
                </div>
              )}
            </div>
          </section>

          {catTab === 'ingredients' && selectedIngredient && (
            <section className="rb-panel">
              <h2>Used in</h2>
              <div className="rb-sideList">
                {selectedIngredient.usedIn.length ? (
                  selectedIngredient.usedIn.map((u) => (
                    <div key={`${u.type}:${u.id}`} className="rb-usedItem">
                      <span>{u.name}</span>
                      <span className="num" style={{ color: 'var(--faint)' }}>{u.type}</span>
            </div>
                  ))
                ) : (
                  <div className="empty">
                    {selectedIngredient.source === 'Other'
                      ? 'On the Other list, but not in a recipe yet.'
                      : 'Not used in any recipe yet.'}
          </div>
                )}
                    </div>
            </section>
          )}
        </aside>
      </div>

      <p className="rb-foot">
        Prices you enter belong to the selected sheet only. They never change supplier catalogues, component costs, or
        the live books — save creates a snapshot you can reopen later.
      </p>

      {newSheetOpen && (
        <div className="rb-fixOverlay" onClick={() => setNewSheetOpen(false)}>
          <div className="rb-fixCard" onClick={(e) => e.stopPropagation()}>
            <div className="rb-fixHead">
              <b>New price sheet</b>
              <button className="rb-fixClose" onClick={() => setNewSheetOpen(false)} aria-label="close">
                ×
                  </button>
            </div>
            <div className="rb-fixExplain">Name it after the city or operator who will enter their own costs.</div>
            <div className="rb-fixRow">
              <input
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSheet()}
                placeholder="Christchurch"
                autoFocus
                style={{ flex: 1 }}
              />
              <button className="rb-fixApply" onClick={createSheet} disabled={busy || !newSheetName.trim()}>
                {busy ? 'Creating…' : 'Create'}
                  </button>
                </div>
          </div>
        </div>
      )}
          </div>
  )
}

function ReadOnlyTreeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
}) {
  const indent = depth > 0 ? `rb-indent${Math.min(depth, 3)}` : ''
  const isOpen = expanded.has(node.path)
  const yours = node.provenance === 'override'

  return (
    <>
      <div className={`rb-row${node.kind === 'component' ? ' compRow' : ''}`}>
        <div className={`name ${indent}`}>
          {node.kind === 'component' ? (
            <button className={`rb-caret${isOpen ? ' open' : ''}`} onClick={() => onToggle(node.path)} aria-label="expand">
              ▶
            </button>
          ) : (
            <span className="rb-caret blank">▶</span>
          )}
          <span className="nm" title={node.name}>
            {node.name}
          </span>
          <span className={`rb-srcBadge${node.kind === 'component' ? ' comp' : ''}`} title={node.note ?? undefined}>
            {yours ? node.supplier ?? 'Your price' : node.supplier ?? node.source}
          </span>
          {node.origin && node.origin !== 'variant' && (
            <span className="rb-srcBadge" title="Where this line comes from">
              {node.origin}
            </span>
          )}
          {node.reason && (
            <span className="rb-alertDot crit" title={node.note ?? node.reason}>
              {node.reason}
            </span>
          )}
            </div>
        <div className="rb-qty">
          <span className="num">{node.quantity}</span>
          <span className="unit">{node.unit ?? ''}</span>
        </div>
        <div className="rb-cell num">
          {money(node.unitCost)}
          <span className="per">/{node.unitCostUnit ?? 'unit'}</span>
        </div>
        <div className="rb-cell num">{money(node.lineCost)}</div>
      </div>
      {node.kind === 'component' &&
        isOpen &&
        (node.children ?? []).map((child) => (
          <ReadOnlyTreeRow key={child.path} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
        ))}
    </>
  )
}

function IngredientEditor({
  ingredient,
  draft,
  onChange,
  onClear,
}: {
  ingredient: LabIngredient
  draft?: Draft
  onChange: (next: Draft) => void
  onClear: () => void
}) {
  const baseline: Draft = {
    source: ingredient.source,
    sourceId: ingredient.sourceId,
    supplierName: draft?.supplierName ?? ingredient.yours?.supplierName ?? '',
    packPrice: draft ? draft.packPrice : ingredient.yours?.packPrice ?? null,
    unitsPerPack: draft?.unitsPerPack ?? ingredient.yours?.unitsPerPack ?? ingredient.suggestedPack?.unitsPerPack ?? 1,
    sizePerUnit: draft?.sizePerUnit ?? ingredient.yours?.sizePerUnit ?? ingredient.suggestedPack?.sizePerUnit ?? 1,
    sizeUnit: asSizeUnit(draft?.sizeUnit ?? ingredient.yours?.sizeUnit ?? ingredient.suggestedPack?.sizeUnit),
  }

  const [packText, setPackText] = useState(baseline.packPrice == null ? '' : String(baseline.packPrice))

  useEffect(() => {
    const yours = ingredient.yours
    const next = draft?.packPrice ?? yours?.packPrice ?? null
    setPackText(next == null ? '' : String(next))
    // Reset the typed field when the operator opens a different ingredient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient.key])

  const derived =
    baseline.packPrice == null
      ? null
      : deriveSheetUnitCost({
          packPrice: baseline.packPrice,
          unitsPerPack: baseline.unitsPerPack,
          sizePerUnit: baseline.sizePerUnit,
          sizeUnit: baseline.sizeUnit,
        })

  const commit = (patch: Partial<Draft> & { packPriceText?: string }) => {
    const packPriceText = patch.packPriceText ?? packText
    const parsed = packPriceText.trim() === '' ? null : Number(packPriceText)
    onChange({
      ...baseline,
      ...patch,
      packPrice: parsed != null && Number.isFinite(parsed) ? parsed : null,
    })
  }

  const packLabel = [ingredient.packSize, ingredient.uom, ingredient.ctnQty ? `ctn ${ingredient.ctnQty}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <div className="rb-treeHead">
        <h1>{ingredient.name}</h1>
        <span className="sub">
          {ingredient.source}
          {ingredient.code ? ` · ${ingredient.code}` : ''} · used in {ingredient.recipeCount} recipe
          {ingredient.recipeCount === 1 ? '' : 's'}
        </span>
            </div>
      <div className="pl-editor">
        <div className="pl-refCard">
          <div className="row">
            <span className="k">Our pack</span>
            <span>{packLabel || 'not stated'}</span>
          </div>
          <div className="row">
            <span className="k">Our unit cost</span>
            <span className="num">
              {ingredient.unitCost == null
                ? ingredient.reason ?? 'unknown'
                : `${money(ingredient.unitCost)}/${ingredient.unitCostUnit}`}
            </span>
        </div>
      </div>

        <div className="pl-fieldGrid">
          <div className="pl-field">
            <label htmlFor="pl-pack">Pack price you pay</label>
            <input
              id="pl-pack"
              className="num"
              type="number"
              step="0.01"
              min="0"
              value={packText}
              placeholder="e.g. 48.50"
              onChange={(e) => {
                setPackText(e.target.value)
                commit({ packPriceText: e.target.value })
              }}
            />
            </div>
          <div className="pl-field">
            <label htmlFor="pl-units">Units per pack</label>
            <input
              id="pl-units"
              className="num"
              type="number"
              step="any"
              min="0"
              value={baseline.unitsPerPack}
              onChange={(e) => commit({ unitsPerPack: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="pl-field">
            <label htmlFor="pl-size">Size per unit</label>
            <input
              id="pl-size"
              className="num"
              type="number"
              step="any"
              min="0"
              value={baseline.sizePerUnit}
              onChange={(e) => commit({ sizePerUnit: Number(e.target.value) || 0 })}
            />
        </div>
          <div className="pl-field">
            <label htmlFor="pl-unit">Unit</label>
            <select
              id="pl-unit"
              value={baseline.sizeUnit}
              onChange={(e) => commit({ sizeUnit: e.target.value as SizeUnit })}
            >
              {SIZE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pl-field" style={{ marginTop: 10 }}>
          <label htmlFor="pl-supplier">Who you buy it from</label>
          <input
            id="pl-supplier"
            value={baseline.supplierName}
            placeholder="Optional — e.g. local produce, Bidfood Christchurch"
            onChange={(e) => commit({ supplierName: e.target.value })}
          />
    </div>

        <div className={`pl-derived${baseline.packPrice != null && !derived ? ' bad' : ''}`}>
          <span>Works out to</span>
          <span className="v num">
            {baseline.packPrice == null
              ? '— (our price will be used)'
              : derived
                ? `${money(derived.unitCost)}/${derived.unit}`
                : 'Check the pack size'}
          </span>
        </div>

        <div className="pl-editorActions">
          <button className="rb-btn" type="button" onClick={onClear} disabled={!ingredient.yours && !draft}>
            Revert to our price
          </button>
        </div>
      </div>
    </>
  )
}
