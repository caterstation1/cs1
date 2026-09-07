'use client'

import { useShiftLocationTracking } from '@/hooks/useShiftLocationTracking'
import { useNativeAppShell } from '@/hooks/useNativeAppShell'

export function MobileTrackingStatus() {
  const isNative = useNativeAppShell()
  const { trackingState, lastPingAt, error } = useShiftLocationTracking()

  if (!isNative || trackingState === 'idle') return null

  const label =
    trackingState === 'tracking'
      ? lastPingAt
        ? `Delivery GPS ${new Date(lastPingAt).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}`
        : 'Delivery GPS on'
      : trackingState === 'starting'
        ? 'Delivery GPS…'
        : 'Delivery GPS off'

  const tone = error ? 'text-amber-700' : trackingState === 'tracking' ? 'text-green-700' : 'text-slate-500'

  return (
    <span className={`text-xs font-medium ${tone}`} title={error || undefined}>
      {label}
    </span>
  )
}
