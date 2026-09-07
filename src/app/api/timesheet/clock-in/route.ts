import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('⏰ Clocking in...')
    const body = await request.json().catch(() => ({}))
    const fitForWork = typeof body?.fitForWork === 'boolean' ? body.fitForWork : null
    const householdSymptoms =
      typeof body?.householdSymptoms === 'boolean' ? body.householdSymptoms : false

    if (fitForWork === null) {
      return NextResponse.json(
        { error: 'Fit-for-work check is required before clock-in.' },
        { status: 400 }
      )
    }

    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const staff = await prisma.staff.findUnique({ where: { email } })
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // Check if there's already an active shift for this staff
    const activeShift = await prisma.shift.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null,
        status: 'active'
      }
    })
    
    if (activeShift) {
      return NextResponse.json(
        { error: 'Already clocked in. Please clock out first.' },
        { status: 400 }
      )
    }
    
    // Create new shift
    const shift = await prisma.shift.create({
      data: {
        staffId: staff.id,
        clockIn: new Date(),
        date: new Date(),
        status: 'active',
        notes: `Wellness check: fitForWork=${fitForWork ? 'yes' : 'no'}, householdSymptoms=${householdSymptoms ? 'yes' : 'no'}`,
      },
      include: {
        staff: true
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
    
    console.log(`✅ Clocked in successfully: ${shift.id}`)
    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error('❌ Error clocking in:', error)
    return NextResponse.json(
      { error: 'Failed to clock in' },
      { status: 500 }
    )
  }
} 