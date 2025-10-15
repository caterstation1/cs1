import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection
    const staffCount = await prisma.staff.count()
    
    // Test environment variables
    const envCheck = {
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPassword: !!process.env.EMAIL_APP_PASSWORD,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
      jwtSecretLength: process.env.JWT_SECRET?.length || 0
    }
    
    return NextResponse.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        staffCount
      },
      environment: envCheck,
      message: 'Authentication test endpoint working'
    })
  } catch (error) {
    console.error('Auth test error:', error)
    return NextResponse.json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
