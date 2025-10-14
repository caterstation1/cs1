import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all email settings
export async function GET() {
  try {
    const settings = await prisma.emailSetting.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching email settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email settings' },
      { status: 500 }
    )
  }
}

// POST create new email setting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, title, description, recipientEmail, isActive } = body

    if (!name || !title) {
      return NextResponse.json(
        { error: 'Name and title are required' },
        { status: 400 }
      )
    }

    const setting = await prisma.emailSetting.create({
      data: {
        name,
        title,
        description: description || null,
        recipientEmail,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ setting }, { status: 201 })
  } catch (error) {
    console.error('Error creating email setting:', error)
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Email setting with this name already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create email setting' },
      { status: 500 }
    )
  }
}

