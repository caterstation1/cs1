'use client'

import { useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShiftLocationTracking } from '@/hooks/useShiftLocationTracking'

/**
 * Persistent driver-facing status for delivery-run location sharing.
 * Shown whenever tracking is active, with a clear manual "Stop Tracking"
 * control, plus a dismissible notice when sharing turns off.
 */
export function DeliveryRunTrackingBanner() {
  const { trackingState, stopTracking, stopNotice, dismissStopNotice } = useShiftLocationTracking()
  const [stopping, setStopping] = useState(false)

  const isActive = trackingState === 'tracking' || trackingState === 'starting'

  if (!isActive && !stopNotice) return null

  const handleStop = async () => {
    try {
      setStopping(true)
      await stopTracking(true, 'manual_stop')
    } finally {
      setStopping(false)
    }
  }

  return (
    <div
      className="fixed inset-x-2 z-50 md:inset-x-auto md:right-4 md:w-96"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      {isActive ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50/95 p-3 shadow-lg backdrop-blur">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-900">Delivery run location sharing active</p>
            <p className="text-xs text-emerald-800">
              Used for customer ETAs, dispatch coordination, and return-to-base planning.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-emerald-400 bg-white text-emerald-900 hover:bg-emerald-100"
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? 'Stopping…' : 'Stop Tracking'}
          </Button>
        </div>
      ) : stopNotice ? (
        <div className="flex items-start gap-3 rounded-xl border border-slate-300 bg-white/95 p-3 shadow-lg backdrop-blur">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
          <p className="min-w-0 flex-1 text-sm text-slate-700">{stopNotice}</p>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100"
            onClick={dismissStopNotice}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
