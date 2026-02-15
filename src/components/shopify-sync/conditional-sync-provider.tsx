'use client'

import { usePathname } from 'next/navigation'
import { ShopifySyncProvider } from './shopify-sync-provider'

export function ConditionalSyncProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Don't wrap with ShopifySyncProvider on login/reset-password pages
  if (pathname === '/login' || pathname?.startsWith('/reset-password')) {
    return <>{children}</>
  }
  
  return <ShopifySyncProvider>{children}</ShopifySyncProvider>
}



