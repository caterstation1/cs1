import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Nav } from '@/components/ui/nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CaterStation',
  description: 'Catering Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        <main className="container mx-auto py-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
} 