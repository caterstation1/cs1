import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement Firestore adapter for clock-out
    // For now, return a stub response
    return NextResponse.json({ 
      message: 'Clock-out API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
      id: 'stub-id',
      clockOut: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error clocking out:', error)
    return NextResponse.json(
      { error: 'Failed to clock out' },
      { status: 500 }
    )
  }
} 