import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🏥 Health check requested')
    
    // Test database connection with retry
    await withRetry(async () => {
      return await prisma.$queryRaw`SELECT 1`
    })
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: 'connected',
      prisma: {
        databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
      }
    })
    
  } catch (error) {
    console.error('❌ Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 