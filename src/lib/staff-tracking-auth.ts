import { getServerSession } from 'next-auth/next'
import type { NextRequest } from 'next/server'
import { sign, verify } from 'jsonwebtoken'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuthSecret } from '@/lib/auth-secret'

const AUTH_SECRET = getAuthSecret()

export type ShiftTrackingClaims = {
  tokenType: 'shift_tracking'
  staffId: string
  shiftId: string
  email: string
  accessLevel: string
}

type ResolvedStaffAuth =
  | {
      staff: {
        id: string
        email: string
        accessLevel: string
      }
      authMode: 'session' | 'bearer'
      shiftId?: string
    }
  | null

export function createShiftTrackingToken(claims: ShiftTrackingClaims): string {
  return sign(claims, AUTH_SECRET, { expiresIn: '18h' })
}

export function verifyShiftTrackingToken(token: string): ShiftTrackingClaims | null {
  try {
    const decoded = verify(token, AUTH_SECRET) as ShiftTrackingClaims
    if (decoded?.tokenType !== 'shift_tracking') return null
    if (!decoded.staffId || !decoded.shiftId || !decoded.email || !decoded.accessLevel) return null
    return decoded
  } catch {
    return null
  }
}

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null
  return token
}

export async function resolveStaffAuthFromRequest(request: NextRequest): Promise<ResolvedStaffAuth> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email || null
  if (email) {
    const staff = await prisma.staff.findUnique({
      where: { email },
      select: { id: true, email: true, accessLevel: true },
    })
    if (!staff) return null
    return { staff, authMode: 'session' }
  }

  const bearerToken = extractBearerToken(request)
  if (!bearerToken) return null
  const claims = verifyShiftTrackingToken(bearerToken)
  if (!claims) return null

  const staff = await prisma.staff.findFirst({
    where: {
      id: claims.staffId,
      email: {
        equals: claims.email,
        mode: 'insensitive',
      },
    },
    select: { id: true, email: true, accessLevel: true },
  })
  if (!staff) return null
  return { staff, authMode: 'bearer', shiftId: claims.shiftId }
}
