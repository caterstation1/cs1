'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Session hook used by mobile chrome. useSession() often lags in Capacitor;
 * /api/me/access confirms cookie auth when the client session is still empty.
 */
export function useStaffSession() {
  const { data: session, status } = useSession()
  const [serverAccess, setServerAccess] = useState<string | null>(null)
  const [accessChecked, setAccessChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/access', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setServerAccess(typeof d?.accessLevel === 'string' ? d.accessLevel : null)
          setAccessChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) setAccessChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const access =
    ((session?.user?.accessLevel as string | undefined) ?? serverAccess ?? '').toLowerCase()
  const isAuthenticated = Boolean(session?.user) || Boolean(serverAccess)
  const authPending = status === 'loading' && !accessChecked

  return { session, access, isAuthenticated, authPending, accessChecked }
}
