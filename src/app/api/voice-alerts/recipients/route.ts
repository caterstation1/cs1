import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { KITCHEN_RECIPIENT, normalizeRecipient } from '@/lib/voice-alerts'

/**
 * Who a voice alert can be addressed to: the Kitchen station plus the first
 * name of every active staff member. Duplicate first names collapse to one
 * entry — anyone listening under that name hears the alert.
 */
export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { firstName: 'asc' },
      select: { firstName: true },
    })

    const seen = new Set([KITCHEN_RECIPIENT.toLowerCase()])
    const recipients = [KITCHEN_RECIPIENT]

    for (const member of staff) {
      const firstName = normalizeRecipient(member.firstName)
      if (!firstName) continue
      const key = firstName.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      recipients.push(firstName)
    }

    return NextResponse.json({ recipients })
  } catch (error) {
    console.error('GET /api/voice-alerts/recipients failed:', error)
    return NextResponse.json({ recipients: [KITCHEN_RECIPIENT] })
  }
}
