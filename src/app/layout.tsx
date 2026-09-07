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
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png' }],
  },
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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <ConditionalSyncProvider>
            <Nav />
            <div className="app-desktop-top-pad md:pt-16">
              <div className="w-full px-3 sm:px-4 md:px-6">
                <MissingOrdersBanner />
              </div>
              <main className="mobile-shell-page w-full px-3 py-4 pb-[calc(var(--mobile-tabbar-height,72px)+env(safe-area-inset-bottom)+16px)] sm:px-4 md:bg-background md:py-6 md:pb-6 md:px-6 md:text-foreground">
                {children}
              </main>
            </div>
            <Toaster />
          </ConditionalSyncProvider>
        </Providers>
      </body>
    </html>
  )
} 