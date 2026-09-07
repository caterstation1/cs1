import { WebPlugin } from '@capacitor/core'
import type { StaffLocationPingPlugin, StaffLocationPingStatus } from './native-shift-location-ping'

export class StaffLocationPingWeb extends WebPlugin implements StaffLocationPingPlugin {
  async configure(): Promise<void> {
    // Web uses JS fetch pings only.
  }

  async start(): Promise<void> {
    // Web uses JS fetch pings only.
  }

  async stop(): Promise<void> {
    // Web uses JS fetch pings only.
  }

  async getStatus(): Promise<StaffLocationPingStatus> {
    return { active: false, lastPingAt: null, lastError: null }
  }
}
