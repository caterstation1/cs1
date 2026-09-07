import { prisma } from '@/lib/prisma'
import { AskCandidate, ToolResult } from '../schemas'

const MAX_CANDIDATES = 10

function scoreName(query: string, firstName: string, lastName: string): number {
  const q = query.toLowerCase().trim()
  const full = `${firstName} ${lastName}`.toLowerCase().trim()
  const parts = q.split(/\s+/).filter(Boolean)
  let score = 0
  if (full === q) score += 100
  else if (full.includes(q)) score += 60
  if (parts.length >= 2) {
    if (firstName.toLowerCase().includes(parts[0]) && lastName.toLowerCase().includes(parts[parts.length - 1])) {
      score += 80
    }
  } else if (parts.length === 1) {
    const p = parts[0]
    if (firstName.toLowerCase() === p || lastName.toLowerCase() === p) score += 50
    else if (firstName.toLowerCase().includes(p) || lastName.toLowerCase().includes(p)) score += 30
  }
  return score
}

function maskContact(value: string | null | undefined, includePII: boolean): string | null {
  if (!value) return null
  if (includePII) return value
  return null
}

export async function toolSearchPeople(query: string, includePII: boolean): Promise<ToolResult> {
  const q = query.trim()
  if (q.length < 2) {
    return { answer: 'Please provide at least 2 characters to search.', confidence: 0.2 }
  }

  const parts = q.split(/\s+/).filter(Boolean)
  const staff = await prisma.staff.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        ...(parts.length >= 2
          ? [{
              AND: [
                { firstName: { contains: parts[0], mode: 'insensitive' as const } },
                { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const } },
              ],
            }]
          : []),
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      accessLevel: true,
      isDriver: true,
      isActive: true,
    },
    take: 20,
  })

  const recentOrders = await prisma.order.findMany({
    where: {
      cancelledAt: null,
      OR: [
        { customerFirstName: { contains: q, mode: 'insensitive' } },
        { customerLastName: { contains: q, mode: 'insensitive' } },
        ...(parts.length >= 2
          ? [{
              AND: [
                { customerFirstName: { contains: parts[0], mode: 'insensitive' as const } },
                { customerLastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const } },
              ],
            }]
          : []),
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      customerFirstName: true,
      customerLastName: true,
      customerPhone: true,
      customerEmail: true,
      deliveryDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  })

  type Scored = AskCandidate & { score: number }

  const scored: Scored[] = []

  for (const s of staff) {
    const name = `${s.firstName} ${s.lastName}`.trim()
    let score = scoreName(q, s.firstName, s.lastName)
    if (s.isActive) score += 30
    score += 20
    scored.push({
      id: `staff-${s.id}`,
      kind: 'staff',
      name,
      subtitle: [s.accessLevel, s.isDriver ? 'driver' : null, s.isActive ? null : 'inactive'].filter(Boolean).join(' · '),
      phone: maskContact(s.phone, includePII),
      email: maskContact(s.email, includePII),
      href: '/admin/datadrivers',
      score,
    })
  }

  const seenCustomers = new Set<string>()
  for (const o of recentOrders) {
    const name = [o.customerFirstName, o.customerLastName].filter(Boolean).join(' ').trim()
    const key = name.toLowerCase()
    if (!name || seenCustomers.has(key)) continue
    seenCustomers.add(key)
    let score = scoreName(q, o.customerFirstName, o.customerLastName)
    score += 5
    scored.push({
      id: `customer-${o.id}`,
      kind: 'customer',
      name,
      subtitle: `Customer · order #${o.orderNumber}${o.deliveryDate ? ` · ${o.deliveryDate}` : ''}`,
      phone: maskContact(o.customerPhone, includePII),
      email: maskContact(o.customerEmail, includePII),
      href: `/orders?search=${o.orderNumber}`,
      score,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, MAX_CANDIDATES).map(({ score: _s, ...c }) => c)

  if (top.length === 0) {
    return {
      answer: `No staff or customers matching "${q}". Try a full name or order number.`,
      confidence: 0.3,
      candidates: [],
    }
  }

  return {
    answer:
      top.length === 1
        ? `Found 1 match for "${q}".`
        : `Found ${top.length} matches for "${q}" — pick the one you need:`,
    confidence: top.length === 1 ? 0.9 : 0.75,
    candidates: top,
    evidence: {
      tables: [{
        name: `People matching "${q}"`,
        rows: top.map((c) => ({
          name: c.name,
          type: c.kind,
          detail: c.subtitle,
          phone: c.phone,
          email: c.email,
        })),
      }],
      ...(top.length === 1 && top[0].href
        ? { links: [{ label: `Open ${top[0].name}`, href: top[0].href }] }
        : {}),
    },
  }
}
