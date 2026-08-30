'use client'

// Cost the option, not the variant.
//
// The shop's ~1,300 variants are built from ~100 choices. Each choice is
// costed once here and a variant's cost is its product's base recipe plus the
// recipe of every choice in its title, so nothing has to be kept in sync.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Link2, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IngredientSelector } from '@/components/IngredientSelector'

interface RecipeRow {
  source: string
  id: string
  name: string
  quantity: number
  cost: number
  unit: string
}

interface Suggestion {
  source: 'Components'
  id: string
  name: string
  cost: number
}

interface OptionSummary {
  id: string
  name: string
  kind: string
  items: RecipeRow[]
  noIngredients: boolean
  notes: string | null
  aliases: string[]
  variantCount: number
  productCount: number
  suggestions: Suggestion[]
  foldCandidates: Array<{ id: string; name: string; portionCost: number; variantCount: number }>
  portionCost: number
}

interface UnassignedSegment {
  value: string
  variantCount: number
  suggestions: Suggestion[]
  likelyOption: { id: string; name: string } | null
}

interface Catalogue {
  options: OptionSummary[]
  unassigned: UnassignedSegment[]
  repriceNeeded: boolean
  totals: {
    variants: number
    spellings: number
    options: number
    uncostedOptions: number
    variantChoicesUncosted: number
  }
}

interface ProductOption {
  id: string
  name: string
  kind: string
  items: string[]
  costed: boolean
  quantity: number | null
}

interface ProductRow {
  id: string
  title: string
  portionSize: number
  variantCount: number
  price: number
  baseItems: string[]
  options: ProductOption[]
}

const money = (n: number) => `$${n.toFixed(2)}`

function statusOf(option: OptionSummary): 'costed' | 'free' | 'missing' {
  if (option.noIngredients) return 'free'
  return option.items.length > 0 ? 'costed' : 'missing'
}

