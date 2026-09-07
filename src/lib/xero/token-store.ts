import { prisma } from '@/lib/prisma'
import type { TokenSetParameters } from 'openid-client'

export async function getStoredToken(tenantId: string): Promise<TokenSetParameters | null> {
  const conn = await prisma.xeroConnection.findUnique({
    where: { tenantId },
  })
  if (!conn || !conn.tokenSet) return null
  return conn.tokenSet as unknown as TokenSetParameters
}

export async function saveToken(
  tenantId: string,
  tenantName: string | null,
  tokenSet: TokenSetParameters
): Promise<void> {
  await prisma.xeroConnection.upsert({
    where: { tenantId },
    create: {
      tenantId,
      tenantName: tenantName ?? null,
      tokenSet: tokenSet as object,
      updatedAt: new Date(),
    },
    update: {
      tenantName: tenantName ?? undefined,
      tokenSet: tokenSet as object,
      updatedAt: new Date(),
    },
  })
}

export async function listConnections(): Promise<{ tenantId: string; tenantName: string | null }[]> {
  const conns = await prisma.xeroConnection.findMany({
    select: { tenantId: true, tenantName: true },
  })
  return conns
}
