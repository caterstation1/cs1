import { Capacitor, registerPlugin } from '@capacitor/core'

export type StaffLocationPingStatus = {
  active: boolean
  lastPingAt: string | null
  lastError: string | null
}

export interface StaffLocationPingPlugin {
  configure(options: {
    endpoint: string
    bearerToken: string
    intervalMs?: number
    distanceFilter?: number
  }): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  getStatus(): Promise<StaffLocationPingStatus>
}

export const StaffLocationPing = registerPlugin<StaffLocationPingPlugin>('StaffLocationPing', {
  web: () => import('./native-shift-location-ping.web').then((m) => new m.StaffLocationPingWeb()),
})

export function isIosNativePingAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'ios' &&
    Capacitor.isPluginAvailable('StaffLocationPing')
  )
}
