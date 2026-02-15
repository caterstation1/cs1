import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { RunsheetDocument } from '@/lib/pdf/runsheet-document'
import { fetchRunsheetData } from '@/lib/runsheet-data'
import { getAccessLevel } from '@/lib/authz'

export async function GET(request: NextRequest) {
  try {
    const access = await getAccessLevel()
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date') // YYYY-MM-DD
    const isWLG = searchParams.get('isWLG') === 'true'

    if (!dateStr) {
      return NextResponse.json({ error: 'date parameter required (YYYY-MM-DD)' }, { status: 400 })
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    console.log(`📄 Generating runsheet PDF for ${dateStr}, isWLG: ${isWLG}`)

    // Fetch runsheet data
    const data = await fetchRunsheetData(date, isWLG)

    // Generate PDF
    const doc = React.createElement(RunsheetDocument, { data })
    const pdfBuffer = await renderToBuffer(doc as any)

    // Return PDF (cast Buffer to BodyInit for Next 15 type expectations)
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="runsheet-${dateStr}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating runsheet PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate runsheet PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

