import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const q = (request.nextUrl.searchParams.get('q') || '').trim()
    const take = Math.min(Number(request.nextUrl.searchParams.get('take') || '20'), 100)
    const rows = await prisma.company.findMany({
      where: q
        ? {
            OR: [
              { canonicalCompanyName: { contains: q, mode: 'insensitive' } },
              { primaryDomain: { contains: q, mode: 'insensitive' } },
              { alternateDomains: { has: q.toLowerCase() } },
            ],
          }
        : {},
      select: {
        companyId: true,
        canonicalCompanyName: true,
        primaryDomain: true,
        totalRevenue: true,
        totalOrders: true,
        contacts: { select: { contactId: true } },
      },
      orderBy: [{ totalRevenue: 'desc' }, { totalOrders: 'desc' }],
      take,
    })
    return NextResponse.json({
      rows: rows.map((row) => ({
        companyId: row.companyId,
        companyName: row.canonicalCompanyName,
        domain: row.primaryDomain,
        revenue: Number(row.totalRevenue || 0),
        orders: Number(row.totalOrders || 0),
        contacts: row.contacts.length,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to search companies' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
