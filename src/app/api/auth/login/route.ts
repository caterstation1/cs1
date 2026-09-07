import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcryptjs from 'bcryptjs'
import { generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const loginEmail = String(email || '').trim().toLowerCase()
    const loginPassword = String(password || '')

    const staff = await prisma.staff.findFirst({
      where: {
        email: {
          equals: loginEmail,
          mode: 'insensitive',
        },
      },
    })

    let passwordValid = false
    if (staff?.password) {
      try {
        passwordValid = await bcryptjs.compare(loginPassword, staff.password)
      } catch {
        // Backward-compat in case any legacy plaintext values remain.
        passwordValid = loginPassword === staff.password
      }
    }

    if (!staff || !passwordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    const accessLevel = staff.accessLevel || 'basic'
    const mobileToken = generateToken(staff.id, staff.email, accessLevel)
    return NextResponse.json({
      message: 'Login successful',
      token: mobileToken,
      staff: {
        id: staff.id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        accessLevel,
      },
    })
  } catch (error) {
    console.error('Failed to login:', error)
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 })
  }
} 