import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getPayRun } from '@/lib/xero/payroll'

export async function POST(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const payrollRunId = body.payrollRunId as string
    if (!payrollRunId) {
      return NextResponse.json({ error: 'payrollRunId is required' }, { status: 400 })
    }

    const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } })
    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (run.status === 'posted') {
      return NextResponse.json({ error: 'Payrun already posted' }, { status: 409 })
    }
    if (!run.xeroPayrunId) {
      return NextResponse.json({ error: 'No Xero payrun linked' }, { status: 400 })
    }

    const config = await prisma.xeroPayrollConfig.findFirst()
    if (!config?.tenantId) {
      return NextResponse.json({ error: 'Xero not configured' }, { status: 400 })
    }

    const xeroPayrun = await getPayRun(config.tenantId, run.xeroPayrunId)
    const status = (xeroPayrun as any)?.payRuns?.[0]?.payRunStatus
    if (status !== 'Posted') {
      return NextResponse.json(
        {
          error: 'Payrun must be Posted in Xero first. Post it in Xero Payroll, then retry.',
          xeroStatus: status,
        },
        { status: 400 }
      )
    }

    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'posted', postedAt: new Date() },
    })

    return NextResponse.json({
      payrollRunId,
      status: 'posted',
    })
  } catch (e) {
    console.error('payroll post error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
