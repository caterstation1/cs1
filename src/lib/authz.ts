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








