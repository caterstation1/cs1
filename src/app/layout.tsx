import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/ui/nav'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from './providers'
import { ConditionalSyncProvider } from '@/components/shopify-sync/conditional-sync-provider'
import { MissingOrdersBanner } from '@/components/orders/MissingOrdersBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CaterStation',
  description: 'Catering management system',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <ConditionalSyncProvider>
            <Nav />
            <div className="w-full px-6">
              <MissingOrdersBanner />
            </div>
            <main className="w-full px-6 py-6">
              {children}
            </main>
            <Toaster />
          </ConditionalSyncProvider>
        </Providers>
      </body>
    </html>
  )
} 