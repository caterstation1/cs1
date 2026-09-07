'use client'

import { useEffect, useState } from 'react'
import { format, addDays, addWeeks, startOfWeek } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type BakeryItem = {
  name: string
  unitCost: number | null
  perDay: number[]
  alignedOtherProductId?: string | null
  alignedOtherProductName?: string | null
}

type BnbSummary = {
  days: string[]
  butcher: {
    chicken: number[]
    ham: number[]
    chickenKgPerUnit: number
    hamKgPerUnit: number
    chickenCostPerKg: number | null
    hamCostPerKg: number | null
    chickenProductName: string | null
    hamProductName: string | null
  }
  bakery: {
    items: BakeryItem[]
  }
}

type OtherProduct = {
  id: string
  name: string
  supplier: string
  cost: number
}

const INITIAL_WEEKS = 13
const WEEKS_PER_PAGE = 13

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const left = format(monday, sameMonth ? 'EEE d' : 'EEE d MMM')
  const right = format(sunday, 'EEE d MMM yyyy')
  return `${left} – ${right}`
}

function WeekSection({ monday }: { monday: Date }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<BnbSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startKey = format(monday, 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bnb/summary?start=${startKey}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load this week. Try refresh.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !data && !loading) load()
  }

  return (
    <div className="border rounded-lg bg-white">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="font-medium">{weekLabel(monday)}</span>
        <span className="flex items-center gap-3">
          {open && data && <WeekGrandTotal data={data} />}
          <span className="text-gray-400">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && (
        <div className="border-t px-4 py-4 space-y-6">
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
          {error && (
            <div className="text-sm text-red-600 flex items-center gap-3">
              {error}
              <Button variant="outline" size="sm" onClick={load}>Retry</Button>
            </div>
          )}
          {data && (
            <>
              <ButcherTable data={data} />
              <BakeryTable data={data} reload={load} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function butcherTotals(data: BnbSummary) {
  const b = data.butcher
  const chickenCount = sum(b.chicken)
  const hamCount = sum(b.ham)
  const chickenKg = chickenCount * b.chickenKgPerUnit
  const hamKg = hamCount * b.hamKgPerUnit
  const chickenValue = b.chickenCostPerKg != null ? chickenKg * b.chickenCostPerKg : null
  const hamValue = b.hamCostPerKg != null ? hamKg * b.hamCostPerKg : null
  const total = (chickenValue ?? 0) + (hamValue ?? 0)
  return { chickenCount, hamCount, chickenKg, hamKg, chickenValue, hamValue, total }
}

function bakeryTotals(data: BnbSummary) {
  let total = 0
  let missingCost = false
  for (const item of data.bakery.items) {
    if (item.unitCost == null) {
      if (sum(item.perDay) > 0) missingCost = true
      continue
    }
    total += sum(item.perDay) * item.unitCost
  }
  return { total, missingCost }
}

function WeekGrandTotal({ data }: { data: BnbSummary }) {
  const b = butcherTotals(data)
  const bk = bakeryTotals(data)
  return (
    <span className="text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {money(b.total + bk.total)}
    </span>
  )
}

function DayHeaders({ days }: { days: string[] }) {
  return (
    <>
      {days.map(d => (
        <th key={d} className="border px-2 py-1 text-right font-medium">
          {format(new Date(`${d}T00:00:00`), 'EEE d')}
        </th>
      ))}
    </>
  )
}

function ButcherTable({ data }: { data: BnbSummary }) {
  const b = data.butcher
  const t = butcherTotals(data)

  const rows = [
    {
      key: 'C',
      label: 'Chicken (C)',
      perDay: b.chicken,
      count: t.chickenCount,
      kg: t.chickenKg,
      kgPerUnit: b.chickenKgPerUnit,
      costPerKg: b.chickenCostPerKg,
      value: t.chickenValue,
      priceSource: b.chickenProductName
    },
    {
      key: 'H',
      label: 'Ham (H)',
      perDay: b.ham,
      count: t.hamCount,
      kg: t.hamKg,
      kgPerUnit: b.hamKgPerUnit,
      costPerKg: b.hamCostPerKg,
      value: t.hamValue,
      priceSource: b.hamProductName
    }
  ]

  const missing = rows.filter(r => r.costPerKg == null && r.count > 0)

  return (
    <div>
      <h3 className="font-semibold mb-2">Butcher — Grey Lynn Butcher</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-2 py-1 text-left font-medium">Item</th>
              <DayHeaders days={data.days} />
              <th className="border px-2 py-1 text-right font-medium">Units</th>
              <th className="border px-2 py-1 text-right font-medium">Kg</th>
              <th className="border px-2 py-1 text-right font-medium">$/kg</th>
              <th className="border px-2 py-1 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key}>
                <td className="border px-2 py-1">
                  {r.label}
                  <span className="text-gray-400 text-xs ml-1">× {r.kgPerUnit}kg</span>
                </td>
                {r.perDay.map((n, i) => (
                  <td key={i} className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {n || ''}
                  </td>
                ))}
                <td className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.count}</td>
                <td className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.kg.toFixed(1)}</td>
                <td className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {r.costPerKg != null ? money(r.costPerKg) : '—'}
                </td>
                <td className="border px-2 py-1 text-right font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {r.value != null ? money(r.value) : '—'}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="border px-2 py-1" colSpan={data.days.length + 4}>Butcher total</td>
              <td className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(t.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {missing.length > 0 && (
        <p className="text-xs text-amber-700 mt-1">
          No price found on the Other tab for {missing.map(r => r.label).join(' and ')} — add
          {missing.some(r => r.key === 'C') ? ' a "Chicken thigh dice"' : ''}
          {missing.length === 2 ? ' and' : ''}
          {missing.some(r => r.key === 'H') ? ' a "Sliced ham"' : ''} item with a per-kg cost. Values above exclude it.
        </p>
      )}
    </div>
  )
}

function AlignBakeryItemDialog({
  item,
  onClose,
  onSaved,
}: {
  item: BakeryItem
  onClose: () => void
  onSaved: () => void
}) {
  const [products, setProducts] = useState<OtherProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>(item.alignedOtherProductId || '')
  const [costDraft, setCostDraft] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/other', { cache: 'no-store' })
        const json = await res.json()
        if (!mounted) return
        const rows: OtherProduct[] = Array.isArray(json.products) ? json.products : []
        setProducts(rows)
        // Prefill the cost input from the currently aligned product
        if (item.alignedOtherProductId) {
          const current = rows.find(p => p.id === item.alignedOtherProductId)
          if (current) setCostDraft(String(current.cost ?? ''))
        }
      } catch {
        if (mounted) setError('Could not load Other tab products.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [item.alignedOtherProductId])

  const selectProduct = (p: OtherProduct) => {
    setSelectedId(p.id)
    setCostDraft(String(p.cost ?? ''))
  }

  const filtered = products.filter(p => {
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return `${p.name} ${p.supplier}`.toLowerCase().includes(needle)
  })

  const save = async () => {
    if (!selectedId) {
      setError('Select a product first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/bnb/alignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bakeryItemName: item.name,
          otherProductId: selectedId,
          ...(costDraft.trim() !== '' ? { cost: costDraft.trim() } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || 'Failed to save alignment.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Align &ldquo;{item.name}&rdquo;</DialogTitle>
          <DialogDescription>
            Pick the Other-tab product used to price this bakery item. You can also update its cost.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto border rounded divide-y">
            {loading ? (
              <div className="p-3 text-sm text-gray-500">Loading products…</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No matching products.</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                    selectedId === p.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{p.supplier}</span>
                  </span>
                  <span className="text-gray-600 whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(p.cost || 0)}
                  </span>
                </button>
              ))
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit cost ($)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={costDraft}
              onChange={(e) => setCostDraft(e.target.value)}
              placeholder="Leave unchanged to keep current cost"
            />
            <p className="text-xs text-gray-400 mt-1">
              Changing this updates the product&apos;s cost on the Other tab too.
            </p>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !selectedId}>
            {saving ? 'Saving…' : 'Save alignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BakeryTable({ data, reload }: { data: BnbSummary; reload: () => void }) {
  const items = data.bakery.items.filter(it => sum(it.perDay) > 0)
  const t = bakeryTotals(data)
  const [aligningItem, setAligningItem] = useState<BakeryItem | null>(null)

  return (
    <div>
      <h3 className="font-semibold mb-2">Bakery — Golden Kit Bakehouse</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No bakery items ordered this week.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-2 py-1 text-left font-medium">Item</th>
                <DayHeaders days={data.days} />
                <th className="border px-2 py-1 text-right font-medium">Units</th>
                <th className="border px-2 py-1 text-right font-medium">Unit cost</th>
                <th className="border px-2 py-1 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const count = sum(item.perDay)
                const value = item.unitCost != null ? count * item.unitCost : null
                return (
                  <tr key={item.name}>
                    <td className="border px-2 py-1">
                      {item.name}
                      {item.alignedOtherProductName ? (
                        <span className="text-gray-400 text-xs ml-1">via {item.alignedOtherProductName}</span>
                      ) : null}
                    </td>
                    {item.perDay.map((n, i) => (
                      <td key={i} className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {n || ''}
                      </td>
                    ))}
                    <td className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</td>
                    <td className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {item.unitCost != null ? (
                        item.alignedOtherProductId ? (
                          <button
                            type="button"
                            className="underline decoration-dotted hover:text-blue-600"
                            title={`Priced via ${item.alignedOtherProductName}. Click to change.`}
                            onClick={() => setAligningItem(item)}
                          >
                            {money(item.unitCost)}
                          </button>
                        ) : (
                          money(item.unitCost)
                        )
                      ) : (
                        <button
                          type="button"
                          className="text-amber-700 underline decoration-dotted hover:text-amber-900"
                          title="No cost found — align this item to an Other tab product"
                          onClick={() => setAligningItem(item)}
                        >
                          Align
                        </button>
                      )}
                    </td>
                    <td className="border px-2 py-1 text-right font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {value != null ? money(value) : '—'}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="border px-2 py-1" colSpan={data.days.length + 3}>Bakery total</td>
                <td className="border px-2 py-1 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(t.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {t.missingCost && (
        <p className="text-xs text-amber-700 mt-1">
          Some bakery items have no cost — their value is excluded from the total. Click &ldquo;Align&rdquo; on the
          item to link it to a product from the products page Other tab.
        </p>
      )}
      {aligningItem && (
        <AlignBakeryItemDialog
          item={aligningItem}
          onClose={() => setAligningItem(null)}
          onSaved={reload}
        />
      )}
    </div>
  )
}

export default function BnbPage() {
  const [weeksShown, setWeeksShown] = useState(INITIAL_WEEKS)

  const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const mondays = Array.from({ length: weeksShown }, (_, i) => addWeeks(currentMonday, -i))

  return (
    <div className="container mx-auto py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">B&amp;B</h1>
        <p className="text-sm text-gray-500 mt-1">
          Weekly amounts owed to the butcher (Grey Lynn Butcher) and the bakery (Golden Kit Bakehouse), calculated from orders.
        </p>
      </div>

      <div className="space-y-2">
        {mondays.map(monday => (
          <WeekSection key={monday.toISOString()} monday={monday} />
        ))}
      </div>

      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={() => setWeeksShown(n => n + WEEKS_PER_PAGE)}>
          Show earlier weeks
        </Button>
      </div>
    </div>
  )
}
