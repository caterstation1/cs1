import { NextRequest, NextResponse } from 'next/server'
import { FcpContactType } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

function parseContactType(value: string | null): FcpContactType | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  return Object.values(FcpContactType).includes(normalized as FcpContactType)
    ? (normalized as FcpContactType)
    : null
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type = parseContactType(searchParams.get('type'))

  const contacts = await prisma.fcpContact.findMany({
    where: {
      isActive: true,
      ...(type ? { type } : {}),
    },
    orderBy: [{ type: 'asc' }, { companyName: 'asc' }],
  })

  return NextResponse.json({ data: contacts })
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const companyName = String(body.companyName || '').trim()
  if (!companyName) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }

  const parsedType = parseContactType(typeof body.type === 'string' ? body.type : null) ?? 'OTHER'

  const contact = await prisma.fcpContact.create({
    data: {
      companyName,
      type: parsedType,
      contactPerson: String(body.contactPerson || '').trim() || null,
      website: String(body.website || '').trim() || null,
      about: String(body.about || '').trim() || null,
      phoneNumber: String(body.phoneNumber || '').trim() || null,
      email: String(body.email || '').trim() || null,
      isActive: body.isActive !== false,
    },
  })

  return NextResponse.json({ data: contact }, { status: 201 })
}
