import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getEmployees } from '@/lib/xero/payroll'

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length > 0 ? email : null
}

function normalizeName(firstName: unknown, lastName: unknown): string | null {
  const first = typeof firstName === 'string' ? firstName.trim().toLowerCase() : ''
  const last = typeof lastName === 'string' ? lastName.trim().toLowerCase() : ''
  const full = `${first} ${last}`.trim().replace(/\s+/g, ' ')
  return full.length > 0 ? full : null
}

export async function POST() {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const config = await prisma.xeroPayrollConfig.findFirst()
    const tenantIdFromConfig = config?.tenantId ?? null
    const connections = await prisma.xeroConnection.findMany({
      select: { tenantId: true, tenantName: true },
      orderBy: { updatedAt: 'desc' },
    })

    let tenantId = tenantIdFromConfig
    if (!tenantId) {
      if (connections.length === 0) {
        return NextResponse.json(
          {
            error: 'No Xero connection found. Connect Xero first.',
            diagnostics: {
              hasPayrollTenantConfig: !!tenantIdFromConfig,
              connectionCount: 0,
            },
          },
          { status: 400 }
        )
      }
      // If payroll config tenant is not set, fall back to the most recently active connection.
      tenantId = connections[0].tenantId
    }

    const [staffRows, employeesRes] = await Promise.all([
      prisma.staff.findMany({
        where: { isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true, xeroEmployeeId: true },
      }),
      getEmployees(tenantId),
    ])

    const employees = ((employeesRes as any)?.employees ?? []) as any[]
    const xeroByEmail = new Map<string, string | null>()
    const xeroByName = new Map<string, string | null>()
    for (const e of employees) {
      const email = normalizeEmail(e?.email ?? e?.emailAddress ?? e?.personalEmail)
      const fullName = normalizeName(e?.firstName ?? e?.FirstName, e?.lastName ?? e?.LastName)
      const employeeId = typeof e?.employeeID === 'string' ? e.employeeID : null
      if (!employeeId) continue
      if (email) {
        if (!xeroByEmail.has(email)) {
          xeroByEmail.set(email, employeeId)
        } else if (xeroByEmail.get(email) !== employeeId) {
          // Duplicate Xero emails are ambiguous; do not auto-link these.
          xeroByEmail.set(email, null)
        }
      }
      if (fullName) {
        if (!xeroByName.has(fullName)) {
          xeroByName.set(fullName, employeeId)
        } else if (xeroByName.get(fullName) !== employeeId) {
          // Duplicate Xero names are ambiguous; do not auto-link these.
          xeroByName.set(fullName, null)
        }
      }
    }

    let linked = 0
    const ambiguousEmails: string[] = []
    const unmatched: string[] = []

    for (const s of staffRows) {
      if (s.xeroEmployeeId) continue
      const email = normalizeEmail(s.email)
      if (!email) {
        unmatched.push(`${s.firstName} ${s.lastName}`.trim())
        continue
      }
      let xeroId = xeroByEmail.get(email)
      if (xeroId === null) {
        ambiguousEmails.push(email)
        continue
      }
      if (xeroId === undefined) {
        const nameKey = normalizeName(s.firstName, s.lastName)
        if (nameKey) {
          const byName = xeroByName.get(nameKey)
          if (byName) {
            xeroId = byName
          } else if (byName === null) {
            unmatched.push(`${s.firstName} ${s.lastName}`.trim() + ' (ambiguous name)')
            continue
          }
        }
      }
      if (!xeroId) {
        unmatched.push(`${s.firstName} ${s.lastName}`.trim())
        continue
      }

      await prisma.staff.update({
        where: { id: s.id },
        data: { xeroEmployeeId: xeroId },
      })
      linked += 1
    }

    return NextResponse.json({
      tenantId,
      linked,
      unmatchedCount: unmatched.length,
      ambiguousEmailCount: ambiguousEmails.length,
      unmatched,
      ambiguousEmails,
    })
  } catch (e: unknown) {
    console.error('link-staff-by-email error', e)
    const err = e as { response?: { body?: unknown }; message?: string }
    return NextResponse.json(
      {
        error: 'Failed to link staff by email',
        details: err.response?.body ?? err.message ?? String(e),
      },
      { status: 502 }
    )
  }
}
