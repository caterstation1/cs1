import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('Fetching suppliers...')
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc',
      },
    })
    console.log(`Found ${suppliers.length} suppliers`)
    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Processing supplier data...')
    const data = await request.json()
    
    if (!data.name) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      )
    }
    
    // Validate email if provided
    if (data.contactEmail && !isValidEmail(data.contactEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }
    
    const supplier = await prisma.supplier.upsert({
      where: {
        id: data.id || 'new',
      },
      update: {
        name: data.name,
        contactName: data.contactName || null,
        contactNumber: data.contactNumber || null,
        contactEmail: data.contactEmail || null,
      },
      create: {
        name: data.name,
        contactName: data.contactName || null,
        contactNumber: data.contactNumber || null,
        contactEmail: data.contactEmail || null,
      },
    })
    
    console.log(`Successfully processed supplier: ${supplier.name}`)
    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error processing supplier:', error)
    return NextResponse.json(
      { error: 'Failed to process supplier' },
      { status: 500 }
    )
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
} 