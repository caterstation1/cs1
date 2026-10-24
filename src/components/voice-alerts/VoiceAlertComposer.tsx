'use client'

import { useEffect, useState } from 'react'
import { Speech } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { KITCHEN_RECIPIENT } from '@/lib/voice-alerts'

/**
 * Toolbar button that opens a composer for sending a spoken alert to a
 * station or person. The message is read aloud on whichever screen is set to
 * that identity.
 */
export function VoiceAlertComposer() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [recipients, setRecipients] = useState<string[]>([KITCHEN_RECIPIENT])
  const [recipient, setRecipient] = useState(KITCHEN_RECIPIENT)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    fetch('/api/voice-alerts/recipients', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data?.recipients) && data.recipients.length > 0
          ? data.recipients
          : [KITCHEN_RECIPIENT]
        setRecipients(list)
      })
      .catch(() => {
        if (!cancelled) setRecipients([KITCHEN_RECIPIENT])
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const handleSend = async () => {
    const trimmed = message.trim()
    if (!trimmed) return

    setSending(true)
    try {
      const response = await fetch('/api/voice-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, message: trimmed }),
      })
      if (!response.ok) throw new Error('Failed to send voice alert')

      toast({
        title: 'Voice alert sent',
        description: `${recipient} will hear it on the calendar page.`,
      })
      setMessage('')
      setRecipient(KITCHEN_RECIPIENT)
      setOpen(false)
    } catch (error) {
      console.error('Error sending voice alert:', error)
      toast({
        title: 'Could not send voice alert',
        description: 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
        title="Send a voice alert"
      >
        <Speech className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>Send voice alert</DialogTitle>
            <DialogDescription>
              The message is spoken aloud on any calendar screen set to the selected name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="voice-alert-recipient">Send to</Label>
              <select
                id="voice-alert-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {recipients.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice-alert-message">Message</Label>
              <Textarea
                id="voice-alert-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What should they hear?"
                maxLength={500}
                className="min-h-[110px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !message.trim()}>
              {sending ? 'Sending...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
