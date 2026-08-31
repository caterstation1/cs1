import { Capacitor } from '@capacitor/core'

export function isNativeAppRuntime(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Capacitor.getPlatform() !== 'web'
  } catch {
    return false
  }
}