export function CostingTab() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'options' | 'products' | 'unassigned'>('options')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RecipeRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [repricing, setRepricing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/costing/options')
      if (!res.ok) throw new Error(await res.text())
      const data: Catalogue = await res.json()
      setCatalogue(data)
      setSelectedId((prev) => prev ?? data.options[0]?.id ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load costing options')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(
    () => catalogue?.options.find((o) => o.id === selectedId) ?? null,
    [catalogue, selectedId]
  )

  // A fresh selection discards any half-finished edit rather than carrying it
  // onto the next option.
  useEffect(() => {
    setDraft(null)
  }, [selectedId])

  const filtered = useMemo(() => {
    if (!catalogue) return []
    const q = search.trim().toLowerCase()
    if (!q) return catalogue.options
    return catalogue.options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.aliases.some((a) => a.toLowerCase().includes(q)) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
    )
  }, [catalogue, search])

  const patchOption = async (id: string, body: Record<string, unknown>, message?: string) => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/costing/options/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Save failed')
      setDraft(null)
      await load()
      if (message) setNotice(message)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const foldOption = async (id: string, intoOptionId: string) => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/costing/options/${id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intoOptionId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Fold failed')
      const data = await res.json()
      setSelectedId(intoOptionId)
      await load()
      setNotice(`Folded ${data.movedSpellings} spelling(s) into ${data.into}.`)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Fold failed')
    } finally {
      setBusy(false)
    }
  }

  const reprice = async () => {
    setRepricing(true)
    setNotice(null)
    try {
      const res = await fetch('/api/costing/reprice', { method: 'POST' })
      if (!res.ok) throw new Error('Reprice failed')
      const data = await res.json()
      setNotice(
        `Repriced ${data.variantsUpdated} variant(s) and ${data.componentsUpdated} component(s) in ${Math.round(data.durationMs / 1000)}s.`
      )
      await load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Reprice failed')
    } finally {
      setRepricing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading costing options…
      </div>
    )
  }

  if (error || !catalogue) {
    return <div className="p-8 text-sm text-red-600">{error ?? 'No costing data'}</div>
  }

  const { totals } = catalogue

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Costing</h2>
          <p className="text-sm text-slate-500">
            {totals.variants.toLocaleString()} variants are built from {totals.options} choices. Cost each
            choice once and every variant that offers it is costed.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <div className="text-xl font-semibold text-slate-900">{totals.options}</div>
            <div className="text-xs text-slate-500">options</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-red-600">{totals.uncostedOptions}</div>
            <div className="text-xs text-slate-500">with no recipe</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-red-600">
              {totals.variantChoicesUncosted.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">variant choices uncosted</div>
          </div>
        </div>
      </div>

      {catalogue.repriceNeeded && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Options have changed since the last reprice, so stored variant costs are out of date.</span>
          <Button size="sm" onClick={reprice} disabled={repricing}>
            {repricing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            Reprice now
          </Button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {([
          ['options', `Options (${totals.options})`],
          ['products', 'Pack sizes'],
          ['unassigned', `Unassigned (${catalogue.unassigned.length})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`px-3 py-2 text-sm ${
              view === id
                ? 'border-b-2 border-[#FF701F] font-medium text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'options' && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search choices, spellings or components"
                className="pl-8"
              />
            </div>
            <div className="max-h-[600px] overflow-y-auto rounded-md border border-slate-200">
              {filtered.map((option) => {
                const status = statusOf(option)
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedId(option.id)}
                    className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
                      option.id === selectedId ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        status === 'costed'
                          ? 'bg-green-500'
                          : status === 'free'
                            ? 'bg-slate-300'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{option.name}</span>
                    {option.aliases.length > 0 && (
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {option.aliases.length + 1} spellings
                      </span>
                    )}
                    <span className="w-8 shrink-0 text-right text-xs text-slate-500">
                      {option.variantCount}
                    </span>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="p-3 text-sm text-slate-500">No choices match that search.</p>
              )}
            </div>
          </div>

          {selected ? (
            <OptionDetail
              key={selected.id}
              option={selected}
              busy={busy}
              draft={draft}
              onDraftChange={setDraft}
              onPatch={patchOption}
              onFold={foldOption}
            />
          ) : (
            <p className="text-sm text-slate-500">Pick a choice on the left.</p>
          )}
        </div>
      )}

      {view === 'products' && <PackSizesView onSaved={load} />}

      {view === 'unassigned' && (
        <UnassignedView
          segments={catalogue.unassigned}
          options={catalogue.options}
          busy={busy}
          onAttach={(optionId, value) => patchOption(optionId, { addAliases: [value] }, `"${value}" now costs as that choice.`)}
        />
      )}
    </div>
  )
}

function OptionDetail({
  option,
  busy,
  draft,
  onDraftChange,
  onPatch,
  onFold,
}: {
  option: OptionSummary
  busy: boolean
  draft: RecipeRow[] | null
  onDraftChange: (rows: RecipeRow[]) => void
  onPatch: (id: string, body: Record<string, unknown>, message?: string) => Promise<void>
  onFold: (id: string, intoOptionId: string) => void
}) {
  const rows = draft ?? option.items
  const dirty = draft !== null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{option.name}</h3>
          <p className="text-sm text-slate-500">
            Chosen on {option.variantCount} variant{option.variantCount === 1 ? '' : 's'} across{' '}
            {option.productCount} product{option.productCount === 1 ? '' : 's'}
            {option.items.length > 0 && ` · ${money(option.portionCost)} per portion`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {option.kind}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              onPatch(
                option.id,
                { noIngredients: !option.noIngredients },
                option.noIngredients
                  ? `${option.name} needs a recipe again.`
                  : `${option.name} marked as costing nothing.`
              )
            }
          >
            {option.noIngredients ? 'Needs a recipe' : 'Costs nothing'}
          </Button>
        </div>
      </div>

      {option.noIngredients ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Marked as costing nothing, so it is not counted as a gap. Gift-card values, headcount pickers and
          the &quot;No …&quot; toggles belong here.
        </div>
      ) : (
        <>
          {option.foldCandidates.length > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-900">
                This looks like another choice that is already costed.
              </p>
              <p className="mt-1 text-xs text-blue-800">
                Folding moves every spelling across and removes this entry, so the two stop drifting apart.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {option.foldCandidates.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onFold(option.id, c.id)}
                  >
                    <Link2 className="mr-1 h-3 w-3" />
                    Fold into {c.name} · {money(c.portionCost)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {option.items.length === 0 && option.suggestions.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                Nothing is costing this choice, so all {option.variantCount} variants that offer it are
                short.
              </p>
              <p className="mt-1 text-xs text-amber-800">
                These components already exist and look like a match:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {option.suggestions.map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      onPatch(
                        option.id,
                        {
                          items: [
                            { source: 'Components', id: s.id, name: s.name, quantity: 1, cost: s.cost, unit: 'unit' },
                          ],
                        },
                        `${option.name} now costs ${money(s.cost)} per portion.`
                      )
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {s.name} · {money(s.cost)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">Recipe for one portion</h4>
              {dirty && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onDraftChange(option.items)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onPatch(option.id, { items: rows }, `Saved ${option.name}.`)}
                  >
                    {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                    Save
                  </Button>
                </div>
              )}
            </div>
            <IngredientSelector
              initialIngredients={option.items as any}
              onIngredientsChange={(next) => onDraftChange(next as RecipeRow[])}
            />
            <p className="mt-2 text-xs text-slate-500">
              Quantities here are per portion. A larger pack uses more portions — set that once per product
              under Pack sizes, not here.
            </p>
          </div>
        </>
      )}

      <div>
        <h4 className="mb-1 text-sm font-medium text-slate-700">Spellings folded into this choice</h4>
        <p className="mb-2 text-xs text-slate-500">
          How Shopify writes it. The storefront is untouched; only costing treats these as one thing.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-700">
            {option.name}
            <span className="ml-1.5 text-slate-400">canonical</span>
          </span>
          {option.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
            >
              {alias}
              <button
                disabled={busy}
                onClick={() =>
                  onPatch(option.id, { removeAliases: [alias] }, `"${alias}" is unassigned again.`)
                }
                className="text-slate-400 hover:text-red-600"
                title="Detach this spelling"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function UnassignedView({
  segments,
  options,
  busy,
  onAttach,
}: {
  segments: UnassignedSegment[]
  options: OptionSummary[]
  busy: boolean
  onAttach: (optionId: string, value: string) => void
}) {
  const [picking, setPicking] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  if (segments.length === 0) {
    return (
      <p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Every choice on every variant is attached to a costed option. New spellings from Shopify will appear
        here.
      </p>
    )
  }

  const matches = options
    .filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8)

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        Title segments with no option behind them. Until one is attached, the variants that use them carry no
        cost for that choice.
      </p>
      {segments.map((segment) => (
        <div
          key={segment.value}
          className="rounded-md border border-slate-200 p-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-slate-800">{segment.value}</span>
            <span className="text-xs text-slate-500">{segment.variantCount} variants</span>
            <div className="ml-auto flex items-center gap-2">
              {segment.likelyOption && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onAttach(segment.likelyOption!.id, segment.value)}
                >
                  <Link2 className="mr-1 h-3 w-3" />
                  Attach to {segment.likelyOption.name}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPicking(picking === segment.value ? null : segment.value)}
              >
                Choose another
              </Button>
            </div>
          </div>

          {picking === segment.value && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search options"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5">
                {matches.map((o) => (
                  <Button
                    key={o.id}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      onAttach(o.id, segment.value)
                      setPicking(null)
                    }}
                  >
                    {o.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PackSizesView({ onSaved }: { onSaved: () => void }) {
  const [products, setProducts] = useState<ProductRow[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { portionSize: string; quantities: Record<string, string> }>>({})

  const load = useCallback(async () => {
    const res = await fetch('/api/costing/products')
    if (!res.ok) return
    const data = await res.json()
    setProducts(data.products)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!products) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
      </div>
    )
  }

  const draftFor = (product: ProductRow) =>
    drafts[product.id] ?? {
      portionSize: String(product.portionSize),
      quantities: Object.fromEntries(
        product.options.map((o) => [o.id, o.quantity == null ? '' : String(o.quantity)])
      ),
    }

  const save = async (product: ProductRow) => {
    const draft = draftFor(product)
    setSaving(product.id)
    try {
      await fetch('/api/costing/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          portionSize: Number(draft.portionSize) || 1,
          quantities: Object.entries(draft.quantities).map(([optionId, value]) => ({
            optionId,
            quantity: value === '' ? null : Number(value),
          })),
        }),
      })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[product.id]
        return next
      })
      await load()
      onSaved()
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        A choice costs the same everywhere; only how much of it a pack uses changes. Set the pack size once
        and every choice on that product scales with it.
      </p>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Variants</th>
              <th className="px-3 py-2 text-right">Choices</th>
              <th className="px-3 py-2 text-right">Pack size</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const draft = draftFor(product)
              const isOpen = expanded === product.id
              const uncosted = product.options.filter((o) => !o.costed).length
              return (
                <Fragment key={product.id}>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="text-slate-800">{product.title}</span>
                      {uncosted > 0 && (
                        <span className="ml-2 text-xs text-red-600">{uncosted} uncosted</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {product.price ? money(product.price) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{product.variantCount}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{product.options.length}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        value={draft.portionSize}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [product.id]: { ...draft, portionSize: e.target.value },
                          }))
                        }
                        className="ml-auto h-7 w-16 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {product.options.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpanded(isOpen ? null : product.id)}
                          >
                            {isOpen ? 'Hide' : 'Per choice'}
                          </Button>
                        )}
                        {drafts[product.id] && (
                          <Button size="sm" disabled={saving === product.id} onClick={() => save(product)}>
                            {saving === product.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={6} className="px-3 py-3">
                        {product.baseItems.length > 0 ? (
                          <p className="mb-3 text-xs text-slate-600">
                            <span className="font-medium">In every box:</span>{' '}
                            {product.baseItems.join(' · ')}
                          </p>
                        ) : (
                          <p className="mb-3 text-xs text-red-600">
                            This product has no base recipe, so its packaging and sides are uncosted.
                          </p>
                        )}
                        <div className="space-y-1">
                          {product.options.map((option) => (
                            <div key={option.id} className="flex items-center gap-3 text-xs">
                              <span className="w-64 shrink-0 truncate text-slate-700">{option.name}</span>
                              <span className="flex-1 truncate text-slate-500">
                                {option.costed ? option.items.join(', ') : 'no recipe yet'}
                              </span>
                              <span className="text-slate-400">portions</span>
                              <Input
                                value={draft.quantities[option.id] ?? ''}
                                placeholder={String(draft.portionSize)}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...draft,
                                      quantities: { ...draft.quantities, [option.id]: e.target.value },
                                    },
                                  }))
                                }
                                className="h-7 w-16 text-right"
                              />
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Blank uses the pack size. Enter a number only where a choice differs.
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
