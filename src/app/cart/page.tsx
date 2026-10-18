'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, Loader2 } from 'lucide-react'
import { formatLocalDate, parseLocalDate } from '@/lib/date-utils'
import { toCsv } from '@/lib/dashboard/csv'

const PRESETS: Array<{ label: string; offset: number; span: number }> = [
  { label: 'Today', offset: 0, span: 1 },
  { label: 'Tomorrow', offset: 1, span: 1 },
  { label: 'Next 2 days', offset: 0, span: 2 },
  { label: 'Next 7 days', offset: 0, span: 7 },
]

function shiftToday(offset: number): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
}

function describeRange(start: string, end: string): string {
  const from = parseLocalDate(start)
  const to = parseLocalDate(end)
  if (!from || !to) return 'selected dates'
  const fmt = (d: Date) => d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
  return from.getTime() === to.getTime() ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

type Suggestion = { id: string; name: string; sku?: string; supplier: string; requiredQty: number; unit?: string; breakdown?: Array<{ source: string; name: string; unit?: string; qty: number }> }
type CartItem = { id: string; name: string; sku?: string | null; supplier: string; qty: number; notes?: string | null }

export default function CartPage() {
  const [city, setCity] = useState<'AKL'|'WLG'>('AKL')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({ name: '', supplier: 'Other', sku: '', qty: 1, notes: '' })
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<Suggestion | null>(null)
  const [range, setRange] = useState(() => ({
    start: formatLocalDate(shiftToday(0)),
    end: formatLocalDate(shiftToday(1)),
  }))
  const [orderCount, setOrderCount] = useState(0)

  const suggestQuery = `city=${city}&start=${range.start}&end=${range.end}`

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cart/suggest?${suggestQuery}`, { cache: 'no-store' })
      const s = await res.json()
      const c = await fetch(`/api/cart?city=${city}`, { cache: 'no-store' }).then(r=>r.json())
      setSuggestions(Array.isArray(s) ? s : [])
      setOrderCount(Number(res.headers.get('X-Order-Count') || '0'))
      setCart(Array.isArray(c) ? c : [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=> { fetchAll() }, [city, range.start, range.end])

  const applyPreset = (offset: number, span: number) => {
    setRange({
      start: formatLocalDate(shiftToday(offset)),
      end: formatLocalDate(shiftToday(offset + span - 1)),
    })
  }

  // Keep the range valid when either end is typed past the other.
  const setStart = (value: string) => setRange(prev => ({ start: value, end: prev.end < value ? value : prev.end }))
  const setEnd = (value: string) => setRange(prev => ({ start: value < prev.start ? value : prev.start, end: value }))

  const addToCart = async (s: Suggestion, qty: number) => {
    if (!qty || qty <= 0) return
    setAdding(s.id)
    try {
      await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, name: s.name, supplier: s.supplier, sku: s.sku, qty })
      })
      await fetchAll()
    } finally {
      setAdding(null)
    }
  }

  const removeCartItem = async (id: string) => {
    await fetch(`/api/cart/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  const clearCart = async () => {
    await fetch(`/api/cart/clear?city=${city}`, { method: 'POST' })
    await fetchAll()
  }

  const manualAdd = async () => {
    if (!manual.name || manual.qty <= 0) return
    await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, name: manual.name, supplier: manual.supplier, sku: manual.sku || undefined, qty: manual.qty, notes: manual.notes || undefined })
    })
    setManualOpen(false)
    setManual({ name: '', supplier: 'Other', sku: '', qty: 1, notes: '' })
    await fetchAll()
  }

  const sortedSuggestions = useMemo(() => [...suggestions].sort((a, b)=> b.requiredQty - a.requiredQty), [suggestions])

  const downloadCsv = () => {
    const csv = toCsv(
      sortedSuggestions.map(s => ({
        Name: s.name,
        Supplier: s.supplier,
        SKU: s.sku || '',
        Required: s.requiredQty.toFixed(2),
        Unit: s.unit || '',
      })),
      ['Name', 'Supplier', 'SKU', 'Required', 'Unit']
    )
    const span = range.start === range.end ? range.start : `${range.start}_to_${range.end}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `needed-${city}-${span}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Cart</h1>
        <div className="flex items-center gap-2">
          <Tabs defaultValue={city} onValueChange={(v)=> setCity(v as any)}>
            <TabsList>
              <TabsTrigger value="AKL">AKL</TabsTrigger>
              <TabsTrigger value="WLG">WLG</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-1" />Loading...</>) : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={()=> setManualOpen(true)}>Manual Add</Button>
          <Button variant="destructive" size="sm" onClick={clearCart}>Clear Cart</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div>
          <label className="block text-xs text-muted-foreground">From</label>
          <Input type="date" value={range.start} onChange={e=> setStart(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">To</label>
          <Input type="date" value={range.end} onChange={e=> setEnd(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <Button
              key={preset.label}
              variant={
                range.start === formatLocalDate(shiftToday(preset.offset))
                  && range.end === formatLocalDate(shiftToday(preset.offset + preset.span - 1))
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={()=> applyPreset(preset.offset, preset.span)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suggestions */}
        <div>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Needed for {describeRange(range.start, range.end)}</h2>
              <p className="text-xs text-muted-foreground">
                {orderCount} {orderCount === 1 ? 'order' : 'orders'} · {suggestions.length} items to cover
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={sortedSuggestions.length === 0}>
              <Download className="h-4 w-4 mr-1" />Download CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-2 py-1 text-left">Name</th>
                  <th className="border px-2 py-1 text-left">Supplier</th>
                  <th className="border px-2 py-1 text-left">SKU</th>
                  <th className="border px-2 py-1 text-right">Required</th>
                  <th className="border px-2 py-1 text-right">Qty to Order</th>
                  <th className="border px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && sortedSuggestions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border px-2 py-4 text-center text-sm text-muted-foreground">
                      {orderCount === 0
                        ? `No ${city} orders scheduled for ${describeRange(range.start, range.end)}.`
                        : `No mapped ingredients for the ${orderCount} order(s) in this range.`}
                    </td>
                  </tr>
                ) : null}
                {sortedSuggestions.map(s => (
                  <tr key={s.id}>
                    <td className="border px-2 py-1">{s.name}</td>
                    <td className="border px-2 py-1">{s.supplier}</td>
                    <td className="border px-2 py-1">{s.sku || ''}</td>
                    <td className="border px-2 py-1 text-right">{s.requiredQty.toFixed(2)} {s.unit || ''}</td>
                    <td className="border px-2 py-1 text-right">
                      {/* remount on range change so the default follows the recalculated requirement */}
                      <Input key={`${range.start}:${range.end}`} defaultValue={s.requiredQty} type="number" min="0" step="0.01" className="w-24 text-right" id={`qty-${s.id}`} />
                    </td>
                    <td className="border px-2 py-1 text-center space-x-2">
                      <Button variant="outline" size="sm" onClick={async () => {
                        // fetch with debug=1 to get breakdown
                        const arr: Suggestion[] = await fetch(`/api/cart/suggest?${suggestQuery}&debug=1`, { cache: 'no-store' }).then(r => r.json())
                        const found = arr.find(x => x.id === s.id) || s
                        setDetail(found)
                        setDetailOpen(true)
                      }}>Details</Button>
                      <Button size="sm" onClick={() => {
                        const input = document.getElementById(`qty-${s.id}`) as HTMLInputElement | null
                        const val = input ? parseFloat(input.value || '0') : s.requiredQty
                        addToCart(s, isNaN(val) ? 0 : val)
                      }} disabled={adding === s.id}>
                        {adding === s.id ? 'Adding…' : 'Add to cart'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cart */}
        <div>
          <h2 className="font-semibold mb-2">Cart</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-2 py-1 text-left">Name</th>
                  <th className="border px-2 py-1 text-left">Supplier</th>
                  <th className="border px-2 py-1 text-left">SKU</th>
                  <th className="border px-2 py-1 text-right">Qty</th>
                  <th className="border px-2 py-1 text-left">Notes</th>
                  <th className="border px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.id}>
                    <td className="border px-2 py-1">{item.name}</td>
                    <td className="border px-2 py-1">{item.supplier}</td>
                    <td className="border px-2 py-1">{item.sku || ''}</td>
                    <td className="border px-2 py-1 text-right">{item.qty.toFixed(2)}</td>
                    <td className="border px-2 py-1">{item.notes || ''}</td>
                    <td className="border px-2 py-1 text-center">
                      <Button variant="destructive" size="sm" onClick={()=> removeCartItem(item.id)}>Remove</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manual Add Item</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm">Item Name</label>
              <Input value={manual.name} onChange={e=> setManual(prev=> ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm">Supplier</label>
              <select className="border rounded px-2 py-1 w-full" value={manual.supplier} onChange={e=> setManual(prev=> ({ ...prev, supplier: e.target.value }))}>
                <option>Gilmours</option>
                <option>Bidfood</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm">SKU (optional)</label>
              <Input value={manual.sku} onChange={e=> setManual(prev=> ({ ...prev, sku: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm">Qty</label>
              <Input type="number" min="0" step="0.01" value={manual.qty} onChange={e=> setManual(prev=> ({ ...prev, qty: parseFloat(e.target.value || '0') }))} />
            </div>
            <div>
              <label className="text-sm">Notes</label>
              <Input value={manual.notes} onChange={e=> setManual(prev=> ({ ...prev, notes: e.target.value }))} />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setManualOpen(false)}>Cancel</Button>
              <Button onClick={manualAdd}>Add to cart</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Calculation Details</DialogTitle></DialogHeader>
          {detail ? (
            <div className="space-y-2">
              <div className="text-sm">
                <div><b>Item:</b> {detail.name} {detail.unit ? `(${detail.unit})` : ''}</div>
                <div><b>Required:</b> {detail.requiredQty.toFixed(2)} {detail.unit || ''}</div>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="min-w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-2 py-1 text-left">Source</th>
                      <th className="border px-2 py-1 text-left">Leaf</th>
                      <th className="border px-2 py-1 text-right">Qty</th>
                      <th className="border px-2 py-1 text-left">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.breakdown || []).map((b, i) => (
                      <tr key={i}>
                        <td className="border px-2 py-1">{b.source}</td>
                        <td className="border px-2 py-1">{b.name}</td>
                        <td className="border px-2 py-1 text-right">{b.qty.toFixed(2)}</td>
                        <td className="border px-2 py-1">{b.unit || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className="text-sm">No details</div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}


