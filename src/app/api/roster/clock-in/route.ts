import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const fitForWork = typeof body?.fitForWork === 'boolean' ? body.fitForWork : null
    const householdSymptoms =
      typeof body?.householdSymptoms === 'boolean' ? body.householdSymptoms : null
    if (fitForWork === null || householdSymptoms === null) {
      return NextResponse.json(
        { error: 'Wellness check is required before clock-in.' },
        { status: 400 }
      )
    }

    // Get the current user's session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the staff member
    const staff = await prisma.staff.findUnique({
      where: { email: session.user.email }
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    // Check if there's already an active shift
    const activeShift = await prisma.shift.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null
      }
    })

    if (activeShift) {
      return NextResponse.json(
        { error: 'Already clocked in' },
        { status: 400 }
      )
    }

    // Create a new shift
    const shift = await prisma.shift.create({
      data: {
        staffId: staff.id,
        clockIn: new Date(),
        date: new Date(),
        notes: `Wellness check: fitForWork=${fitForWork ? 'yes' : 'no'}, householdSymptoms=${householdSymptoms ? 'yes' : 'no'}`,
      }
    })

    let wellnessRule = await prisma.fcpRule.findUnique({
      where: { code: 'staff_wellness_check' },
      select: { id: true, name: true, severity: true },
    })
    if (!wellnessRule) {
      const card = await prisma.fcpCard.findUnique({
        where: { code: 'starting_health' },
        select: { id: true },
      })
      if (card) {
        wellnessRule = await prisma.fcpRule.create({
          data: {
            cardId: card.id,
            code: 'staff_wellness_check',
            name: 'Staff wellness declaration',
            description: 'Wellness declaration captured at clock-in.',
            triggerType: 'STAFF_BASED',
            frequency: 'DAILY',
            severity: 'HIGH',
            isActive: true,
            config: { dashboardCategory: 'Audit', taskTitle: 'Staff wellness declaration' },
          },
          select: { id: true, name: true, severity: true },
        })
      }
    }
    if (wellnessRule) {
      const record = await prisma.fcpRecord.create({
        data: {
          ruleId: wellnessRule.id,
          status: 'SUBMITTED',
          recordedById: staff.id,
          data: {
            fitForWork,
            householdSymptoms,
            source: 'clock_in',
            shiftId: shift.id,
            staffName: `${staff.firstName} ${staff.lastName}`.trim(),
          },
        },
      })

      if (!fitForWork || householdSymptoms) {
        await prisma.fcpIncident.create({
          data: {
            ruleId: wellnessRule.id,
            title: `Staff wellness review: ${staff.firstName} ${staff.lastName}`,
            description: `Clock-in wellness response flagged risk.\nfitForWork=${fitForWork}\nhouseholdSymptoms=${householdSymptoms}\nrecordId=${record.id}`,
            severity: wellnessRule.severity,
            status: 'OPEN',
          },
        })
      }
    }

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error clocking in:', error)
    return NextResponse.json(
      { error: 'Failed to clock in' },
      { status: 500 }
    )
  }
} 