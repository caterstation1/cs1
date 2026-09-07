'use client'

// Recipe Builder — three panels, matching the approved prototype.
//
// Every number on this page comes from the server. Nothing is costed in the
// browser: the tree, the margins and the impact list are all computed by
// src/lib/pricing and returned by /api/pricing/*. That is the whole point of
// the rebuild, so resist adding arithmetic here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LineOrigin, LineTarget, isEditableOrigin, notEditableReason } from '@/lib/recipe-builder/lines'
import { CatalogList, Kpi, money, pct } from '@/components/pricing-ui'
import '@/styles/pricing-shell.css'

type OwnerType = 'product' | 'component'

interface CatalogProduct {
  id: string
  name: string
  sku: string | null
  cost: number | null
  margin: number | null
  belowTarget: boolean
}
interface CatalogComponent {
  id: string
  name: string
  perUnit: number | null
  unit: string
}
interface Catalog {
  products: CatalogProduct[]
  components: CatalogComponent[]
  settings: { targetMargin: number; gstRate: number }
}

interface TreeNode {
  path: string
  kind: 'ingredient' | 'component'
  source: string
  refId: string
  /** Which stored array the row lives in, and its index in that array. The
   *  only address an edit can use — see src/lib/recipe-builder/lines.ts. */
  origin: LineOrigin
  position: number
  resolvedComponentId?: string | null
  ingredientId: string | null
  name: string
  quantity: number
  unit: string | null
  unitCost: number | null
  unitCostUnit: string | null
  lineCost: number | null
  supplier: string | null
  provenance: string | null
  confidence: number | null
  reason: string | null
  note: string | null
  batchCost?: number | null
  producedQuantity?: number
  producedUnit?: string
  children?: TreeNode[]
}

interface RecipeSummary {
  ownerType: OwnerType
  id: string
  name: string
  subtitle: string
  totalCost: number | null
  serves?: number | null
  costPerServe?: number | null
  rrpEx?: number | null
  margin?: number | null
  targetMargin?: number
  targetRrpEx?: number | null
  batchCost?: number | null
  perUnit?: number | null
  producedUnit?: string
  coverage: { resolvedLines: number; totalLines: number; pct: number }
  reasons: string[]
}

interface Dietary { key: string; label: string; present: boolean; from: string[] }
interface Alert { id: string; type: string; refId: string; message: string }
interface Recipe {
  summary: RecipeSummary
  nodes: TreeNode[]
  dietary: Dietary[]
  usedIn: Array<{ id: string; name: string; margin: number | null }>
  alerts: Alert[]
}
interface Impact {
  id: string
  name: string
  costBefore: number | null
  costAfter: number | null
  marginBefore: number | null
  marginAfter: number | null
}
interface SupplierLink {
  id: string
  source: string
  sourceId: string
  rank: number
  packConfidence: number | null
  latestUnitCost: number | null
}
interface IngredientDetail {
  id: string
  name: string
  canonicalUnit: string
  links: SupplierLink[]
}

/** Where a fix must be applied: the entity whose ingredient array holds the
 *  line. For nested rows that is the enclosing component, not the selection. */
interface FixOwner { type: OwnerType; id: string }
interface FixTarget { node: TreeNode; owner: FixOwner }

/** The stable address of a row, for every mutation that names one. */
const targetOf = (node: TreeNode): LineTarget => ({
  origin: node.origin,
  position: node.position,
  refId: node.refId,
})

/** Identity of a top-level row for the selection set. Two rows referencing the
 *  same ingredient sit at different positions, so they select independently. */
const rowKey = (node: TreeNode) => `${node.origin}:${node.position}`

const hasIssueDeep = (n: TreeNode): boolean => Boolean(n.reason) || (n.children ?? []).some(hasIssueDeep)

/** Row heights the catalogue window measures with. They must match the heights
 *  .rb-catItem is given in pricing-shell.css: a product row carries a SKU line
 *  under its name, a component row is a single line. */
const PRODUCT_ROW_H = 50
const COMPONENT_ROW_H = 36

const matches = (name: string, sku: string | null, q: string) =>
  name.toLowerCase().includes(q) || (sku ?? '').toLowerCase().includes(q)

