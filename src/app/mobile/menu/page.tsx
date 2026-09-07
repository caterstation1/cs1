'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { ChevronRight, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMobileMoreLinks } from '@/lib/mobile-nav'
import { AskAIButton } from '@/components/ai/AskAI'
import { useStaffSession } from '@/hooks/useStaffSession'

export default function MobileMenuPage() {
  const { access } = useStaffSession()
  const links = getMobileMoreLinks(access)
  const canAskAI = ['owner', 'admin', 'manager'].includes(access)

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Menu</h1>
        <p className="mt-1 text-sm text-slate-600">More pages and account actions</p>
      </div>

      <nav className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                prefetch={false}
                className="flex min-h-[56px] items-center justify-between px-4 py-3 active:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">{link.label}</p>
                  {link.description ? (
                    <p className="text-sm text-slate-600">{link.description}</p>
                  ) : null}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {canAskAI ? (
          <AskAIButton className="h-11 w-full justify-center" />
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  )
}
