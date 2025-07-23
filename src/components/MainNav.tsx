'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { name: 'Orders', href: '/orders' },
  { name: 'Realtime Orders', href: '/realtime-orders' },
  { name: 'Products', href: '/products' },
  { name: 'Staff', href: '/staff' },
  { name: 'Roster', href: '/roster' },
  { name: 'Timesheet', href: '/timesheet' },
]

export function MainNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b">
      <div className="flex h-16 items-center px-4">
        <div className="flex space-x-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === item.href
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
} 