export default function RecipeBuilderPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catTab, setCatTab] = useState<'products' | 'components'>('products')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<{ type: OwnerType; id: string } | null>(null)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [openSup, setOpenSup] = useState<string | null>(null)
  const [supDetail, setSupDetail] = useState<IngredientDetail | null>(null)
  const [addText, setAddText] = useState('')
  const [addMsg, setAddMsg] = useState<{ text: string; bad: boolean } | null>(null)
  const [impact, setImpact] = useState<Impact[]>([])
  const [fix, setFix] = useState<FixTarget | null>(null)

  const targetMargin = catalog?.settings.targetMargin ?? 0.7

  // --- catalogue ---
  useEffect(() => {
    let cancelled = false
    fetch('/api/pricing/catalog')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Catalog failed (${r.status})`))))
      .then((data: Catalog) => {
        if (cancelled) return
        setCatalog(data)
        if (!sel && data.products.length) setSel({ type: 'product', id: data.products[0].id })
        else if (!sel && data.components.length) setSel({ type: 'component', id: data.components[0].id })
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
    // Runs once: the catalogue is filtered client-side from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRecipe = useCallback(async (type: OwnerType, id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pricing/recipe/${type}/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed (${res.status})`)
      setRecipe(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recipe')
      setRecipe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sel) loadRecipe(sel.type, sel.id)
  }, [sel, loadRecipe])

  // Refreshes fire after every save and each one rebuilds the cost index, so
  // they can finish out of order. Only the newest answer may touch the panel.
  const catalogSeq = useRef(0)
  const refreshCatalog = useCallback(async () => {
    const seq = ++catalogSeq.current
    try {
      const res = await fetch('/api/pricing/catalog')
      if (res.ok && seq === catalogSeq.current) setCatalog(await res.json())
    } catch {
      // A stale left panel is not worth surfacing; the next edit refreshes it.
    }
  }, [])

  // The whole catalogue arrives in one payload — one cost index build serves
  // every row, so paging it server-side would rebuild that index per page — and
  // search runs over all of it, not over what happens to be on screen.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!catalog) return { products: [], components: [] }
    return {
      products: q ? catalog.products.filter((p) => matches(p.name, p.sku, q)) : catalog.products,
      components: q ? catalog.components.filter((c) => matches(c.name, null, q)) : catalog.components,
    }
  }, [catalog, search])

  // --- mutations ---
  const mutate = useCallback(
    async (body: Record<string, unknown>) => {
      if (!sel) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/pricing/recipe/${sel.type}/${encodeURIComponent(sel.id)}/lines`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Failed (${res.status})`)
        setRecipe((prev) => (data.tree ? { ...data.tree, alerts: prev?.alerts ?? [] } : prev))
        // Impact accumulates across edits, like the prototype's "since page load".
        setImpact((prev) => mergeImpact(prev, data.impact ?? []))
        setAddMsg({ text: data.message ?? 'Saved', bad: false })
        setChecked(new Set())
        refreshCatalog()
      } catch (e) {
        setAddMsg({ text: e instanceof Error ? e.message : 'Update failed', bad: true })
      } finally {
        setBusy(false)
      }
    },
    [sel, refreshCatalog]
  )

  // Fixes can land anywhere in the tree, so they PATCH the owning entity
  // directly and then reload the current selection to show the repaired state.
  const applyFix = useCallback(
    async (owner: FixOwner, body: Record<string, unknown>) => {
      setBusy(true)
      try {
        const res = await fetch(`/api/pricing/recipe/${owner.type}/${encodeURIComponent(owner.id)}/lines`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Fix failed (${res.status})`)
        setImpact((prev) => mergeImpact(prev, data.impact ?? []))
        setAddMsg({ text: data.message ?? 'Fixed', bad: false })
        setFix(null)
        if (sel) await loadRecipe(sel.type, sel.id)
        refreshCatalog()
      } catch (e) {
        setAddMsg({ text: e instanceof Error ? e.message : 'Fix failed', bad: true })
      } finally {
        setBusy(false)
      }
    },
    [sel, loadRecipe, refreshCatalog]
  )

  // Expands every component under (and including) the node that still hides a
  // failing line, so the badge the user must click next is visible.
  const revealFailing = useCallback((root: TreeNode) => {
    const paths: string[] = []
    const walk = (n: TreeNode) => {
      if (n.kind === 'component' && (n.children ?? []).some(hasIssueDeep)) paths.push(n.path)
      n.children?.forEach(walk)
    }
    walk(root)
    setExpanded((prev) => new Set([...prev, ...paths]))
    setFix(null)
  }, [])

  // Natural-language add: parsed server-side against the real master via the
  // search endpoint, so what gets inserted is a resolved reference, not text.
  const handleAdd = useCallback(async () => {
    const raw = addText.trim()
    if (!raw || !sel) return
    const m = raw.match(/^([\d.]+)?\s*(kg|g|l|ml|each|ea|unit|x)?\s*(.+)$/i)
    if (!m) return
    let qty = parseFloat(m[1] || '1')
    let unit = (m[2] || '').toLowerCase()
    const term = m[3].trim()
    if (unit === 'g') { qty /= 1000; unit = 'kg' }
    if (unit === 'ml') { qty /= 1000; unit = 'l' }
    if (unit === 'ea' || unit === 'x') unit = 'each'

    setBusy(true)
    try {
      const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(term)}&limit=1`)
      const hits = res.ok ? await res.json() : []
      if (!Array.isArray(hits) || !hits.length) {
        setAddMsg({ text: `No match for “${term}” in the master, catalogues or components.`, bad: true })
        return
      }
      const hit = hits[0]
      await mutate({
        op: 'add',
        line: {
          source: hit.source === 'Master' ? 'Ingredient' : hit.source,
          id: hit.source === 'Master' ? hit.id : hit.id,
          name: hit.name,
          quantity: qty,
          unit: unit || hit.unit || 'each',
          ...(hit.ingredientId ? { ingredientId: hit.ingredientId } : {}),
          ...(hit.unitCost != null ? { cost: hit.unitCost } : {}),
        },
      })
      setAddText('')
    } finally {
      setBusy(false)
    }
  }, [addText, sel, mutate])

  const openSupplier = useCallback(async (ingredientId: string | null) => {
    if (!ingredientId) return
    if (openSup === ingredientId) { setOpenSup(null); setSupDetail(null); return }
    setOpenSup(ingredientId)
    setSupDetail(null)
    const res = await fetch(`/api/pricing/ingredient/${ingredientId}`)
    if (res.ok) setSupDetail(await res.json())
  }, [openSup])

  const switchPreferred = useCallback(
    async (ingredientId: string, linkId: string) => {
      setBusy(true)
      try {
        const res = await fetch(`/api/pricing/ingredient/${ingredientId}/preferred`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to switch supplier')
        setImpact((prev) => mergeImpact(prev, data.impact ?? []))
        setSupDetail((prev) => (prev ? { ...prev, links: data.links } : prev))
        if (sel) await loadRecipe(sel.type, sel.id)
        refreshCatalog()
        setAddMsg({ text: `Preferred supplier switched — ${data.impact?.length ?? 0} product(s) repriced.`, bad: false })
      } catch (e) {
        setAddMsg({ text: e instanceof Error ? e.message : 'Failed', bad: true })
      } finally {
        setBusy(false)
      }
    },
    [sel, loadRecipe, refreshCatalog]
  )

  // A base row belongs to the ShopifyProduct, so removing it removes it from
  // every variant of that product. Say so before doing it.
  const removeLine = useCallback(
    (node: TreeNode) => {
      if (
        node.origin === 'base' &&
        !window.confirm(
          `“${node.name}” is part of the base recipe shared by every variant of this product. Remove it from all of them?`
        )
      ) {
        return
      }
      mutate({ op: 'remove', target: targetOf(node) })
    },
    [mutate]
  )

  const selectedTargets = useMemo(
    () => (recipe?.nodes ?? []).filter((n) => checked.has(rowKey(n))).map(targetOf),
    [recipe, checked]
  )

  const wrapSelected = useCallback(() => {
    if (selectedTargets.length < 2) return
    const name = window.prompt('Name for the new component:')
    if (!name?.trim()) return
    const qtyRaw = window.prompt('Batch yield quantity:', '1')
    const unit = window.prompt('Batch yield unit (kg, l, unit):', 'unit') || 'unit'
    mutate({
      op: 'wrap',
      targets: selectedTargets,
      name: name.trim(),
      producedQuantity: Number(qtyRaw) || 1,
      producedUnit: unit.trim() || 'unit',
    })
  }, [selectedTargets, mutate])

  const toggleExpand = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const summary = recipe?.summary
  const marginOk = summary?.margin != null && summary.margin >= (summary.targetMargin ?? targetMargin)

  return (
    <div className="rb">
      <header className="rb-header">
        <div className="rb-brand">
          Cater<em>Station</em> · Recipe Builder
        </div>
        <div className="rb-spacer" />
        <span className="rb-hint">
          Costs are derived live from preferred supplier prices — nothing here is typed by hand.
        </span>
        <a className="rb-btn" href="/api/pricing/export" download title="All products with cost, retail price, margin and suggested price">
          Download CSV
        </a>
        <button className="rb-btn" onClick={() => sel && loadRecipe(sel.type, sel.id)} disabled={busy || !sel}>
          {busy ? 'Working…' : 'Refresh'}
        </button>
      </header>

      {error && <div className="rb-warnBanner">{error}</div>}

      <div className="rb-wrap">
        {/* LEFT — two catalogues, one per tab */}
        <section className="rb-panel">
          <div className="rb-catTabs" role="tablist">
            <button
              role="tab"
              aria-selected={catTab === 'products'}
              className={`rb-catTab${catTab === 'products' ? ' on' : ''}`}
              onClick={() => setCatTab('products')}
            >
              Products <span className="rb-count">{filtered.products.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={catTab === 'components'}
              className={`rb-catTab${catTab === 'components' ? ' on' : ''}`}
              onClick={() => setCatTab('components')}
            >
              Components <span className="rb-count">{filtered.components.length}</span>
            </button>
          </div>
          <input
            className="rb-search"
            placeholder={catTab === 'products' ? 'Search products…' : 'Search components…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {catTab === 'products' ? (
            <CatalogList
              items={filtered.products}
              rowHeight={PRODUCT_ROW_H}
              resetKey={`products:${search}`}
              keyOf={(p) => p.id}
              empty={catalog ? 'No products match.' : 'Loading catalogue…'}
              renderRow={(p) => (
                <button
                  className={`rb-catItem${sel?.type === 'product' && sel.id === p.id ? ' sel' : ''}`}
                  onClick={() => { setSel({ type: 'product', id: p.id }); setChecked(new Set()); setOpenSup(null) }}
                  title={p.sku ? `${p.name} · ${p.sku}` : p.name}
                >
                  <span className="nm">
                    {p.name}
                    {/* Many variants share a title; the SKU is what tells them apart. */}
                    {p.sku && <span className="sku">{p.sku}</span>}
                  </span>
                  <span className={`mg num ${p.margin == null ? '' : p.belowTarget ? 'low' : 'ok'}`}>
                    {pct(p.margin)}
                  </span>
                </button>
              )}
            />
          ) : (
            <CatalogList
              items={filtered.components}
              rowHeight={COMPONENT_ROW_H}
              resetKey={`components:${search}`}
              keyOf={(c) => c.id}
              empty={catalog ? 'No components match.' : 'Loading catalogue…'}
              renderRow={(c) => (
                <button
                  className={`rb-catItem${sel?.type === 'component' && sel.id === c.id ? ' sel' : ''}`}
                  onClick={() => { setSel({ type: 'component', id: c.id }); setChecked(new Set()); setOpenSup(null) }}
                  title={c.name}
                >
                  <span className="nm">{c.name}</span>
                  <span className="cost num">{c.perUnit == null ? '—' : `${money(c.perUnit)}/${c.unit}`}</span>
                </button>
              )}
            />
          )}
        </section>

        {/* MIDDLE — recipe tree */}
        <section className="rb-panel">
          {loading && !recipe ? (
            <div className="rb-loading">Loading recipe…</div>
          ) : !summary ? (
            <div className="rb-loading">Select a product or component.</div>
          ) : (
            <>
              <div className="rb-treeHead">
                <h1>{summary.name}</h1>
                <span className="sub">{summary.subtitle}</span>
              </div>
              <div className="rb-addBar">
                <input
                  placeholder='Add a line: try "1.2 kg colby cheese" or "2 each hass avocado"'
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button onClick={handleAdd} disabled={busy}>Add</button>
              </div>
              <div className={`rb-addMsg${addMsg?.bad ? ' bad' : ''}`}>{addMsg?.text ?? ''}</div>

              {checked.size >= 2 && (
                <div className="rb-wrapBtnBar">
                  <button className="rb-wrapBtn" onClick={wrapSelected} disabled={busy}>
                    ⤵ Wrap {checked.size} selected lines into a new component
                  </button>
                </div>
              )}

              <div className="rb-cols">
                <div>Line</div><div className="r">Quantity</div><div className="r">Unit cost</div><div className="r">Line cost</div>
              </div>
              <div className="rb-tree">
                {summary.coverage.totalLines === 0 ? (
                  <div className="empty" style={{ padding: 12, color: 'var(--faint)' }}>No lines yet — add one above.</div>
                ) : (
                  recipe!.nodes.map((node) => (
                    <TreeRow
                      key={node.path}
                      node={node}
                      depth={0}
                      isTop
                      owner={{ type: sel!.type, id: sel!.id }}
                      expanded={expanded}
                      checked={checked}
                      openSup={openSup}
                      supDetail={supDetail}
                      busy={busy}
                      onToggleExpand={toggleExpand}
                      onToggleCheck={(row) =>
                        setChecked((prev) => {
                          const next = new Set(prev)
                          const key = rowKey(row)
                          next.has(key) ? next.delete(key) : next.add(key)
                          return next
                        })
                      }
                      onQty={(row, q) => mutate({ op: 'update', target: targetOf(row), quantity: q })}
                      onRemove={removeLine}
                      onOpenSup={openSupplier}
                      onSwitchPreferred={switchPreferred}
                      onFix={setFix}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </section>

        {/* RIGHT — consequences */}
        <aside className="rb-side">
          <section className="rb-panel">
            {summary?.ownerType === 'product' ? (
              <>
                <h2>Cost &amp; margin — live</h2>
                <div className="rb-kpis">
                  <Kpi label="Total cost" value={money(summary.totalCost)} />
                  <Kpi label="Cost / serve" value={money(summary.costPerServe)} />
                  <Kpi label="RRP ex GST" value={money(summary.rrpEx)} />
                  <Kpi label={`Target RRP @ ${((summary.targetMargin ?? targetMargin) * 100).toFixed(0)}%`} value={money(summary.targetRrpEx)} small="ex GST" />
                </div>
                <div className="rb-marginBlock">
                  <div className="lineTop">
                    <span className="lbl">Gross margin</span>
                    <span className={`big num ${summary.margin == null ? '' : marginOk ? 'ok' : 'low'}`}>{pct(summary.margin)}</span>
                  </div>
                  <div className="rb-mbar">
                    <div
                      className={`fill${marginOk ? '' : ' low'}`}
                      style={{ width: `${Math.max(0, Math.min(100, (summary.margin ?? 0) * 100))}%` }}
                    />
                    <div className="target" style={{ left: `${(summary.targetMargin ?? targetMargin) * 100}%` }} />
                    <div className="tlab" style={{ left: `${(summary.targetMargin ?? targetMargin) * 100}%` }}>
                      target {((summary.targetMargin ?? targetMargin) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>Cost — live</h2>
                <div className="rb-kpis">
                  <Kpi label="Batch cost" value={money(summary?.batchCost)} />
                  <Kpi label={`Cost / ${summary?.producedUnit ?? 'unit'}`} value={money(summary?.perUnit)} />
                </div>
              </>
            )}
            {summary && summary.coverage.totalLines > 0 && summary.coverage.pct < 1 && (
              <div className="rb-marginBlock" style={{ color: 'var(--crit)', fontSize: 12.5 }}>
                {summary.coverage.resolvedLines}/{summary.coverage.totalLines} lines costed
                {summary.reasons.length ? ` — ${summary.reasons.join(', ')}` : ''}. Totals shown are for the lines that resolved.
              </div>
            )}
          </section>

          <section className="rb-panel">
            <h2>Alerts</h2>
            <div className="rb-sideList">
              {recipe?.alerts?.length ? (
                recipe.alerts.map((a) => (
                  <div key={a.id} className="rb-alertItem">
                    <span className={`ic ${a.type === 'margin_below_target' || a.type === 'missing_cost' ? 'crit' : 'warn'}`} />
                    <div>{a.message}</div>
                  </div>
                ))
              ) : (
                <div className="empty">No alerts for this item.</div>
              )}
            </div>
          </section>

          <section className="rb-panel">
            <h2>Dietary — derived from ingredients</h2>
            <div className="rb-chips">
              {recipe?.dietary?.length ? (
                recipe.dietary.map((d) => (
                  <span key={d.key} className={`rb-chip${d.present ? ' on' : ''}`} title={d.from.join(', ')}>
                    {d.present ? `Contains ${d.label}` : `${d.label} free`}
                  </span>
                ))
              ) : (
                <span className="rb-chip">No ingredient flags yet</span>
              )}
            </div>
          </section>

          {summary?.ownerType === 'component' && (
            <section className="rb-panel">
              <h2>Used in</h2>
              <div className="rb-sideList">
                {recipe?.usedIn?.length ? (
                  recipe.usedIn.map((u) => (
                    <div key={u.id} className="rb-usedItem">
                      <span>{u.name}</span>
                      <span className={`num mg ${u.margin != null && u.margin >= targetMargin ? 'ok' : 'low'}`}>{pct(u.margin)}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty">Not used in any product yet.</div>
                )}
              </div>
            </section>
          )}

          <section className="rb-panel">
            <h2>Impact of your edits</h2>
            <div className="rb-sideList">
              {impact.length ? (
                impact.map((i) => {
                  const d = (i.marginAfter ?? 0) - (i.marginBefore ?? 0)
                  return (
                    <div key={i.id} className="rb-impactItem">
                      <div className="top">
                        <b>{i.name}</b>
                        <span className={`rb-delta num ${d >= 0 ? 'up' : 'down'}`}>
                          {d >= 0 ? '+' : ''}{(d * 100).toFixed(1)} pts
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
                  Edit a quantity or switch a supplier — every affected product shows here.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <p className="rb-foot">
        Every cost on this page is server-derived from the ingredient master&apos;s preferred supplier link. Edits are
        saved immediately and all affected products are recosted and dual-written, so the rest of the app stays in step.
      </p>

      {fix && (
        <FixDialog
          target={fix}
          busy={busy}
          onClose={() => setFix(null)}
          onApply={applyFix}
          onReveal={revealFailing}
          onOpenComponent={(id) => {
            setFix(null)
            setSel({ type: 'component', id })
            setChecked(new Set())
            setOpenSup(null)
          }}
        />
      )}
    </div>
  )
}

interface SearchHit {
  source: string
  id: string
  code: string | null
  name: string
  ingredientId: string | null
  packSize: string | null
  unitCost: number | null
  unit: string | null
  isPreferred: boolean
  reason: string | null
}

/**
 * One dialog, three remedies, chosen by what actually broke:
 * - unknown-unit / unit-kind-mismatch → restate the line in a unit the price
 *   understands (the only fix that makes the math valid);
 * - missing-ref / unknown-source / unresolvable-price → re-link the line to a
 *   row that exists and has a price;
 * - component rows → the problem is inside the component: reveal the failing
 *   lines, open the component, or repair a broken batch yield.
 */
function FixDialog({
  target,
  busy,
  onClose,
  onApply,
  onReveal,
  onOpenComponent,
}: {
  target: FixTarget
  busy: boolean
  onClose: () => void
  onApply: (owner: FixOwner, body: Record<string, unknown>) => void
  onReveal: (node: TreeNode) => void
  onOpenComponent: (componentId: string) => void
}) {
  const { node, owner } = target
  // Neither remedy that rewrites the row is available on a derived line: there
  // is no stored array here to write it back to.
  const locked = isEditableOrigin(node.origin) ? null : notEditableReason(node.origin)
  const isUnitFix =
    !locked && node.kind === 'ingredient' && (node.reason === 'unknown-unit' || node.reason === 'unit-kind-mismatch')
  const isComponent = node.kind === 'component'
  const badYield = isComponent && node.producedQuantity != null && !(node.producedQuantity > 0)

  // Unit fix state
  const unitOptions =
    node.unitCostUnit === 'kg' ? ['kg', 'g'] :
    node.unitCostUnit === 'l' ? ['l', 'ml'] :
    node.unitCostUnit === 'each' ? ['each'] :
    ['kg', 'g', 'l', 'ml', 'each']
  const [qty, setQty] = useState(String(node.quantity))
  const [unit, setUnit] = useState(unitOptions[0])

  // Re-link search state
  const [term, setTerm] = useState(node.name)
  const [hits, setHits] = useState<SearchHit[] | null>(null)

  // Yield fix state
  const [yQty, setYQty] = useState(node.producedQuantity && node.producedQuantity > 0 ? String(node.producedQuantity) : '1')
  const [yUnit, setYUnit] = useState(node.producedUnit ?? 'unit')

  useEffect(() => {
    if (isUnitFix || isComponent) return
    const q = term.trim()
    if (q.length < 2) { setHits([]); return }
    const t = setTimeout(() => {
      fetch(`/api/ingredients/search?q=${encodeURIComponent(q)}&limit=8`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setHits(Array.isArray(data) ? data : []))
        .catch(() => setHits([]))
    }, 250)
    return () => clearTimeout(t)
  }, [term, isUnitFix, isComponent])

  const applyUnit = () => {
    const q = parseFloat(qty)
    if (!Number.isFinite(q) || q < 0) return
    onApply(owner, { op: 'update', target: targetOf(node), quantity: q, unit })
  }

  const applyRelink = (hit: SearchHit) => {
    onApply(owner, {
      op: 'replace',
      target: targetOf(node),
      line: {
        source: hit.source === 'Master' ? 'Ingredient' : hit.source,
        id: hit.id,
        name: hit.name,
        quantity: node.quantity,
        unit: node.unit ?? hit.unit ?? 'each',
        ...(hit.ingredientId ? { ingredientId: hit.ingredientId } : {}),
        ...(hit.unitCost != null ? { cost: hit.unitCost } : {}),
      },
    })
  }

  const applyYield = () => {
    const q = parseFloat(yQty)
    if (!Number.isFinite(q) || q <= 0 || !node.resolvedComponentId) return
    onApply({ type: 'component', id: node.resolvedComponentId }, {
      op: 'set-yield',
      producedQuantity: q,
      producedUnit: yUnit.trim() || 'unit',
    })
  }

  return (
    <div className="rb-fixOverlay" onClick={onClose}>
      <div className="rb-fixCard" onClick={(e) => e.stopPropagation()}>
        <div className="rb-fixHead">
          <span className="rb-alertDot crit">{node.reason ?? 'issue'}</span>
          <b>{node.name}</b>
          <button className="rb-fixClose" onClick={onClose} aria-label="close">×</button>
        </div>
        {node.note && <div className="rb-fixNote">{node.note}</div>}

        {isUnitFix && (
          <>
            <div className="rb-fixExplain">
              The price for this line is known
              {node.unitCost != null && <> ({money(node.unitCost)}/{node.unitCostUnit})</>}, but the quantity is stated
              in “{node.unit}”, which can&apos;t be converted. Restate the quantity in a unit the price understands:
            </div>
            <div className="rb-fixRow">
              <input
                className="num"
                type="number"
                step="any"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                aria-label="quantity"
              />
              <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="unit">
                {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <button className="rb-fixApply" onClick={applyUnit} disabled={busy}>
                {busy ? 'Saving…' : 'Apply fix'}
              </button>
            </div>
            <div className="rb-fixHint">
              e.g. if one “{node.unit}” weighs 500&nbsp;g, enter {node.quantity} × 0.5 = {(node.quantity * 0.5).toFixed(2)} kg.
            </div>
          </>
        )}

        {locked && !isComponent && <div className="rb-fixExplain">{locked}</div>}

        {!locked && !isUnitFix && !isComponent && (
          <>
            <div className="rb-fixExplain">
              This line&apos;s reference can&apos;t be priced. Re-link it to a catalogue row that exists and has a
              current price — quantity ({node.quantity} {node.unit ?? ''}) is kept:
            </div>
            <input
              className="rb-search rb-fixSearch"
              placeholder="Search catalogues & master…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoFocus
            />
            <div className="rb-fixHits">
              {hits === null ? (
                <div className="rb-fixHint">Searching…</div>
              ) : hits.length ? (
                hits.map((h) => (
                  <button key={`${h.source}:${h.id}`} className="rb-fixHit" disabled={busy || h.unitCost == null} onClick={() => applyRelink(h)}>
                    <span className="nm">
                      {h.name}
                      <span className="meta">{h.source}{h.code ? ` · ${h.code}` : ''}{h.packSize ? ` · ${h.packSize}` : ''}</span>
                    </span>
                    <span className="num price">
                      {h.unitCost != null ? `${money(h.unitCost)}/${h.unit}` : h.reason ?? 'no price'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rb-fixHint">No matches — try fewer words.</div>
              )}
            </div>
          </>
        )}

        {isComponent && (
          <>
            {badYield && node.resolvedComponentId && (
              <>
                <div className="rb-fixExplain">
                  This component&apos;s batch yield is {node.producedQuantity} {node.producedUnit}, so a per-unit cost
                  can&apos;t be derived. Set what one batch actually produces:
                </div>
                <div className="rb-fixRow">
                  <input className="num" type="number" step="any" min="0" value={yQty} onChange={(e) => setYQty(e.target.value)} aria-label="batch yield quantity" />
                  <input value={yUnit} onChange={(e) => setYUnit(e.target.value)} style={{ width: 80 }} aria-label="batch yield unit" />
                  <button className="rb-fixApply" onClick={applyYield} disabled={busy}>
                    {busy ? 'Saving…' : 'Apply fix'}
                  </button>
                </div>
              </>
            )}
            <div className="rb-fixExplain">
              {badYield
                ? 'Or the problem may be inside the component:'
                : 'The problem is inside this component — one or more of its own lines can\u2019t be costed. Find the failing line and click its badge to fix it:'}
            </div>
            <div className="rb-fixRow">
              <button className="rb-fixApply" onClick={() => onReveal(node)} disabled={busy}>
                Show failing lines
              </button>
              {node.resolvedComponentId && (
                <button className="rb-fixAlt" onClick={() => onOpenComponent(node.resolvedComponentId!)} disabled={busy}>
                  Open component
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Later edits win, so a product edited twice shows one row against its original cost. */
function mergeImpact(prev: Impact[], next: Impact[]): Impact[] {
  const byId = new Map(prev.map((i) => [i.id, i]))
  for (const item of next) {
    const existing = byId.get(item.id)
    byId.set(item.id, existing ? { ...item, costBefore: existing.costBefore, marginBefore: existing.marginBefore } : item)
  }
  // Drop rows that have returned to where they started.
  return [...byId.values()].filter((i) => Math.abs((i.costAfter ?? 0) - (i.costBefore ?? 0)) > 0.005)
}

interface TreeRowProps {
  node: TreeNode
  depth: number
  isTop: boolean
  /** The entity whose ingredient array this row lives in. */
  owner: FixOwner
  expanded: Set<string>
  checked: Set<string>
  openSup: string | null
  supDetail: IngredientDetail | null
  busy: boolean
  onToggleExpand: (path: string) => void
  onToggleCheck: (node: TreeNode) => void
  onQty: (node: TreeNode, qty: number) => void
  onRemove: (node: TreeNode) => void
  onOpenSup: (ingredientId: string | null) => void
  onSwitchPreferred: (ingredientId: string, linkId: string) => void
  onFix: (target: FixTarget) => void
}

function TreeRow(props: TreeRowProps) {
  const { node, depth, isTop, expanded, checked, openSup, supDetail, busy } = props
  const [draft, setDraft] = useState(String(node.quantity))
  const lastQty = useRef(node.quantity)

  // Keep the input in step when the server returns a different quantity.
  useEffect(() => {
    if (node.quantity !== lastQty.current) {
      lastQty.current = node.quantity
      setDraft(String(node.quantity))
    }
  }, [node.quantity])

  const indent = depth > 0 ? `rb-indent${Math.min(depth, 3)}` : ''
  const isOpen = expanded.has(node.path)
  const showSup = openSup && openSup === node.ingredientId
  // Option and pack rows are derived, not stored on this owner, so there is no
  // array here to edit. Nested rows belong to their own component's array,
  // which is edited by opening that component.
  const editable = isTop && isEditableOrigin(node.origin)
  const lockedNote = isTop
    ? isEditableOrigin(node.origin)
      ? node.origin === 'base'
        ? 'Part of the base recipe — shared by every variant of this product'
        : undefined
      : notEditableReason(node.origin)
    : 'Open this component to edit its own lines'

  const commitQty = () => {
    const q = Math.max(0, parseFloat(draft) || 0)
    if (Math.abs(q - node.quantity) < 1e-9) return
    if (editable) props.onQty(node, q)
    else setDraft(String(node.quantity))
  }

  return (
    <>
      <div className={`rb-row${node.kind === 'component' ? ' compRow' : ''}`}>
        <div className={`name ${indent}`}>
          {isTop && (
            <input
              type="checkbox"
              className="rb-rowCk"
              checked={checked.has(rowKey(node))}
              disabled={!editable}
              title={lockedNote}
              onChange={() => props.onToggleCheck(node)}
              aria-label="select line"
            />
          )}
          {node.kind === 'component' ? (
            <button
              className={`rb-caret${isOpen ? ' open' : ''}`}
              onClick={() => props.onToggleExpand(node.path)}
              aria-label="expand"
            >
              ▶
            </button>
          ) : (
            <span className="rb-caret blank">▶</span>
          )}
          <span className="nm" title={node.name}>{node.name}</span>
          {node.kind === 'component' ? (
            <span className="rb-srcBadge comp">Component</span>
          ) : node.ingredientId ? (
            <button
              className="rb-srcBadge"
              onClick={() => props.onOpenSup(node.ingredientId)}
              title="Preferred supplier — click to compare"
            >
              {node.supplier ?? node.source}
            </button>
          ) : (
            <span className="rb-srcBadge" title="Not linked to the ingredient master yet">
              {node.supplier ?? node.source}
            </span>
          )}
          {node.reason && (
            <button
              className="rb-alertDot crit clickable"
              title={`${node.note ?? node.reason} — click to fix`}
              onClick={() => props.onFix({ node, owner: props.owner })}
            >
              {node.reason} ⚒
            </button>
          )}
          {node.confidence != null && node.confidence < 0.6 && !node.reason && (
            <span className="rb-alertDot" title={`Pack reading confidence ${node.confidence.toFixed(2)}`}>pack?</span>
          )}
        </div>
        <div className="rb-qty">
          <input
            className="num"
            type="number"
            step="any"
            value={draft}
            disabled={busy || !editable}
            title={lockedNote}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="quantity"
          />
          <span className="unit">{node.unit ?? node.producedUnit ?? ''}</span>
        </div>
        <div className="rb-cell num">
          {money(node.unitCost)}
          <span className="per">/{node.unitCostUnit ?? node.producedUnit ?? 'unit'}{node.kind === 'component' ? ' · batch' : ''}</span>
        </div>
        <div className="rb-cell num">
          {money(node.lineCost)}
          {isTop && (
            <button
              className="rb-del"
              title={editable ? lockedNote ?? 'Remove line' : lockedNote}
              onClick={() => props.onRemove(node)}
              disabled={busy || !editable}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {showSup && (
        <div className="rb-supPop">
          <div className="t">Supplier links — {supDetail?.name ?? node.name} (per {supDetail?.canonicalUnit ?? node.unitCostUnit})</div>
          {!supDetail ? (
            <div style={{ color: 'var(--faint)' }}>Loading…</div>
          ) : supDetail.links.length ? (
            <>
              {supDetail.links.map((link) => (
                <label key={link.id} className="rb-supOpt">
                  <input
                    type="radio"
                    name={`sup-${supDetail.id}`}
                    checked={link.rank === 1}
                    disabled={busy}
                    onChange={() => props.onSwitchPreferred(supDetail.id, link.id)}
                  />
                  <span className="sname">
                    {link.source} <span className="rank">· {link.sourceId.slice(0, 12)} · {link.rank === 1 ? 'preferred' : `rank ${link.rank}`}</span>
                  </span>
                  <span className="num">{link.latestUnitCost == null ? '—' : `${money(link.latestUnitCost)}/${supDetail.canonicalUnit}`}</span>
                </label>
              ))}
              <div style={{ color: 'var(--faint)', fontSize: 11, marginTop: 4 }}>
                {supDetail.links.length > 1
                  ? 'Switching reprices every recipe using this ingredient — see “Impact of your edits”.'
                  : 'Only one supplier linked. Merge duplicate ingredients to compare suppliers here.'}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--faint)' }}>No supplier links.</div>
          )}
        </div>
      )}

      {node.kind === 'component' &&
        isOpen &&
        (node.children ?? []).map((child) => (
          <TreeRow
            {...props}
            key={child.path}
            node={child}
            depth={depth + 1}
            isTop={false}
            // Children live in this component's own ingredient array, so fixes
            // to them must be addressed to the component, not the selection.
            owner={
              node.resolvedComponentId
                ? { type: 'component', id: node.resolvedComponentId }
                : props.owner
            }
          />
        ))}
    </>
  )
}
