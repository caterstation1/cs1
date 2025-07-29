import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    const staff = await prisma.staff.findUnique({
      where: { email }
    })
    
    if (!staff || staff.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    // Generate and return a token or session as needed (stub for now)
    return NextResponse.json({ message: 'Login successful', staff })
  } catch (error) {
    console.error('Failed to login:', error)
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 })
  }
} 