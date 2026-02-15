'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import dynamic from 'next/dynamic'

const MobileTabBar = dynamic(() => import('./MobileTabBar'), { ssr: false })

export function Nav() {
  const pathname = usePathname()
  const sessionData = useSession()
  const session = sessionData?.data
  const access = session?.user?.accessLevel
  const [productionUrl, setProductionUrl] = useState<string>('')
  const [newMessagesCount, setNewMessagesCount] = useState(0)

  // Fetch the current production URL only when user is authenticated
  useEffect(() => {
    if (!session?.user) {
      return // Don't fetch if user is not authenticated
    }

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
        setProductionUrl('https://caterstation1-aji3fttat-caterstation1s-projects.vercel.app')
      }
    }

    fetchProductionUrl()
  }, [session?.user])

  // Fetch new messages count for badge (for admin/owner/wlg_admin)
  useEffect(() => {
    if (!session?.user || !['admin', 'owner', 'wlg_admin'].includes(access as string)) {
      return
    }

    const fetchNewMessages = async () => {
      try {
        const res = await fetch('/api/wlg-messages?status=new')
        if (res.ok) {
          const data = await res.json()
          setNewMessagesCount(data.length || 0)
        }
      } catch (error) {
        console.error('Failed to fetch new messages count:', error)
      }
    }

    fetchNewMessages()
    // Refresh every 60 seconds
    const interval = setInterval(fetchNewMessages, 60000)
    return () => clearInterval(interval)
  }, [session?.user, access])

  const baseLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/orders', label: 'All Orders' },
    { href: '/realtime-orders', label: 'Realtime Orders' },
    { href: '/products', label: 'Products' },
    { href: '/stock', label: 'Stock' },
    { href: '/cart', label: 'Cart' },
    { href: '/customers', label: 'Customers' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/wlg-calendar', label: 'WLG Calendar' },
    { href: '/wlg-staff', label: 'WLG Staff' },
    { href: '/wlg-comms', label: 'WLG Comms' },
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
    links = baseLinks.filter(l => l.href === '/wlg-calendar' || l.href === '/wlg-staff' || l.href === '/wlg-comms' || l.href === '/pricing-lab' || l.href === '/stock')
  } else if (access === 'admin' || access === 'owner') {
    // Admin and owner: hide wlg-calendar/wlg-staff but show wlg-comms
    links = baseLinks.filter(l => l.href !== '/wlg-calendar' && l.href !== '/wlg-staff')
  }

  return (
    <>
    <nav className="border-b hidden md:block">
      <div className="flex h-16 items-center px-4">
        <Link href="/" className="font-bold" prefetch={false}>
          CaterStation
        </Link>
        <div className="ml-6 flex items-center space-x-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary relative',
                pathname === link.href
                  ? 'text-foreground'
                  : 'text-muted-foreground'
                ,
                // Turn WLG Comms red when there are new messages
                link.href === '/wlg-comms' && newMessagesCount > 0 ? 'text-red-600 hover:text-red-700' : ''
              )}
            >
              {link.label}
              {link.href === '/wlg-comms' && newMessagesCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-1 h-5 min-w-[20px] px-1 text-xs"
                >
                  {newMessagesCount}
                </Badge>
              )}
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
    {/* Mobile bottom tabs */}
    <MobileTabBar />
    </>
  )
} 