import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { createEmployee } from '@/lib/xero/payroll'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const staff = await prisma.staff.findUnique({ where: { id } })
  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  if (staff.xeroEmployeeId) {
    return NextResponse.json({ error: 'Staff already linked to Xero' }, { status: 400 })
  }

  const config = await prisma.xeroPayrollConfig.findFirst()
  if (!config?.tenantId) {
    return NextResponse.json({ error: 'Xero payroll not configured' }, { status: 400 })
  }

  const dateOfBirth = staff.dateOfBirth
    ? staff.dateOfBirth.toISOString().slice(0, 10)
    : '1990-01-01'
  const address = {
    addressLine1: staff.addressLine1 || 'Address TBC',
    city: staff.addressCity || 'Auckland',
    postCode: staff.addressPostCode || '1010',
    countryName: 'NEW ZEALAND',
  }

  try {
    const created = await createEmployee(config.tenantId, {
      firstName: staff.firstName,
      lastName: staff.lastName,
      dateOfBirth,
      address,
      email: staff.email,
    })
    const xeroId = (created as any)?.employees?.[0]?.employeeID
    if (!xeroId) {
      return NextResponse.json({ error: 'Xero did not return employee ID' }, { status: 502 })
    }
    await prisma.staff.update({
      where: { id },
      data: { xeroEmployeeId: xeroId },
    })
    return NextResponse.json({ xeroEmployeeId: xeroId })
  } catch (e: unknown) {
    console.error('create-xero error', e)
    const err = e as { response?: { body?: unknown }; message?: string }
    return NextResponse.json(
      {
        error: 'Failed to create Xero employee',
        details: err.response?.body ?? err.message ?? String(e),
      },
      { status: 502 }
    )
  }
}
