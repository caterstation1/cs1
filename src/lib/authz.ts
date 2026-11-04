import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function getAccessLevel(): Promise<string | null> {
  const session = await getServerSession(authOptions as any)
  return (session as any)?.user?.accessLevel ?? null
}

export async function requireRole(anyOf: string[]): Promise<string> {
  const role = await getAccessLevel()
  if (!role || !anyOf.includes(role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  return role
}

// Payroll cost and revenue on the roster: owners, plus Sofia by name.
//
// Sofia carries accessLevel 'owner' today so the role check alone would let
// her in, but the grant is to the person, not to the role she happens to hold
// — a future demotion to 'admin' must not silently take the figures away, and
// a future promotion of somebody else must not silently hand them over. Email
// rather than display name because a name is edited in the staff screen
// without anyone thinking about permissions.
//
// This is a hardcoded individual and should become a real permission (a
// Staff-level flag, or a named grant table) the moment a second one is asked
// for. Env override so it can be corrected without a deploy.
const ROSTER_LABOUR_COST_EMAILS = new Set(
  (process.env.ROSTER_LABOUR_COST_EMAILS || 'sofia@caterstation.co.nz')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

export async function canViewRosterLabourCost(): Promise<boolean> {
  const session = await getServerSession(authOptions as any)
  const user = (session as any)?.user
  if (!user) return false
  if (user.accessLevel === 'owner') return true
  const email = String(user.email || '').trim().toLowerCase()
  return !!email && ROSTER_LABOUR_COST_EMAILS.has(email)
}

// The same named people, without the owner-role fallback above.
//
// The calendar roster drawer shows the figures to Sofia alone — deliberately
// narrower than the weekly roster page, which owners can also read. Asked for
// that way, so dropping the role check here is the point rather than an
// oversight: widening this to 'owner' would quietly undo it.
export async function isRosterLabourCostNamedUser(): Promise<boolean> {
  const session = await getServerSession(authOptions as any)
  const email = String((session as any)?.user?.email || '').trim().toLowerCase()
  return !!email && ROSTER_LABOUR_COST_EMAILS.has(email)
}








