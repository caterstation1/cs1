'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

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

  const fetchAll = async () => {
    setLoading(true)
    try {
      const s = await fetch(`/api/cart/suggest?city=${city}&days=2`, { cache: 'no-store' }).then(r=>r.json())
      const c = await fetch(`/api/cart?city=${city}`, { cache: 'no-store' }).then(r=>r.json())
      setSuggestions(Array.isArray(s) ? s : [])
      setCart(Array.isArray(c) ? c : [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=> { fetchAll() }, [city])

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suggestions */}
        <div>
          <h2 className="font-semibold mb-2">Suggestions (next 2 days)</h2>
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
                {sortedSuggestions.map(s => (
                  <tr key={s.id}>
                    <td className="border px-2 py-1">{s.name}</td>
                    <td className="border px-2 py-1">{s.supplier}</td>
                    <td className="border px-2 py-1">{s.sku || ''}</td>
                    <td className="border px-2 py-1 text-right">{s.requiredQty.toFixed(2)} {s.unit || ''}</td>
                    <td className="border px-2 py-1 text-right">
                      <Input defaultValue={s.requiredQty} type="number" min="0" step="0.01" className="w-24 text-right" id={`qty-${s.id}`} />
                    </td>
                    <td className="border px-2 py-1 text-center space-x-2">
                      <Button variant="outline" size="sm" onClick={async () => {
                        // fetch with debug=1 to get breakdown
                        const arr: Suggestion[] = await fetch(`/api/cart/suggest?city=${city}&days=2&debug=1`, { cache: 'no-store' }).then(r => r.json())
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


