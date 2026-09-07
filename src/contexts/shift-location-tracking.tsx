'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Geolocation } from '@capacitor/geolocation'
import { Preferences } from '@capacitor/preferences'
import type { BackgroundGeolocationPlugin, Location as NativeLocation } from '@capacitor-community/background-geolocation'
import { isIosNativePingAvailable, StaffLocationPing } from '@/lib/native-shift-location-ping'

type StartResult = {
  started: boolean
  reason?: string
  code?: string
}

type TrackingState = 'idle' | 'starting' | 'tracking' | 'stopped'

export type TrackingStopReason = 'manual_stop' | 'returned_to_base' | 'clock_out' | 'max_duration'

export type ActiveDispatchedOrder = {
  id: string
  orderNumber: number
  deliveryTime: string | null
  dispatchedAt?: string | null
}

export type ServerTrackingStatus = {
  clockedIn: boolean
  shiftId: string | null
  trackingStatus: 'inactive' | 'active_delivery_run' | 'stopping' | 'stopped'
  trackingStopReason?: TrackingStopReason | null
  trackingStoppedAt?: string | null
  stopNotice?: string | null
  eligibleForTracking: boolean
  activeDispatchedOrders: ActiveDispatchedOrder[]
  activeDeliveryOrderIds?: string[]
  lastKnownDistanceFromBaseMeters?: number | null
}

const PING_INTERVAL_MS = 90_000
const STATUS_POLL_MS = 20_000
const TRACKING_STATUS_SYNC_EVENT = 'cs:tracking-status-sync'
const TRACKING_TOKEN_KEY = 'shiftTrackingToken'
const TRACKING_WATCHER_ID_KEY = 'shiftTrackingWatcherId'
const DEFAULT_STOP_NOTICE = 'Delivery run location sharing is now off.'
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

/**
 * Ask the tracking provider to reconcile with the server immediately instead
 * of waiting for the next status poll. Used after dispatch actions so a
 * driver who dispatches their own order starts tracking within seconds.
 * Cheap no-op when the current user has no eligible delivery run.
 */
export function requestTrackingStatusSync() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(TRACKING_STATUS_SYNC_EVENT))
}

function apiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return `https://caterstation1.vercel.app${path}`
}

type StoredNativeLocation = Pick<NativeLocation, 'latitude' | 'longitude' | 'accuracy' | 'speed' | 'bearing' | 'time'>

type ShiftLocationTrackingContextValue = {
  trackingState: TrackingState
  permissionState: 'unknown' | 'granted' | 'denied'
  lastPingAt: string | null
  error: string | null
  serverStatus: ServerTrackingStatus | null
  stopNotice: string | null
  dismissStopNotice: () => void
  startTracking: () => Promise<StartResult>
  stopTracking: (notifyServer?: boolean, reason?: TrackingStopReason) => Promise<void>
  refreshServerStatus: () => Promise<void>
}

const ShiftLocationTrackingContext = createContext<ShiftLocationTrackingContextValue | null>(null)

