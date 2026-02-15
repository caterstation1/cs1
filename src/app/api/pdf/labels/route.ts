import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { LabelsDocument } from '@/lib/pdf/labels-document'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const access = await getAccessLevel()
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date') // YYYY-MM-DD
    const orderIds = searchParams.get('orderIds') // comma-separated

    if (!dateStr) {
      return NextResponse.json({ error: 'date parameter required (YYYY-MM-DD)' }, { status: 400 })
    }

    console.log(`🏷️ Generating labels PDF for ${dateStr}`)

    // Fetch labels data (reuse existing /api/labels logic)
    const labelsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/labels?date=${dateStr}${orderIds ? `&orderIds=${orderIds}` : ''}`, {
      headers: { 'Cookie': request.headers.get('cookie') || '' }
    })

    if (!labelsRes.ok) {
      throw new Error('Failed to fetch labels data')
    }

    const labelsData = await labelsRes.json()
    const labels = labelsData.labels || []

    if (labels.length === 0) {
      return NextResponse.json({ error: 'No labels found for this date' }, { status: 404 })
    }

    // Generate PDF
    const doc = React.createElement(LabelsDocument, { labels })
    const pdfBuffer = await renderToBuffer(doc as any)

    // Return PDF (cast Buffer to BodyInit for Next 15 type expectations)
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="labels-${dateStr}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating labels PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate labels PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

