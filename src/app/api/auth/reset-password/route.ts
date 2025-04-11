import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()
    
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }
    
    // Find the staff member with this reset token
    const staff = await prisma.staff.findFirst({
      where: { resetToken: token }
    })
    
    if (!staff) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      )
    }
    
    // Check if the token has expired
    if (staff.resetTokenExpiry && staff.resetTokenExpiry < new Date()) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 400 }
      )
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(password)
    
    // Update the staff member's password and clear the reset token
    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'An error occurred while resetting the password' },
      { status: 500 }
    )
  }
} 