import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement Firestore adapter for clock-in
    // For now, return a stub response
    return NextResponse.json({ 
      message: 'Clock-in API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
      id: 'stub-id',
      clockIn: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error clocking in:', error)
    return NextResponse.json(
      { error: 'Failed to clock in' },
      { status: 500 }
    )
  }
} 