import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // TODO: Implement Firestore adapter for shifts
    // For now, return empty array to prevent 500 errors
    return NextResponse.json([])
  } catch (error) {
    console.error('Error fetching shifts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement Firestore adapter for shifts
    // For now, return a stub response
    return NextResponse.json({ 
      message: 'Shifts API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
      id: 'stub-id'
    })
  } catch (error) {
    console.error('Error creating shift:', error)
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
} 