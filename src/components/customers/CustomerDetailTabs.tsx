'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  totalOrders: number
  totalSpent: number
  last60DaysSpent: number
  isVIP?: boolean
  internalNotes?: string
}

export default function CustomerDetailTabs({ customer }: { customer: Customer }) {
  const [orders, setOrders] = useState<any[]>([])
  const [notes, setNotes] = useState<string>(customer.internalNotes || '')
  const [saving, setSaving] = useState(false)

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`/api/customers/${encodeURIComponent(customer.id)}/orders`)
    if (!res.ok) return
    const data = await res.json()
    setOrders(Array.isArray(data.orders) ? data.orders : [])
  }, [customer.id])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const saveNotes = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/customers/${encodeURIComponent(customer.id)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
    } finally {
      setSaving(false)
    }
  }, [customer.id, notes])

  const summaryStats = useMemo(() => {
    return [
      { label: 'Total Orders', value: customer.totalOrders },
      { label: 'Total Spent', value: new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(customer.totalSpent || 0) },
      { label: 'Last 60 Days', value: new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(customer.last60DaysSpent || 0) },
      { label: 'VIP', value: customer.isVIP ? 'Yes' : 'No' },
    ]
  }, [customer])

  return (
    <Tabs defaultValue="summary">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="contacts">Contacts</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
      </TabsList>
      <TabsContent value="summary" className="space-y-2 p-2">
        <div className="grid grid-cols-2 gap-3">
          {summaryStats.map(s => (
            <div key={s.label} className="border rounded p-2">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="font-medium">{s.value as any}</div>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="contacts" className="space-y-2 p-2">
        <div className="text-sm"><span className="text-slate-500">Name:</span> {customer.firstName} {customer.lastName}</div>
        <div className="text-sm"><span className="text-slate-500">Email:</span> {customer.email}</div>
        <div className="text-sm"><span className="text-slate-500">Phone:</span> {customer.phone || '—'}</div>
      </TabsContent>
      <TabsContent value="notes" className="space-y-2 p-2">
        <textarea className="w-full min-h-[140px] border rounded p-2" value={notes} onChange={e => setNotes(e.target.value)} />
        <Button onClick={saveNotes} disabled={saving}>{saving ? 'Saving…' : 'Save Notes'}</Button>
      </TabsContent>
      <TabsContent value="orders" className="space-y-2 p-2">
        <div className="max-h-[320px] overflow-auto divide-y">
          {orders.map(o => (
            <div key={o.id} className="py-2">
              <div className="text-sm font-medium">#{o.orderNumber} • {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('en-GB') : '—'} • {o.deliveryTime || '—'}</div>
              <div className="text-xs text-slate-600">{o.fulfillmentStatus || ''} • {o.total ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(o.total) : ''}</div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}



