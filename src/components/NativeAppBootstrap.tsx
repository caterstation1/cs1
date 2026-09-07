'use client'

import { useEffect } from 'react'
import { isNativeAppRuntime } from '@/lib/native-app'

function applyMobileShellFlags() {
  const root = document.documentElement
  if (isNativeAppRuntime()) {
    root.setAttribute('data-native-app', 'true')
  }
  const narrow = window.matchMedia('(max-width: 767px)').matches
  if (narrow) {
    root.setAttribute('data-mobile-shell', 'true')
  } else {
    root.removeAttribute('data-mobile-shell')
  }
}

export function NativeAppBootstrap() {
  useEffect(() => {
    applyMobileShellFlags()
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => applyMobileShellFlags()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return null
}
