import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function GET() {
  try {
    // Check if test staff already exists
    const existingStaff = await prisma.staff.findUnique({
      where: { email: 'test@example.com' }
    })

    if (existingStaff) {
      return NextResponse.json({ 
        message: 'Test staff already exists',
        staff: existingStaff
      })
    }

    // Create a test staff member
    const hashedPassword = await hashPassword('password123')
    const staff = await prisma.staff.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        payRate: 25,
        accessLevel: 'admin',
        password: hashedPassword
      }
    })

    return NextResponse.json({ 
      message: 'Test staff created successfully',
      staff
    })
  } catch (error) {
    console.error('Error creating test staff:', error)
    return NextResponse.json(
      { error: 'Failed to create test staff' },
      { status: 500 }
    )
  }
} 