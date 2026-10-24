/**
 * Shared helpers for voice alerts — short spoken messages sent to a station
 * (usually "Kitchen") or to an individual by first name.
 */

/** Default station recipient. Pre-selected when composing an alert. */
export const KITCHEN_RECIPIENT = 'Kitchen'

/** Where the current device's chosen identity is stored. */
export const VOICE_IDENTITY_STORAGE_KEY = 'caterstation.voiceAlertIdentity'

/** Alerts older than this are never spoken — a screen opened later shouldn't replay a stale backlog. */
export const VOICE_ALERT_MAX_AGE_MS = 4 * 60 * 60 * 1000

/** How often a listening screen checks for new alerts. */
export const VOICE_ALERT_POLL_MS = 15000

export const VOICE_IDENTITY_CHANGE_EVENT = 'caterstation:voice-identity-change'

export interface VoiceAlertPayload {
  id: string
  recipient: string
  message: string
  createdAt: string
  createdByName: string | null
}

/** Trim and collapse whitespace so "  kitchen " and "kitchen" are the same recipient. */
export function normalizeRecipient(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ')
}

export function firstNameFromFullName(fullName: string | null | undefined): string {
  return normalizeRecipient(fullName).split(' ')[0] ?? ''
}

export function readStoredIdentity(): string {
  if (typeof window === 'undefined') return ''
  try {
    return normalizeRecipient(window.localStorage.getItem(VOICE_IDENTITY_STORAGE_KEY))
  } catch {
    return ''
  }
}

export function writeStoredIdentity(identity: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VOICE_IDENTITY_STORAGE_KEY, identity)
  } catch {
    // Private browsing / storage disabled — identity just won't persist.
  }
  window.dispatchEvent(new CustomEvent(VOICE_IDENTITY_CHANGE_EVENT, { detail: identity }))
}
