import { NextRequest, NextResponse } from 'next/server'
import { confirmRequestSchema } from '@/lib/ai/schemas'
import { commitPendingOrderUpdate } from '@/lib/ai/commit-order-update'
import { getAccessLevel } from '@/lib/authz'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ZodError } from 'zod'

export async function POST(req: NextRequest) {
  try {
    const access = await getAccessLevel()
    if (!access || (access !== 'owner' && access !== 'admin' && access !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const { confirmToken } = confirmRequestSchema.parse(json)

    const session = await getServerSession(authOptions).catch(() => null)
    const actor = session?.user
      ? { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null }
      : undefined

    const result = await commitPendingOrderUpdate(confirmToken, actor)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      answer: `Order #${result.orderNumber} updated successfully.`,
      confidence: 1,
      evidence: {
        links: [{ label: `Open order #${result.orderNumber}`, href: `/orders?search=${result.orderNumber}` }],
      },
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    const details = err instanceof Error ? err.message : 'Confirm failed'
    return NextResponse.json({ error: details }, { status: 500 })
  }
}
