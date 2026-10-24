'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  KITCHEN_RECIPIENT,
  VOICE_IDENTITY_CHANGE_EVENT,
  firstNameFromFullName,
  readStoredIdentity,
  writeStoredIdentity,
} from '@/lib/voice-alerts'

/**
 * Which name this device answers to for voice alerts. Defaults to the signed-in
 * user's first name and can be overridden (typically to "Kitchen" on a shared
 * kitchen screen). The choice is per-device, so it survives reloads but doesn't
 * follow the user to another screen.
 */
export function useVoiceIdentity() {
  const { data: session } = useSession()
  const [storedIdentity, setStoredIdentity] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const sync = () => setStoredIdentity(readStoredIdentity())
    sync()
    setHydrated(true)

    window.addEventListener(VOICE_IDENTITY_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(VOICE_IDENTITY_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const myFirstName = firstNameFromFullName(session?.user?.name)
  const identity = storedIdentity || myFirstName

  const options = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const candidate of [myFirstName, KITCHEN_RECIPIENT, storedIdentity]) {
      if (!candidate) continue
      const key = candidate.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      list.push(candidate)
    }
    return list
  }, [myFirstName, storedIdentity])

  const setIdentity = useCallback((value: string) => {
    writeStoredIdentity(value)
    setStoredIdentity(value)
  }, [])

  return { identity, setIdentity, options, myFirstName, hydrated }
}
