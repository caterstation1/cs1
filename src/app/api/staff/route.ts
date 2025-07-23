import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // TODO: Implement Firestore adapter for staff
    // For now, return empty array to prevent 500 errors
    return NextResponse.json([], {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Error fetching staff:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement Firestore adapter for staff
    // For now, return a stub response
    return NextResponse.json({ 
      message: 'Staff API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
      id: 'stub-id'
    })
  } catch (error) {
    console.error('Failed to create staff:', error)
    return NextResponse.json(
      { error: 'Failed to create staff member' },
      { status: 500 }
    )
  }
} 