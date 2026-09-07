'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { RefreshCw, ExternalLink, LogOut, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import dynamic from 'next/dynamic'
import { AskAIButton } from '@/components/ai/AskAI'
import { MobileAppHeader } from '@/components/ui/MobileAppHeader'
import { getNavLinksForAccess } from '@/lib/nav-links'

const MobileTabBar = dynamic(() => import('./MobileTabBar'), { ssr: false })

export function Nav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [serverAccess, setServerAccess] = useState<string | null>(null)
  const [accessChecked, setAccessChecked] = useState(false)
  const isAuthScreen = pathname === '/login' || pathname?.startsWith('/reset-password')

  // useSession() can lag behind cookie auth — confirm via server
  useEffect(() => {
    let cancelled = false
    fetch('/api/me/access')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setServerAccess(typeof d?.accessLevel === 'string' ? d.accessLevel : null)
          setAccessChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) setAccessChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sessionAccess = session?.user?.accessLevel as string | undefined
  const access = sessionAccess ?? serverAccess ?? undefined
  const accessReady = Boolean(sessionAccess) || accessChecked
  const isAuthenticated = Boolean(session?.user) || Boolean(serverAccess)
  const canAskAI = ['owner', 'admin', 'manager'].includes((access ?? '').toLowerCase())
  const authPending = status === 'loading' && !accessChecked
  const [productionUrl, setProductionUrl] = useState<string>('')
  const [newMessagesCount, setNewMessagesCount] = useState(0)

  // Fetch the current production URL only when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      return
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
  }, [isAuthenticated])

  // Fetch new messages count for badge (for admin/owner/wlg_admin)
  useEffect(() => {
    if (!isAuthenticated || !['admin', 'owner', 'wlg_admin'].includes(access ?? '')) {
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
  }, [isAuthenticated, access])

  const authControls = authPending ? null : isAuthenticated ? (
    <>
      {canAskAI && <AskAIButton className="h-8 px-3 py-0 text-xs sm:text-sm" />}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        <LogOut className="mr-1.5 h-4 w-4" />
        Logout
      </Button>
    </>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => signIn(undefined, { callbackUrl: '/products' })}
    >
      <LogIn className="mr-1.5 h-4 w-4" />
      Login
    </Button>
  )

  const links = accessReady ? getNavLinksForAccess(access) : []

  const handleSyncToLatest = () => {
    if (productionUrl) {
      window.location.href = productionUrl
    }
  }

  // Keep login/reset pages quiet: no route links while unauthenticated.
  // This prevents repeated protected-route fetches and redirect churn.
  if (!isAuthenticated && isAuthScreen) {
    return (
      <>
        <div className="app-mobile-chrome fixed right-3 top-3 z-50 md:hidden">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-3 shadow-sm"
            onClick={() => signIn(undefined, { callbackUrl: '/dashboard' })}
          >
            <LogIn className="mr-1.5 h-4 w-4" />
            Login
          </Button>
        </div>
        <nav className="app-desktop-nav fixed inset-x-0 top-0 z-40 hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:block">
          <div className="flex h-16 items-center px-4">
            <Link href="/" className="font-bold" prefetch={false}>
              CaterStation
            </Link>
            <div className="ml-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => signIn(undefined, { callbackUrl: '/dashboard' })}
              >
                <LogIn className="mr-1.5 h-4 w-4" />
                Login
              </Button>
            </div>
          </div>
        </nav>
        <MobileTabBar />
      </>
    )
  }

  return (
    <>
    {isAuthenticated ? <MobileAppHeader /> : null}
    <nav className="app-desktop-nav fixed inset-x-0 top-0 z-40 hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:block">
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
          {authControls}
        </div>
      </div>
    </nav>
    {/* Mobile bottom tabs */}
    <MobileTabBar />
    </>
  )
} 