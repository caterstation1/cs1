'use client'

import { useCallback, useEffect, useState } from 'react'
import { NotebookPen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export interface DeliveryNoteEntry {
  id: string
  note: string
  createdBy: string | null
  createdAt: string
  addressLabel: string
}

interface DeliveryNotesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  shippingAddress: unknown
  customerEmail?: string | null
  addressLabel?: string
  initialNotes?: DeliveryNoteEntry[]
  onNotesChanged?: (orderId: string, notes: DeliveryNoteEntry[]) => void
}

export function DeliveryNotesModal({
  open,
  onOpenChange,
  orderId,
  shippingAddress,
  customerEmail,
  addressLabel,
  initialNotes,
  onNotesChanged,
}: DeliveryNotesModalProps) {
  const [notes, setNotes] = useState<DeliveryNoteEntry[]>(initialNotes || [])
  const [newNote, setNewNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshNotes = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/delivery-notes/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: [{ orderId, shippingAddress, customerEmail }] }),
      })
      if (!res.ok) throw new Error('Lookup failed')
      const data = await res.json()
      const fresh: DeliveryNoteEntry[] = data.notes?.[orderId] || []
      setNotes(fresh)
      onNotesChanged?.(orderId, fresh)
    } catch (err) {
      console.error('Failed to load delivery notes:', err)
      setError('Failed to load delivery notes')
    } finally {
      setIsLoading(false)
    }
  }, [orderId, shippingAddress, customerEmail, onNotesChanged])

  useEffect(() => {
    if (open) {
      setNewNote('')
      void refreshNotes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleAddNote = async () => {
    const text = newNote.trim()
    if (!text || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingAddress, customerEmail, note: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Save failed')
      }
      setNewNote('')
      await refreshNotes()
    } catch (err) {
      console.error('Failed to add delivery note:', err)
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/delivery-notes/${noteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      await refreshNotes()
    } catch (err) {
      console.error('Failed to delete delivery note:', err)
      setError('Failed to delete note')
    }
  }

  const displayAddress = addressLabel || notes[0]?.addressLabel || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-blue-600" />
            Delivery Notes
          </DialogTitle>
          <DialogDescription>
            {displayAddress
              ? `Internal delivery instructions for ${displayAddress}. `
              : 'Internal delivery instructions for this address. '}
            These persist and appear on future orders for this client and address.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading notes...</p>
          ) : notes.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {notes.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2 bg-blue-50 border border-blue-200 rounded-md flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-blue-900 whitespace-pre-wrap break-words">{entry.note}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {entry.createdBy || 'Staff'} •{' '}
                      {new Date(entry.createdAt).toLocaleDateString('en-NZ', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteNote(entry.id)}
                    className="text-blue-400 hover:text-red-600 shrink-0 mt-0.5"
                    title="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No delivery notes yet for this address.</p>
          )}
          <div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full h-24 p-2 border border-gray-300 rounded-md resize-none text-sm"
              placeholder="e.g. Use the service elevator, place in kitchenette, no need to see anyone..."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => void handleAddNote()} disabled={!newNote.trim() || isSaving}>
            {isSaving ? 'Saving...' : '+ Add note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeliveryNotesButtonProps {
  orderId: string
  shippingAddress: unknown
  customerEmail?: string | null
  addressLabel?: string
  notes?: DeliveryNoteEntry[]
  onNotesChanged?: (orderId: string, notes: DeliveryNoteEntry[]) => void
  className?: string
  iconClassName?: string
}

/** Blue notepad icon beside a delivery address; opens the delivery notes modal. */
export function DeliveryNotesButton({
  orderId,
  shippingAddress,
  customerEmail,
  addressLabel,
  notes,
  onNotesChanged,
  className,
  iconClassName,
}: DeliveryNotesButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasNotes = (notes?.length || 0) > 0

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(true)
        }}
        className={`inline-flex items-center align-middle shrink-0 ${
          hasNotes ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-blue-600'
        } ${className || ''}`}
        title={hasNotes ? 'View delivery notes for this address' : 'Add a delivery note for this address'}
      >
        <NotebookPen className={iconClassName || 'h-4 w-4'} fill={hasNotes ? 'currentColor' : 'none'} fillOpacity={hasNotes ? 0.2 : 0} />
      </button>
      <DeliveryNotesModal
        open={isOpen}
        onOpenChange={setIsOpen}
        orderId={orderId}
        shippingAddress={shippingAddress}
        customerEmail={customerEmail}
        addressLabel={addressLabel}
        initialNotes={notes}
        onNotesChanged={onNotesChanged}
      />
    </>
  )
}
