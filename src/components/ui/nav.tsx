'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const access = session?.user?.accessLevel
  const [productionUrl, setProductionUrl] = useState<string>('')

  // Fetch the current production URL
  useEffect(() => {
    const fetchProductionUrl = async () => {
      try {
        const response = await fetch('/api/production-url')
        if (response.ok) {
          const data = await response.json()
          setProductionUrl(data.productionUrl)
        }
      } catch (error) {
        console.error('Failed to fetch production URL:', error)
        // Fallback to hardcoded URL if API fails
        setProductionUrl('https://caterstation1-isyuxp2av-caterstation1s-projects.vercel.app')
      }
    }

    fetchProductionUrl()
  }, [])

  const baseLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/orders', label: 'All Orders' },
    { href: '/realtime-orders', label: 'Realtime Orders' },
    { href: '/products', label: 'Products' },
    { href: '/customers', label: 'Customers' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/wlg-calendar', label: 'WLG Calendar' },
    { href: '/wlg-staff', label: 'WLG Staff' },
    { href: '/staff', label: 'Staff' },
    { href: '/roster', label: 'Roster' },
    { href: '/timesheet', label: 'Timesheet' },
    { href: '/pricing-lab', label: 'Pricing Lab' },
    { href: '/settings', label: 'Settings' },
  ]

  const handleSyncToLatest = () => {
    if (productionUrl) {
      window.location.href = productionUrl
    }
  }

  let links = baseLinks
  if (access === 'pricing_lab') {
    links = baseLinks.filter(l => l.href === '/pricing-lab')
  } else if (access === 'wlg_team') {
    links = baseLinks.filter(l => l.href === '/wlg-calendar' || l.href === '/wlg-staff')
  } else if (access === 'wlg_admin') {
    links = baseLinks.filter(l => l.href === '/wlg-calendar' || l.href === '/wlg-staff' || l.href === '/pricing-lab')
  }

  return (
    <nav className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/" className="font-bold">
          CaterStation
        </Link>
        <div className="ml-6 flex items-center space-x-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === link.href
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button
            onClick={handleSyncToLatest}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            title="Sync to latest deployment"
            disabled={!productionUrl}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Sync to Latest</span>
            <ExternalLink className="h-3 w-3 sm:hidden" />
          </Button>
          {session?.user ? (
            <button className="text-sm underline" onClick={() => signOut({ callbackUrl: '/' })}>Logout</button>
          ) : (
            <button className="text-sm underline" onClick={() => signIn(undefined, { callbackUrl: '/products' })}>Login</button>
          )}
        </div>
      </div>
    </nav>
  )
} 