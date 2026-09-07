'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileTrackingStatus } from '@/components/ui/MobileTrackingStatus'

export function MobileAppHeader() {
  return (
    <>
      <header
        className="app-mobile-chrome fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-12 items-center gap-3 px-4">
          <Link href="/dashboard" className="text-base font-semibold text-slate-900" prefetch={false}>
            CaterStation
          </Link>
          <MobileTrackingStatus />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-9 px-2 text-slate-700"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Log out
          </Button>
        </div>
      </header>
      <div
        className="app-mobile-chrome md:hidden"
        style={{ height: 'calc(3rem + env(safe-area-inset-top))' }}
        aria-hidden
      />
    </>
  )
}
