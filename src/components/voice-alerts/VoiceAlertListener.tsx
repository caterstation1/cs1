'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Speech, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVoiceIdentity } from './useVoiceIdentity'
import { VOICE_ALERT_POLL_MS, type VoiceAlertPayload } from '@/lib/voice-alerts'

function playChime() {
  try {
    const AudioCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    const context = new AudioCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.4)
    oscillator.onended = () => context.close().catch(() => {})
  } catch {
    // Autoplay blocked — the on-screen popup still announces the alert.
  }
}

function speakAloud(text: string) {
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.volume = 1
    synth.speak(utterance)
  } catch {
    // Speech unsupported — the popup still shows the message.
  }
}

/**
 * Watches for voice alerts addressed to this screen's identity, speaks them,
 * and shows a popup that stays until it's explicitly closed.
 */
export function VoiceAlertListener() {
  const { identity, ready } = useVoiceIdentity()
  const [queue, setQueue] = useState<VoiceAlertPayload[]>([])
  const handledIdsRef = useRef<Set<string>>(new Set())
  const spokenIdRef = useRef<string | null>(null)

  const active = queue[0] ?? null

  useEffect(() => {
    if (!ready || !identity) return

    handledIdsRef.current = new Set()
    setQueue([])

    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/voice-alerts?recipient=${encodeURIComponent(identity)}`,
          { cache: 'no-store' }
        )
        if (!response.ok) return
        const data = await response.json()
        const incoming: VoiceAlertPayload[] = Array.isArray(data?.alerts) ? data.alerts : []
        const fresh = incoming.filter((alert) => !handledIdsRef.current.has(alert.id))
        if (cancelled || fresh.length === 0) return
        fresh.forEach((alert) => handledIdsRef.current.add(alert.id))
        setQueue((prev) => [...prev, ...fresh])
      } catch (error) {
        console.error('Error polling voice alerts:', error)
      }
    }

    poll()
    const interval = setInterval(poll, VOICE_ALERT_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [ready, identity])

  useEffect(() => {
    if (!active || spokenIdRef.current === active.id) return
    spokenIdRef.current = active.id
    playChime()
    window.setTimeout(() => speakAloud(active.message), 450)
  }, [active])

  const handleClose = useCallback(async () => {
    if (!active) return
    const alertId = active.id

    try {
      window.speechSynthesis?.cancel()
    } catch {
      // Ignore — nothing to stop.
    }
    setQueue((prev) => prev.filter((alert) => alert.id !== alertId))

    try {
      await fetch(`/api/voice-alerts/${alertId}/ack`, { method: 'POST' })
    } catch (error) {
      console.error('Error acknowledging voice alert:', error)
    }
  }, [active])

  if (!active) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-lg border-4 border-red-500 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close alert"
          className="absolute right-3 top-3 rounded-sm p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-red-600">
          <Speech className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            Voice alert for {active.recipient}
          </span>
        </div>

        <p className="mt-3 whitespace-pre-wrap break-words text-xl font-semibold text-gray-900">
          {active.message}
        </p>

        {active.createdByName && (
          <p className="mt-2 text-sm text-muted-foreground">From {active.createdByName}</p>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => speakAloud(active.message)}
            className="flex items-center gap-2"
          >
            <Volume2 className="h-4 w-4" />
            Play again
          </Button>
          <Button onClick={handleClose} className="bg-red-600 text-white hover:bg-red-700">
            Close
          </Button>
        </div>

        {queue.length > 1 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {queue.length - 1} more alert{queue.length - 1 === 1 ? '' : 's'} waiting
          </p>
        )}
      </div>
    </div>
  )
}
