'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PrintLabelsClient from './print-client'

export const dynamic = 'force-dynamic'

export default function PrintLabelsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Preparing...</div>}>
      <PrintLabelsPageInner />
    </Suspense>
  )
}

function PrintLabelsPageInner() {
  const params = useSearchParams()
  const date = params.get('date') || ''
  const orderIds = params.get('orderIds') || ''
  if (!date) return <div style={{ padding: 16, fontFamily: 'sans-serif' }}>Missing date. Please open labels from the calendar or provide a date param.</div>
  return <PrintLabelsClient date={date} orderIds={orderIds} />
}


