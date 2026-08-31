'use client'

import { useEffect, useState } from 'react'
import { isNativeAppRuntime } from '@/lib/native-app'

export function useNativeAppShell(): boolean {
  const [isNativeShell, setIsNativeShell] = useState(false)

  useEffect(() => {
    setIsNativeShell(isNativeAppRuntime())
  }, [])

  return isNativeShell
}
