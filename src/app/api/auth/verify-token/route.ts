import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    
    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token is required' }, { status: 400 })
    }
    
    // Find the staff member with this reset token
    const staff = await prisma.staff.findUnique({
      where: { resetToken: token }
    })
    
    if (!staff) {
      return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 400 })
    }
    
    // Check if the token has expired
    if (staff.resetTokenExpiry && staff.resetTokenExpiry < new Date()) {
      return NextResponse.json({ valid: false, error: 'Token has expired' }, { status: 400 })
    }
    
    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json(
      { valid: false, error: 'An error occurred while verifying the token' },
      { status: 500 }
    )
  }
} 