'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function Nav() {
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/orders', label: 'All Orders' },
    { href: '/realtime-orders', label: 'Realtime Orders' },
    { href: '/products', label: 'Products' },
    { href: '/customers', label: 'Customers' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/staff', label: 'Staff' },
    { href: '/roster', label: 'Roster' },
    { href: '/timesheet', label: 'Timesheet' },
  ]

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
      </div>
    </nav>
  )
} 