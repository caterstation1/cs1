'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, LayoutDashboard, ListChecks, Users } from 'lucide-react'

function TabLink({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const pathname = usePathname()
  const active = pathname === href || pathname?.startsWith(href + '/')
  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex flex-col items-center justify-center px-3 py-2 min-w-[64px] ${active ? 'text-blue-600' : 'text-slate-600'}`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs mt-0.5">{label}</span>
    </Link>
  )
}

export default function MobileTabBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="w-full grid grid-cols-4">
        <TabLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
        <TabLink href="/calendar" label="Calendar" icon={Calendar} />
        <TabLink href="/realtime-orders" label="Realtime" icon={ListChecks} />
        <TabLink href="/roster" label="Roster" icon={Users} />
      </div>
    </div>
  )
}


