import { NextRequest, NextResponse } from 'next/server'
import { parseLocalDate } from '@/lib/date-utils'
import { fetchRunsheetData } from '@/lib/runsheet-data'
import { isWellingtonOrder } from '@/lib/region'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dateStr = url.searchParams.get('date') // YYYY-MM-DD
    const city = (url.searchParams.get('city') || 'AKL').toUpperCase() // AKL|WLG
    const remaining = (url.searchParams.get('remaining') || '1') === '1'

    if (!dateStr) {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
    }

    const date = parseLocalDate(dateStr) || new Date(dateStr)
    const isWLG = city === 'WLG'

    const data = await fetchRunsheetData(date, isWLG, remaining)

    // Return lean summary tailored for UI
    return NextResponse.json({
      date: data.date,
      orderCount: data.orderCount,
      boxesCount: data.boxesCount,
      servewareBoxes: data.servewareBoxes,
      tasksByCategory: data.tasksByCategory,
      addonsList: data.addonsList,
      proteinsByInitial: data.proteinsByInitial,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('runsheet summary error', e)
    return NextResponse.json({ error: 'Failed to build runsheet summary' }, { status: 500 })
  }
}

