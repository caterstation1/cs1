/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Order } from '@/types/order'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

type TemplateType = 'delivery' | 'pickup' | 'custom'

interface TextOrdersModalProps {
  isOpen: boolean
  onClose: () => void
  orders: Order[]
  defaultTemplate?: TemplateType
  presetSelection?: string[] // orderIds
}

export function TextOrdersModal({ isOpen, onClose, orders, defaultTemplate = 'delivery', presetSelection }: TextOrdersModalProps) {
  const [templateType, setTemplateType] = useState<TemplateType>(defaultTemplate)
  const [customMessage, setCustomMessage] = useState('')
  const [templates, setTemplates] = useState<{ delivery: string; pickup: string }>({ delivery: '', pickup: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set<string>())
  const [previews, setPreviews] = useState<{ orderId: string; to: string; message: string }[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    // Initialize selection
    const ids = presetSelection && presetSelection.length > 0 ? presetSelection : orders.map(o => o.id)
    setSelected(new Set(ids))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    // Load templates
    const load = async () => {
      try {
        const res = await fetch('/api/settings/sms-templates')
        const data = await res.json()
        setTemplates({ delivery: data.delivery || '', pickup: data.pickup || '' })
      } catch {
        // ignore
      }
    }
    load()
  }, [isOpen])

  const selectedOrders = useMemo(() => orders.filter(o => selected.has(o.id)), [orders, selected])

  const refreshPreview = async () => {
    setError(null)
    try {
      const res = await fetch('/api/sms/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selected),
          templateType,
          customMessage: templateType === 'custom' ? customMessage : undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to preview')
      setPreviews(data.previews || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to preview')
    }
  }

  useEffect(() => { if (isOpen) { refreshPreview() } }, [isOpen, templateType, customMessage, selected])

  const firstPreview = previews[0]?.message || ''

  const toggle = (id: string) => {
    const copy = new Set(selected)
    if (copy.has(id)) copy.delete(id)
    else copy.add(id)
    setSelected(copy)
  }

  const sendAll = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selected),
          templateType,
          customMessage: templateType === 'custom' ? customMessage : undefined,
          includeOptOut: true
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog modal open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Text Clients</DialogTitle>
          <DialogDescription>Send a message to selected clients. A preview will generate per order.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={templateType === 'delivery' ? 'default' : 'outline'} size="sm" onClick={() => setTemplateType('delivery')}>Delivery</Button>
              <Button variant={templateType === 'pickup' ? 'default' : 'outline'} size="sm" onClick={() => setTemplateType('pickup')}>Pickup</Button>
              <Button variant={templateType === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setTemplateType('custom')}>Custom</Button>
            </div>
            {templateType === 'custom' ? (
              <div className="space-y-2">
                <Label>Custom Message</Label>
                <textarea className="w-full min-h-[180px] border rounded p-2" value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder="Write your message using tokens like {{CustomerFirstName}} ..." />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Template (read-only)</Label>
                <textarea className="w-full min-h-[180px] border rounded p-2 bg-muted/50" readOnly value={templateType === 'pickup' ? templates.pickup : templates.delivery} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Live Preview (first recipient)</Label>
              <textarea className="w-full min-h-[160px] border rounded p-2 bg-muted/50" readOnly value={firstPreview} />
              <div className="text-xs text-muted-foreground">“Reply STOP to opt out.” will be appended.</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Recipients ({selected.size}/{orders.length})</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set(orders.map(o => o.id)))}>Select All</Button>
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            </div>
            <div className="border rounded max-h-[360px] overflow-auto divide-y">
              {orders.map(o => (
                <label key={o.id} className="flex items-center gap-3 p-2">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                  <div className="flex-1">
                    <div className="font-medium">#{o.orderNumber} {o.customerFirstName} {o.customerLastName}</div>
                    <div className="text-xs text-muted-foreground">{o.customerPhone || 'No phone'}</div>
                  </div>
                </label>
              ))}
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={sendAll} disabled={sending || selected.size === 0}>{sending ? 'Sending...' : 'Send'}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}



