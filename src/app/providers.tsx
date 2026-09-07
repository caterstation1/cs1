'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { NativeAppBootstrap } from '@/components/NativeAppBootstrap'
import { ShiftLocationTrackingProvider } from '@/contexts/shift-location-tracking'
import { DeliveryRunTrackingBanner } from '@/components/ui/DeliveryRunTrackingBanner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <NativeAppBootstrap />
        <ShiftLocationTrackingProvider>
          {children}
          <DeliveryRunTrackingBanner />
        </ShiftLocationTrackingProvider>
      </ThemeProvider>
    </SessionProvider>
  )
} 