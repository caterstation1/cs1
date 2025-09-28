import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/ui/nav'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from './providers'
import { ShopifySyncProvider } from '@/components/shopify-sync/shopify-sync-provider'
import { SyncMonitor } from '@/components/shopify-sync/sync-monitor'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CaterStation',
  description: 'Catering management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ShopifySyncProvider>
          <Providers>
            <Nav />
            <main className="w-full px-6 py-6">
              {children}
            </main>
            <Toaster />
            {/* Hide SyncMonitor for WLG roles to avoid authority noise; keep for others */}
            {typeof window !== 'undefined' && (document.cookie.includes('next-auth.session-token') || document.cookie.includes('__Secure-next-auth.session-token')) ? <SyncMonitor /> : null}
          </Providers>
        </ShopifySyncProvider>
      </body>
    </html>
  )
} 