export function ShiftLocationTrackingProvider({ children }: { children: ReactNode }) {
  const watchIdRef = useRef<number | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPositionRef = useRef<GeolocationPosition | null>(null)
  const lastNativeLocationRef = useRef<StoredNativeLocation | null>(null)
  const nativeWatcherIdRef = useRef<string | null>(null)
  const nativeFirstPingRef = useRef<boolean>(true)
  const lastSuccessfulPingAtRef = useRef<number>(0)
  const trackingStateRef = useRef<TrackingState>('idle')
  const statusSyncInFlightRef = useRef(false)

  const [trackingState, setTrackingState] = useState<TrackingState>('idle')
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [lastPingAt, setLastPingAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerTrackingStatus | null>(null)
  const [stopNotice, setStopNotice] = useState<string | null>(null)

  const isNativeRuntime = Capacitor.getPlatform() !== 'web'
  const nativePingActiveRef = useRef(false)

  const dismissStopNotice = useCallback(() => setStopNotice(null), [])

  const clearTrackingTimers = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  const getTrackingToken = useCallback(async () => {
    return (await Preferences.get({ key: TRACKING_TOKEN_KEY })).value
  }, [])

  const syncNativePingStatus = useCallback(async () => {
    if (!isIosNativePingAvailable()) return
    try {
      const status = await StaffLocationPing.getStatus()
      if (status.lastPingAt) {
        lastSuccessfulPingAtRef.current = new Date(status.lastPingAt).getTime()
        setLastPingAt(status.lastPingAt)
      }
      if (status.lastError) {
        setError(status.lastError)
      } else if (status.active) {
        setError(null)
      }
    } catch {
      // Native plugin unavailable on older builds.
    }
  }, [])

  const configureNativePing = useCallback(async (trackingToken: string) => {
    await StaffLocationPing.configure({
      endpoint: apiUrl('/api/staff/location/ping'),
      bearerToken: trackingToken,
      intervalMs: PING_INTERVAL_MS,
      distanceFilter: 5,
    })
  }, [])

  const startNativePing = useCallback(
    async (trackingToken: string) => {
      if (!isIosNativePingAvailable()) {
        throw new Error('Native location ping is not available in this app build')
      }
      await configureNativePing(trackingToken)
      await StaffLocationPing.start()
      nativePingActiveRef.current = true
      setPermissionState('granted')
      await syncNativePingStatus()
    },
    [configureNativePing, syncNativePingStatus]
  )

  const stopNativePing = useCallback(async () => {
    if (!isIosNativePingAvailable() || !nativePingActiveRef.current) return
    await StaffLocationPing.stop().catch(() => null)
    nativePingActiveRef.current = false
  }, [])

  const stopTracking = useCallback(
    async (notifyServer = true, reason: TrackingStopReason = 'manual_stop') => {
      clearTrackingTimers()
      trackingStateRef.current = 'stopped'
      setTrackingState('stopped')

      await stopNativePing()

      const token = await getTrackingToken()
      const nativeWatcherId = nativeWatcherIdRef.current || (await Preferences.get({ key: TRACKING_WATCHER_ID_KEY })).value
      if (nativeWatcherId && isNativeRuntime) {
        await BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch(() => null)
      }
      nativeWatcherIdRef.current = null
      lastNativeLocationRef.current = null
      nativeFirstPingRef.current = true
      lastSuccessfulPingAtRef.current = 0
      await Preferences.remove({ key: TRACKING_WATCHER_ID_KEY }).catch(() => null)
      await Preferences.remove({ key: TRACKING_TOKEN_KEY }).catch(() => null)

      if (notifyServer) {
        const response = await fetch(apiUrl('/api/staff/location/stop'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ reason }),
        }).catch(() => null)
        const data = await response?.json().catch(() => null)
        if (reason !== 'clock_out') {
          setStopNotice(data?.notice || DEFAULT_STOP_NOTICE)
        }
      }
    },
    [clearTrackingTimers, getTrackingToken, isNativeRuntime, stopNativePing]
  )

  const handleServerStop = useCallback(
    async (notice?: string | null) => {
      await stopTracking(false)
      setStopNotice(notice || DEFAULT_STOP_NOTICE)
    },
    [stopTracking]
  )

  const postPing = useCallback(async (position: GeolocationPosition, force = false, token?: string | null) => {
    const authToken = token ?? (await getTrackingToken())
    const payload = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      speed: Number.isFinite(position.coords.speed as number) ? position.coords.speed : null,
      heading: Number.isFinite(position.coords.heading as number) ? position.coords.heading : null,
      capturedAt: new Date(position.timestamp).toISOString(),
      force,
    }

    const response = await fetch(apiUrl('/api/staff/location/ping'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => null)

    if (response.status === 410) {
      await handleServerStop(data?.notice)
      return
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to send location ping')
    }

    lastSuccessfulPingAtRef.current = Date.now()
    setLastPingAt(new Date().toISOString())

    if (data?.stopped) {
      await handleServerStop(data?.notice)
    }
  }, [getTrackingToken, handleServerStop])

  const postNativePing = useCallback(
    async (location: StoredNativeLocation, options?: { token?: string | null; force?: boolean; capturedAt?: string }) => {
      const authToken = options?.token ?? (await getTrackingToken())
      if (!authToken) return

      const force = options?.force ?? nativeFirstPingRef.current
      const payload = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy ?? null,
        speed: location.speed ?? null,
        heading: location.bearing ?? null,
        capturedAt: options?.capturedAt ?? (location.time ? new Date(location.time).toISOString() : new Date().toISOString()),
        force,
      }

      const response = await fetch(apiUrl('/api/staff/location/ping'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (nativeFirstPingRef.current) {
        nativeFirstPingRef.current = false
      }

      const data = await response.json().catch(() => null)

      if (response.status === 410) {
        await handleServerStop(data?.notice)
        return
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send location ping')
      }

      lastSuccessfulPingAtRef.current = Date.now()
      setLastPingAt(new Date().toISOString())

      if (data?.stopped) {
        await handleServerStop(data?.notice)
      }
    },
    [getTrackingToken, handleServerStop]
  )

  const fetchCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation is not supported in this browser'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 60_000,
      })
    })
  }, [])

  const fetchNativePosition = useCallback(async (): Promise<StoredNativeLocation | null> => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 30_000,
      })
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed ?? null,
        bearing: position.coords.heading ?? null,
        time: position.timestamp,
      }
    } catch {
      return lastNativeLocationRef.current
    }
  }, [])

  const startHeartbeat = useCallback(
    (mode: 'web' | 'native', trackingToken: string | null) => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }

      pingIntervalRef.current = setInterval(async () => {
        try {
          const token = trackingToken ?? (await getTrackingToken())
          if (!token) return

          if (mode === 'web') {
            const nextPosition = lastPositionRef.current || (await fetchCurrentPosition())
            await postPing(nextPosition, false, token)
            return
          }

          const location = (await fetchNativePosition()) || lastNativeLocationRef.current
          if (!location) return

          const staleMs = Date.now() - lastSuccessfulPingAtRef.current
          await postNativePing(location, {
            token,
            force: staleMs >= PING_INTERVAL_MS,
            capturedAt: new Date().toISOString(),
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Heartbeat ping failed'
          setError((prev) => prev || message)
        }
      }, PING_INTERVAL_MS)
    },
    [fetchCurrentPosition, fetchNativePosition, getTrackingToken, postNativePing, postPing]
  )

  const attachNativeWatcher = useCallback(
    async (trackingToken: string, requestPermissions = true) => {
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          requestPermissions,
          stale: true,
          distanceFilter: 5,
          backgroundMessage: 'Delivery run location sharing is active.',
          backgroundTitle: 'CaterStation delivery run',
        },
        (location, watcherError) => {
          if (watcherError) {
            if (watcherError.code === 'NOT_AUTHORIZED') {
              setPermissionState('denied')
              setError('Location permission required. Set CaterStation to Always in Settings.')
              BackgroundGeolocation.openSettings().catch(() => null)
            }
            return
          }
          if (!location) return
          lastNativeLocationRef.current = {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            speed: location.speed ?? null,
            bearing: location.bearing ?? null,
            time: location.time,
          }
          postNativePing(lastNativeLocationRef.current, { token: trackingToken }).catch((err) => {
            const message = err instanceof Error ? err.message : 'Location ping failed'
            setError((prev) => prev || message)
          })
        }
      )
      nativeWatcherIdRef.current = watcherId
      await Preferences.set({ key: TRACKING_WATCHER_ID_KEY, value: watcherId })
    },
    [postNativePing]
  )

  const startJsNativeTracking = useCallback(
    async (trackingToken: string | null) => {
      const initialLocation = await fetchNativePosition()
      if (initialLocation) {
        lastNativeLocationRef.current = initialLocation
        await postNativePing(initialLocation, { token: trackingToken, force: true })
      }

      const existingWatcher = (await Preferences.get({ key: TRACKING_WATCHER_ID_KEY })).value
      if (existingWatcher) {
        await BackgroundGeolocation.removeWatcher({ id: existingWatcher }).catch(() => null)
      }

      await attachNativeWatcher(trackingToken || '', true)
      setPermissionState('granted')
      startHeartbeat('native', trackingToken)
    },
    [attachNativeWatcher, fetchNativePosition, postNativePing, startHeartbeat]
  )

  const flushActivePing = useCallback(async () => {
    const token = await getTrackingToken()
    if (!token) return

    if (isNativeRuntime) {
      const location = (await fetchNativePosition()) || lastNativeLocationRef.current
      if (!location) {
        setError('Could not get GPS fix. Check location permission is set to Always.')
        return
      }
      await postNativePing(location, {
        token,
        force: true,
        capturedAt: new Date().toISOString(),
      })
      return
    }

    const position = lastPositionRef.current || (await fetchCurrentPosition())
    await postPing(position, true, token)
  }, [fetchCurrentPosition, fetchNativePosition, getTrackingToken, isNativeRuntime, postNativePing, postPing])

  const startTracking = useCallback(async (): Promise<StartResult> => {
    setError(null)
    setStopNotice(null)
    trackingStateRef.current = 'starting'
    setTrackingState('starting')

    try {
      const startResponse = await fetch(apiUrl('/api/staff/location/start'), {
        method: 'POST',
        credentials: 'include',
      })
      if (!startResponse.ok) {
        const data = await startResponse.json().catch(() => null)
        // Not eligible (no dispatched delivery run) is a normal state, not an error.
        if (startResponse.status === 409 || data?.code === 'no_active_delivery_run') {
          trackingStateRef.current = 'idle'
          setTrackingState('idle')
          return { started: false, reason: data?.error, code: data?.code || 'no_active_delivery_run' }
        }
        throw new Error(data?.error || 'Unable to start tracking')
      }

      const startData = await startResponse.json().catch(() => null)
      const trackingToken = startData?.trackingToken ?? null
      if (trackingToken) {
        await Preferences.set({ key: TRACKING_TOKEN_KEY, value: trackingToken })
      }

      if (isNativeRuntime) {
        nativeFirstPingRef.current = true
        lastSuccessfulPingAtRef.current = 0

        if (isIosNativePingAvailable()) {
          try {
            await startNativePing(trackingToken || '')
          } catch {
            await startJsNativeTracking(trackingToken)
          }
        } else {
          await startJsNativeTracking(trackingToken)
        }
      } else {
        const initialPosition = await fetchCurrentPosition()
        setPermissionState('granted')
        lastPositionRef.current = initialPosition
        await postPing(initialPosition, true, trackingToken)

        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            lastPositionRef.current = position
          },
          (geoError) => {
            if (geoError.code === geoError.PERMISSION_DENIED) {
              setPermissionState('denied')
              setError('Location permission denied. Delivery run tracking is unavailable.')
              stopTracking(true).catch(() => null)
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 20_000,
            maximumAge: 60_000,
          }
        )

        startHeartbeat('web', trackingToken)
      }

      trackingStateRef.current = 'tracking'
      setTrackingState('tracking')
      return { started: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start location tracking'
      if ((err as GeolocationPositionError)?.code === 1 || /permission/i.test(message)) {
        setPermissionState('denied')
      }
      setError(message)
      trackingStateRef.current = 'stopped'
      setTrackingState('stopped')
      const token = await getTrackingToken()
      await fetch(apiUrl('/api/staff/location/stop'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: 'manual_stop' }),
      }).catch(() => null)
      return { started: false, reason: message }
    }
  }, [
    fetchCurrentPosition,
    getTrackingToken,
    isNativeRuntime,
    postPing,
    startHeartbeat,
    startNativePing,
    startJsNativeTracking,
    stopTracking,
  ])

  const resumeTrackingSession = useCallback(async () => {
    const token = await getTrackingToken()
    if (!token) return

    trackingStateRef.current = 'tracking'
    setTrackingState('tracking')
    setPermissionState('granted')

    if (isNativeRuntime) {
      if (isIosNativePingAvailable()) {
        try {
          await startNativePing(token)
        } catch {
          const savedWatcherId = (await Preferences.get({ key: TRACKING_WATCHER_ID_KEY })).value
          if (!savedWatcherId) {
            await startJsNativeTracking(token)
          } else {
            nativeWatcherIdRef.current = savedWatcherId
            startHeartbeat('native', token)
            await flushActivePing().catch((err) => {
              const message = err instanceof Error ? err.message : 'Location ping failed'
              setError(message)
            })
          }
        }
      } else {
        const savedWatcherId = (await Preferences.get({ key: TRACKING_WATCHER_ID_KEY })).value
        const staleMs = lastSuccessfulPingAtRef.current
          ? Date.now() - lastSuccessfulPingAtRef.current
          : Number.POSITIVE_INFINITY
        const shouldReattach = !savedWatcherId || staleMs >= PING_INTERVAL_MS * 2

        if (shouldReattach) {
          if (savedWatcherId) {
            await BackgroundGeolocation.removeWatcher({ id: savedWatcherId }).catch(() => null)
          }
          await attachNativeWatcher(token, !savedWatcherId)
        } else {
          nativeWatcherIdRef.current = savedWatcherId
        }

        startHeartbeat('native', token)
        await flushActivePing().catch((err) => {
          const message = err instanceof Error ? err.message : 'Location ping failed'
          setError(message)
        })
      }
    } else if (!pingIntervalRef.current) {
      startHeartbeat('web', token)
      await flushActivePing().catch((err) => {
        const message = err instanceof Error ? err.message : 'Location ping failed'
        setError(message)
      })
    } else {
      await flushActivePing().catch((err) => {
        const message = err instanceof Error ? err.message : 'Location ping failed'
        setError(message)
      })
    }
  }, [attachNativeWatcher, flushActivePing, getTrackingToken, isNativeRuntime, startHeartbeat, startJsNativeTracking, startNativePing])

  const fetchServerStatus = useCallback(async (): Promise<ServerTrackingStatus | null> => {
    try {
      const token = await getTrackingToken()
      const response = await fetch(apiUrl('/api/staff/location/status'), {
        credentials: 'include',
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) return null
      const data = (await response.json()) as ServerTrackingStatus
      setServerStatus(data)
      return data
    } catch {
      return null
    }
  }, [getTrackingToken])

  /**
   * Reconciles client tracking with server delivery-run state:
   * - auto-starts when a dispatched delivery run is assigned to the driver
   * - resumes an already-active run (e.g. after app restart)
   * - stops locally when the server ended the run (return-to-base geofence,
   *   clock-out, max-duration failsafe)
   */
  const syncWithServerStatus = useCallback(async () => {
    if (statusSyncInFlightRef.current) return
    statusSyncInFlightRef.current = true
    try {
      const status = await fetchServerStatus()
      if (!status) return

      const clientTracking = trackingStateRef.current === 'tracking' || trackingStateRef.current === 'starting'
      const serverActive = status.clockedIn && status.trackingStatus === 'active_delivery_run'

      if (!serverActive && clientTracking) {
        const notice =
          status.trackingStopReason && status.trackingStopReason !== 'clock_out'
            ? status.stopNotice || DEFAULT_STOP_NOTICE
            : status.clockedIn
              ? status.stopNotice || DEFAULT_STOP_NOTICE
              : null
        await stopTracking(false)
        if (notice) setStopNotice(notice)
        return
      }

      if (serverActive && !clientTracking) {
        const token = await getTrackingToken()
        if (token) {
          await resumeTrackingSession()
        } else {
          await startTracking()
        }
        return
      }

      if (!status.clockedIn || clientTracking) return

      // Auto-start when a dispatched delivery run is (newly) assigned.
      // An order counts as "new" when its id has not been tracked this shift,
      // OR it was re-dispatched after the last stop (fresh dispatchedAt). The
      // second case lets dispatch restart tracking for the same order without
      // looping: orders dispatched before a returned_to_base/manual stop keep
      // an older dispatchedAt and never re-trigger.
      const recordedIds = new Set(status.activeDeliveryOrderIds || [])
      const stoppedAtMs = status.trackingStoppedAt ? new Date(status.trackingStoppedAt).getTime() : null
      const hasNewDispatchedOrder = status.activeDispatchedOrders.some((order) => {
        if (!recordedIds.has(order.id)) return true
        if (stoppedAtMs === null || !order.dispatchedAt) return false
        return new Date(order.dispatchedAt).getTime() > stoppedAtMs
      })
      const shouldAutoStart =
        status.eligibleForTracking &&
        (status.trackingStatus === 'inactive' || (status.trackingStatus === 'stopped' && hasNewDispatchedOrder))

      if (shouldAutoStart) {
        await startTracking()
      }
    } finally {
      statusSyncInFlightRef.current = false
    }
  }, [fetchServerStatus, getTrackingToken, resumeTrackingSession, startTracking, stopTracking])

  useEffect(() => {
    if (!isIosNativePingAvailable()) return
    const id = setInterval(() => {
      syncNativePingStatus().catch(() => null)
    }, 15_000)
    return () => clearInterval(id)
  }, [syncNativePingStatus])

  useEffect(() => {
    syncWithServerStatus().catch(() => null)
    const id = setInterval(() => {
      syncWithServerStatus().catch(() => null)
    }, STATUS_POLL_MS)
    return () => clearInterval(id)
  }, [syncWithServerStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onSyncRequested = () => {
      syncWithServerStatus().catch(() => null)
    }
    window.addEventListener(TRACKING_STATUS_SYNC_EVENT, onSyncRequested)
    return () => window.removeEventListener(TRACKING_STATUS_SYNC_EVENT, onSyncRequested)
  }, [syncWithServerStatus])

  useEffect(() => {
    if (!isNativeRuntime) return
    let listenerHandle: { remove: () => void } | undefined
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        syncWithServerStatus().catch(() => null)
      }
    }).then((handle) => {
      listenerHandle = handle
    })
    return () => {
      listenerHandle?.remove()
    }
  }, [isNativeRuntime, syncWithServerStatus])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncWithServerStatus().catch(() => null)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [syncWithServerStatus])

  const value: ShiftLocationTrackingContextValue = {
    trackingState,
    permissionState,
    lastPingAt,
    error,
    serverStatus,
    stopNotice,
    dismissStopNotice,
    startTracking,
    stopTracking,
    refreshServerStatus: async () => {
      await syncWithServerStatus()
    },
  }

  return <ShiftLocationTrackingContext.Provider value={value}>{children}</ShiftLocationTrackingContext.Provider>
}

export function useShiftLocationTracking() {
  const context = useContext(ShiftLocationTrackingContext)
  if (!context) {
    throw new Error('useShiftLocationTracking must be used within ShiftLocationTrackingProvider')
  }
  return context
}
