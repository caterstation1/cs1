'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, ShoppingCart, Trash2 } from 'lucide-react'

type PreferredItem = {
  key: string
  source: 'gilmours' | 'bidfood' | 'produce_co' | 'other'
  id: string
  name: string
  code: string
  supplier: string
  preferredReference: string | null
  preferredAllergens: string[]
}

type CartItem = {
  id: string
  name: string
  sku?: string | null
  supplier: string
  qty: number
  notes?: string | null
}

const SOURCE_LABELS: Record<PreferredItem['source'], string> = {
  gilmours: 'Gilmours',
  bidfood: 'Bidfood',
  produce_co: 'Produce Co',
  other: 'Other',
}

export default function ShopPage() {
  const [city, setCity] = useState<'AKL' | 'WLG'>('AKL')
  const [query, setQuery] = useState('')
  const [preferredItems, setPreferredItems] = useState<PreferredItem[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [qtyByKey, setQtyByKey] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [preferredRes, cartRes] = await Promise.all([
        fetch('/api/shop/preferred', { cache: 'no-store' }),
        fetch(`/api/cart?city=${city}`, { cache: 'no-store' }),
      ])
      if (!preferredRes.ok) throw new Error('Failed to load preferred products')
      if (!cartRes.ok) throw new Error('Failed to load shopping list')

      const preferredPayload = await preferredRes.json()
      const cartPayload = await cartRes.json()
      setPreferredItems(Array.isArray(preferredPayload?.items) ? preferredPayload.items : [])
      setCartItems(Array.isArray(cartPayload) ? cartPayload : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load shop data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [city])

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return preferredItems
    return preferredItems.filter((item) =>
      [item.name, item.code, item.supplier, SOURCE_LABELS[item.source], item.preferredReference || '']
        .join(' ')
        .toLowerCase()
        .includes(search)
    )
  }, [preferredItems, query])

  const addToList = async (item: PreferredItem) => {
    const rawQty = qtyByKey[item.key] ?? '1'
    const qty = Number(rawQty)
    if (!Number.isFinite(qty) || qty <= 0) return

    setAddingKey(item.key)
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          name: item.name,
          supplier: item.supplier || SOURCE_LABELS[item.source],
          sku: item.code || undefined,
          qty,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || 'Failed to add item')
      }
      setQtyByKey((prev) => ({ ...prev, [item.key]: '1' }))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item')
    } finally {
      setAddingKey(null)
    }
  }

  const removeFromList = async (id: string) => {
    await fetch(`/api/cart/${id}`, { method: 'DELETE' })
    await load()
  }

  const clearList = async () => {
    await fetch(`/api/cart/clear?city=${city}`, { method: 'POST' })
    await load()
  }

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + (Number.isFinite(item.qty) ? item.qty : 0), 0),
    [cartItems]
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shop</h1>
          <p className="text-sm text-muted-foreground">Build a shopping list from preferred products.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={city === 'AKL' ? 'default' : 'outline'} size="sm" onClick={() => setCity('AKL')}>
            AKL
          </Button>
          <Button variant={city === 'WLG' ? 'default' : 'outline'} size="sm" onClick={() => setCity('WLG')}>
            WLG
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr,1fr]">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search preferred items, supplier, or code..."
              className="h-9"
            />
            <Badge variant="secondary">{filteredItems.length}</Badge>
          </div>

          <div className="max-h-[68vh] space-y-2 overflow-auto pr-1">
            {loading ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">Loading preferred items...</div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                No preferred products match your search.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.key} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {SOURCE_LABELS[item.source]} · {item.supplier}
                        {item.code ? ` · ${item.code}` : ''}
                      </div>
                    </div>
                    {item.preferredAllergens.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.preferredAllergens.slice(0, 3).map((allergen) => (
                          <Badge key={`${item.key}:${allergen}`} variant="outline" className="text-[10px] uppercase">
                            {allergen}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={qtyByKey[item.key] ?? '1'}
                      onChange={(event) =>
                        setQtyByKey((prev) => ({
                          ...prev,
                          [item.key]: event.target.value,
                        }))
                      }
                      className="h-9 w-24 text-right"
                    />
                    <Button size="sm" onClick={() => void addToList(item)} disabled={addingKey === item.key}>
                      {addingKey === item.key ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Shopping list</div>
                <div className="text-xs text-muted-foreground">{cartItems.length} lines · {totalItems.toFixed(2)} qty</div>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => void clearList()} disabled={cartItems.length === 0}>
              Clear
            </Button>
          </div>

          <div className="max-h-[68vh] space-y-2 overflow-auto pr-1">
            {loading ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">Loading list...</div>
            ) : cartItems.length === 0 ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                Your shopping list is empty. Add items from the left panel.
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.supplier}
                      {item.sku ? ` · ${item.sku}` : ''}
                    </div>
                    <div className="mt-1 text-sm">Qty: {Number(item.qty).toFixed(2)}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void removeFromList(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
