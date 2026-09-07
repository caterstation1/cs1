import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getPaySlips, getEmployees } from '@/lib/xero/payroll'

/**
 * Generates a bank payment file in a common NZ format (CSV).
 * Provide a sample of your bank's required format to customize columns.
 * This uses: Employee Name, Account (if available), Amount, Reference
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payrollRunId = req.nextUrl.searchParams.get('payrollRunId')
  if (!payrollRunId) {
    return NextResponse.json({ error: 'payrollRunId is required' }, { status: 400 })
  }

  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } })
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
  if (run.status !== 'posted') {
    return NextResponse.json(
      { error: 'Payrun must be posted before generating bank file' },
      { status: 400 }
    )
  }
  if (!run.xeroPayrunId) {
    return NextResponse.json({ error: 'No Xero payrun linked' }, { status: 400 })
  }

  const config = await prisma.xeroPayrollConfig.findFirst()
  if (!config?.tenantId) {
    return NextResponse.json({ error: 'Xero not configured' }, { status: 400 })
  }

  try {
    const [paySlipsRes, employeesRes] = await Promise.all([
      getPaySlips(config.tenantId, run.xeroPayrunId),
      getEmployees(config.tenantId),
    ])
    const payslips = ((paySlipsRes as any)?.payslips ?? []) as any[]
    const employees = ((employeesRes as any)?.employees ?? []) as any[]
    const empMap = new Map<string, any>(employees.map((e: any) => [e.employeeID, e]))

    const rows: { employeeId: string; name: string; netPay: number; accountNumber?: string }[] = []
    for (const ps of payslips) {
      const empId = ps.employeeID
      const emp = empMap.get(empId) as any | undefined
      const netPay = typeof ps.totalPay === 'number' ? ps.totalPay : parseFloat(ps.totalPay) || 0
      if (netPay <= 0) continue
      const name = (ps.firstName && ps.lastName) ? `${ps.firstName} ${ps.lastName}`.trim() : (emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Unknown')
      rows.push({
        employeeId: empId,
        name,
        netPay,
        accountNumber: emp?.bankAccounts?.[0]?.accountNumber,
      })
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const csvHeader = 'Employee Name,Account Number,Amount,Reference'
    const csvRows = rows.map((r) =>
      [r.name, r.accountNumber ?? '', r.netPay.toFixed(2), `Payroll ${run.payPeriodStart}`].join(',')
    )
    const csv = [csvHeader, ...csvRows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll_${run.payPeriodStart}_${dateStr}.csv"`,
      },
    })
  } catch (e) {
    console.error('bank file error', e)
    return NextResponse.json({ error: 'Failed to generate bank file' }, { status: 502 })
  }
}
