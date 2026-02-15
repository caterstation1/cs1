'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EditOrderModalProps {
  isOpen: boolean
  onClose: () => void
  order: any | null
  onUpdated?: (updated: any) => void
}

function parseLineItems(lineItems: any): any[] {
  if (!lineItems) return []
  if (Array.isArray(lineItems)) return lineItems
  if (typeof lineItems === 'string') {
    try { return JSON.parse(lineItems) } catch { return [] }
  }
  return []
}

function toTimeInput(value?: string | null): string {
  if (!value) return ''
  if (/^\d{2}:\d{2}$/.test(value)) return value
  const m = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const mm = m[2]
  const ap = (m[3] || '').toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2,'0')}:${mm}`
}

export default function EditOrderModal({ isOpen, onClose, order, onUpdated }: EditOrderModalProps) {
  const shipping = useMemo(() => {
    if (!order?.shippingAddress) return {}
    if (typeof order.shippingAddress === 'string') {
      try { return JSON.parse(order.shippingAddress) } catch { return {} }
    }
    return order.shippingAddress || {}
  }, [order])

  const [deliveryDate, setDeliveryDate] = useState<string>('')
  const [deliveryTime, setDeliveryTime] = useState<string>('')
  const [leaveTime, setLeaveTime] = useState<string>('')
  const [travelTime, setTravelTime] = useState<number>(parseInt(order?.travelTime || '0', 10) || 0)
  const [company, setCompany] = useState<string>('')
  const [address1, setAddress1] = useState<string>('')
  const [address2, setAddress2] = useState<string>('')
  const [note, setNote] = useState<string>(order?.note || '')
  const [internalNote, setInternalNote] = useState<string>(order?.internalNote || '')
  const [editedLineItems, setEditedLineItems] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!order) return
    setDeliveryDate(order.deliveryDate || '')
    setDeliveryTime(toTimeInput(order.deliveryTime))
    setLeaveTime(toTimeInput(order.leaveTime))
    setCompany((shipping as any).company || '')
    setAddress1((shipping as any).address1 || '')
    setAddress2((shipping as any).address2 || '')
    setEditedLineItems(parseLineItems(order.lineItems))
  }, [order, shipping])

  const handleProductSearch = async (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    const res = await fetch(`/api/products/search?flat=1&q=${encodeURIComponent(q)}`)
    if (!res.ok) return
    const data = await res.json()
    setSearchResults(Array.isArray(data.products) ? data.products : [])
  }

  const handleSave = async () => {
    if (!order) return
    try {
      setSaving(true)
      const updates: any = {
        deliveryDate,
        deliveryTime,
        leaveTime,
        travelTime: String(travelTime),
        note,
        internalNote,
        shippingAddress: {
          ...(shipping || {}),
          company,
          address1,
          address2,
        },
        lineItems: editedLineItems,
      }
      const res = await fetch('/api/orders/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: { orderId: order.id, updates }, action: 'update' }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdated?.(updated)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog modal open={isOpen} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="w-full max-w-3xl" aria-describedby="edit-order-modal-desc">
          <DialogHeader>
            <DialogTitle>Edit Order #{order?.orderNumber}</DialogTitle>
            <DialogDescription id="edit-order-modal-desc">
              Edit order details and manage items. Changes will be saved to the database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Date</label>
                <input type="date" className="w-full px-2 py-1 rounded border border-gray-300"
                  value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Time</label>
                <Input type="time" value={deliveryTime} onChange={(e) => {
                  const val = e.target.value
                  setDeliveryTime(val)
                  if (val && travelTime) {
                    const [h, m] = val.split(':').map(Number)
                    const d = new Date()
                    d.setHours(h, m, 0, 0)
                    const leave = new Date(d.getTime() - travelTime * 60000)
                    const hh = String(leave.getHours()).padStart(2,'0')
                    const mm = String(leave.getMinutes()).padStart(2,'0')
                    setLeaveTime(`${hh}:${mm}`)
                  }
                }} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Leave Time</label>
                <Input type="time" value={leaveTime} onChange={(e) => setLeaveTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Travel Time (mins)</label>
                <Input type="number" value={String(Number.isFinite(travelTime) ? travelTime : 0)} onChange={(e) => setTravelTime(parseInt(e.target.value || '0', 10) || 0)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Delivery Address</label>
              <Input placeholder="Company (optional)" value={company} onChange={e => setCompany(e.target.value)} />
              <Input placeholder="Address 1" value={address1} onChange={e => setAddress1(e.target.value)} />
              <Input placeholder="Address 2" value={address2} onChange={e => setAddress2(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Order Notes</label>
              <textarea className="w-full min-h-[100px] px-3 py-2 border rounded-md" value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Order Items</h3>
                <Button size="sm" variant="outline" onClick={() => { setIsSearching(true); setSearchQuery(''); setSearchResults([]) }}>Add Item</Button>
              </div>
              <div className="border rounded-md divide-y">
                {editedLineItems.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Qty:</span>
                        <Input type="number" min="1" className="w-16" value={item.quantity} onChange={(e) => {
                          const newQty = parseInt(e.target.value, 10)
                          if (newQty > 0) {
                            const updated = [...editedLineItems]
                            updated[index] = { ...item, quantity: newQty }
                            setEditedLineItems(updated)
                          }
                        }} />
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => {
                        const updated = [...editedLineItems]
                        updated.splice(index, 1)
                        setEditedLineItems(updated)
                      }}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog modal open={isSearching} onOpenChange={setIsSearching}>
        <DialogContent aria-describedby="search-products-desc">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription id="search-products-desc">Search for products to add to this order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Input placeholder="Search products..." value={searchQuery} onChange={(e) => handleProductSearch(e.target.value)} />
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-[300px] overflow-auto">
                {searchResults.map((v: any) => (
                  <div key={v.variantId} className="flex items-center justify-between p-3 hover:bg-gray-50">
                    <div>
                      <div className="font-medium">{v.displayName || v.productDisplayName || v.shopifyName || v.shopifyTitle}</div>
                      <div className="text-sm text-gray-500">SKU: {v.shopifySku || ''}</div>
                    </div>
                    <Button size="sm" onClick={() => {
                      const newItem = {
                        sku: v.shopifySku,
                        title: v.shopifyName && v.shopifyName !== 'Default Title' ? v.shopifyName : (v.shopifyTitle || ''),
                        variant_id: v.variantId,
                        variantId: v.variantId,
                        quantity: 1,
                        price: "0.00",
                        variant_title: null,
                        vendor: "Cater Station",
                        properties: [],
                        taxable: true,
                        requires_shipping: true,
                        fulfillment_status: null
                      } as any
                      setEditedLineItems(prev => [...prev, newItem])
                      setIsSearching(false)
                      setSearchQuery('')
                      setSearchResults([])
                    }}>Add</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}


