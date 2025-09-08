'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signIn, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'

export function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const access = session?.user?.accessLevel

  const baseLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/orders', label: 'All Orders' },
    { href: '/realtime-orders', label: 'Realtime Orders' },
    { href: '/products', label: 'Products' },
    { href: '/customers', label: 'Customers' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/wlg-calendar', label: 'WLG Calendar' },
    { href: '/staff', label: 'Staff' },
    { href: '/roster', label: 'Roster' },
    { href: '/timesheet', label: 'Timesheet' },
    { href: '/pricing-lab', label: 'Pricing Lab' },
  ]

  const links = access === 'pricing_lab'
    ? baseLinks.filter(l => l.href === '/pricing-lab')
    : baseLinks

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
        <div className="ml-auto">
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