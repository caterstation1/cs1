'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeliveryNoteEntry } from '@/components/realtime-orders/delivery-notes-modal'

interface OrderLike {
  id: string
  shippingAddress?: unknown
  customerEmail?: string | null
}

export type DeliveryNotesMap = Record<string, DeliveryNoteEntry[]>

/**
 * Batch-fetches delivery address notes for a list of orders so each card
 * knows whether notes exist (icon state) without one request per order.
 */
export function useDeliveryNotes(orders: OrderLike[]) {
  const [notesByOrderId, setNotesByOrderId] = useState<DeliveryNotesMap>({})
  const lastKeyRef = useRef('')

  // Refetch only when the set of order ids changes, not on every poll re-render
  const ordersKey = orders
    .map((o) => o.id)
    .sort()
    .join(',')

  useEffect(() => {
    if (!ordersKey || ordersKey === lastKeyRef.current) return
    lastKeyRef.current = ordersKey
    let cancelled = false

    const run = async () => {
      try {
        const res = await fetch('/api/delivery-notes/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orders: orders.map((o) => ({
              orderId: o.id,
              shippingAddress: o.shippingAddress,
              customerEmail: o.customerEmail,
            })),
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setNotesByOrderId(data.notes || {})
        }
      } catch (error) {
        console.error('Failed to load delivery notes:', error)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersKey])

  const updateOrderNotes = useCallback((orderId: string, notes: DeliveryNoteEntry[]) => {
    setNotesByOrderId((prev) => {
      const next = { ...prev }
      if (notes.length > 0) {
        next[orderId] = notes
      } else {
        delete next[orderId]
      }
      return next
    })
  }, [])

  return { notesByOrderId, updateOrderNotes }
}
