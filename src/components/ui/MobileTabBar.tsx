'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Clock3, LayoutDashboard, ListChecks, Menu, Users, Croissant, Settings } from 'lucide-react'
import { MOBILE_PRIMARY_TABS, usesStandardMobileShell } from '@/lib/mobile-nav'
import { useStaffSession } from '@/hooks/useStaffSession'

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex min-h-[64px] flex-col items-center justify-center px-2 py-2 ${
        active ? 'mobile-tab-active font-semibold' : 'mobile-tab-inactive'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="mt-0.5 text-[11px] leading-none">{label}</span>
    </Link>
  )
}

export default function MobileTabBar() {
  const { access, isAuthenticated, authPending, accessChecked } = useStaffSession()
  const pathname = usePathname()

  if (!isAuthenticated && accessChecked) {
    return null
  }

  if (authPending) {
    return null
  }

  const shellClass =
    'app-mobile-chrome mobile-tabbar fixed bottom-0 left-0 right-0 z-50 border-t md:hidden'

  const shellStyle = {
    paddingBottom: 'env(safe-area-inset-bottom)',
    minHeight: 'var(--mobile-tabbar-height,72px)',
  }

  if (access === 'bakery') {
    return (
      <div className={shellClass} style={shellStyle}>
        <div className="flex w-full justify-center">
          <TabLink
            href="/bakery"
            label="Bakery"
            icon={Croissant}
            active={pathname === '/bakery' || pathname?.startsWith('/bakery/')}
          />
        </div>
      </div>
    )
  }

  if (access === 'pricing_lab') {
    return (
      <div className={shellClass} style={shellStyle}>
        <div className="flex w-full justify-center">
          <TabLink
            href="/pricing-lab"
            label="Pricing"
            icon={Settings}
            active={pathname === '/pricing-lab' || pathname?.startsWith('/pricing-lab/')}
          />
        </div>
      </div>
    )
  }

  if (access === 'wlg_team' || access === 'wlg_admin') {
    return (
      <div className={shellClass} style={shellStyle}>
        <div className="grid w-full grid-cols-3">
          <TabLink
            href="/wlg-calendar"
            label="Calendar"
            icon={Calendar}
            active={pathname === '/wlg-calendar' || pathname?.startsWith('/wlg-calendar/')}
          />
          <TabLink
            href="/wlg-staff"
            label="Staff"
            icon={Users}
            active={pathname === '/wlg-staff' || pathname?.startsWith('/wlg-staff/')}
          />
          {access === 'wlg_admin' ? (
            <TabLink
              href="/wlg-comms"
              label="Comms"
              icon={ListChecks}
              active={pathname === '/wlg-comms' || pathname?.startsWith('/wlg-comms/')}
            />
          ) : (
            <TabLink
              href="/labels/print"
              label="Labels"
              icon={Clock3}
              active={pathname === '/labels/print' || pathname?.startsWith('/labels/print')}
            />
          )}
        </div>
      </div>
    )
  }

  if (!usesStandardMobileShell(access)) {
    return null
  }

  const tabIcons = {
    '/dashboard': LayoutDashboard,
    '/realtime-orders': ListChecks,
    '/timesheet': Clock3,
    '/mobile/menu': Menu,
  } as const

  return (
    <div className={shellClass} style={shellStyle}>
      <div className="grid w-full grid-cols-4">
        {MOBILE_PRIMARY_TABS.map((tab) => {
          const Icon = tabIcons[tab.href]
          const active =
            tab.href === '/mobile/menu'
              ? pathname === '/mobile/menu'
              : pathname === tab.href || pathname?.startsWith(tab.href + '/')
          return (
            <TabLink key={tab.href} href={tab.href} label={tab.label} icon={Icon} active={active} />
          )
        })}
      </div>
    </div>
  )
}
