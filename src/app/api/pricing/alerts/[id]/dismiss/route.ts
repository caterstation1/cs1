import { NextResponse } from 'next/server'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getAccessLevel()
  if (!role || (role !== 'admin' && role !== 'owner' && role !== 'pricing_lab')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const alert = await prisma.priceAlert.findUnique({ where: { id } })
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })

  // Dismissed, not resolved: the condition still holds, Peter just doesn't want
  // to see it. evaluateAlerts only reopens alerts that are neither, so a
  // dismissal sticks until the condition clears and comes back.
  const updated = await prisma.priceAlert.update({
    where: { id },
    data: { status: 'dismissed', resolvedAt: new Date() },
  })

  return NextResponse.json({ success: true, alert: updated })
}
