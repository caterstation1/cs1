import { NextResponse } from 'next/server'

export async function GET() {
  // This should be updated whenever you deploy to production
  // You can also make this dynamic by reading from an environment variable
  const productionUrl = process.env.PRODUCTION_URL || 'https://caterstation1-aji3fttat-caterstation1s-projects.vercel.app'
  
  return NextResponse.json({ 
    productionUrl,
    timestamp: new Date().toISOString(),
    message: 'Current production deployment URL'
  })
}
