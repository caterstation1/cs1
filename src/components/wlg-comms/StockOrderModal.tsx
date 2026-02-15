'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface StockOrderModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: any
}

export function StockOrderModal({ isOpen, onClose, currentUser }: StockOrderModalProps) {
  const [items, setItems] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetch('/api/stock-items').then(r => r.json()).then(setItems).catch(() => setItems([]))
      setQuery('')
      setCart({})
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((i: any) => (i.name||'').toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q) || (i.supplier?.name||'').toLowerCase().includes(q))
  }, [items, query])

  const subtotal = useMemo(() => {
    return filtered.reduce((sum: number, it: any) => {
      const qty = cart[it.id] || 0
      if (qty <= 0) return sum
      const unit = parseFloat(it.priceExGst)
      return sum + unit * qty
    }, 0)
  }, [filtered, cart])
  const gst = Math.round(subtotal * 0.15 * 100) / 100
  const total = Math.round((subtotal + gst) * 100) / 100

  const postOrder = async () => {
    const lines = Object.entries(cart).filter(([_, q]) => (q as number) > 0).map(([id, q]) => ({ stockItemId: id, qty: q }))
    if (lines.length === 0) return
    setPosting(true)
    try {
      const res = await fetch('/api/stock-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines, createdBy: currentUser.id, createdByName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.name || 'Unknown' })
      })
      if (res.ok) {
        onClose()
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <Dialog modal open={isOpen} onOpenChange={(o)=>{ if (!o) onClose() }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>New WLG Stock Order</DialogTitle>
          <DialogDescription>Select items to purchase and post to the board</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="mb-2"><Input placeholder="Search by name, description, SKU, supplier" value={query} onChange={e=>setQuery(e.target.value)} /></div>
            <div className="max-h-[400px] overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2">Price (ex GST)</th>
                    <th className="text-center p-2">Qty</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it:any)=>{
                    const qty = cart[it.id]||0
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">{it.name}</div>
                          <div className="text-xs text-gray-600">{it.description}</div>
                        </td>
                        <td className="p-2 text-right">${parseFloat(it.priceExGst).toFixed(2)}</td>
                        <td className="p-2 text-center">
                          <Input type="number" min={0} value={qty} onChange={e=> setCart(prev=> ({...prev, [it.id]: Math.max(0, parseInt(e.target.value||'0',10))}))} className="w-20 text-center" />
                        </td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="outline" onClick={()=> setCart(prev=> ({...prev, [it.id]: (prev[it.id]||0)+1}))}>Add</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-span-1">
            <div className="border rounded p-3 space-y-2">
              <div className="font-semibold">Cart Summary</div>
              <div className="text-sm flex justify-between"><span>Subtotal (ex GST)</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="text-sm flex justify-between"><span>GST 15%</span><span>${gst.toFixed(2)}</span></div>
              <div className="font-semibold flex justify-between"><span>Total (inc GST)</span><span>${total.toFixed(2)}</span></div>
              <Button onClick={postOrder} disabled={posting || Object.values(cart).every(q=> (q as number) <= 0)} className="w-full">{posting ? 'Posting...' : 'Post Order'}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


