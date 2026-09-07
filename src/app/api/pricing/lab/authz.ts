// Shared gate for the Pricing Lab routes.
//
// Wider than the rest of /api/pricing because the lab is the one pricing
// surface external city operators are given: a `pricing_lab` login sees this
// and nothing else (src/middleware.ts).

import { getAccessLevel } from '@/lib/authz'

const ALLOWED = new Set(['owner', 'admin', 'pricing_lab', 'wlg_admin'])

export async function requireLabRole(): Promise<{ role: string } | { error: 'Unauthorized' | 'Forbidden'; status: 401 | 403 }> {
  const role = await getAccessLevel()
  if (!role) return { error: 'Unauthorized', status: 401 }
  if (!ALLOWED.has(role)) return { error: 'Forbidden', status: 403 }
  return { role }
}
