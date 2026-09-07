'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Theme is unknown until mounted; render a stable placeholder to avoid hydration mismatch.
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {mounted ? (isDark ? '☀️ Light' : '🌙 Dark') : '…'}
    </Button>
  )
}
