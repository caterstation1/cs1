import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePasswords, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Find the staff member by email
    const staff = await prisma.staff.findUnique({
      where: { email }
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if the staff member has a password set
    if (!staff.password) {
      return NextResponse.json(
        { error: 'Please set up your password first' },
        { status: 401 }
      )
    }

    // Verify the password
    const isPasswordValid = await comparePasswords(password, staff.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update the last login time
    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLogin: new Date() }
    })

    // Generate a JWT token
    const token = generateToken(staff.id, staff.email, staff.accessLevel)

    // Return the token
    return NextResponse.json({ token })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    )
  }
} 