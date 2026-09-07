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
  const labelKeys = params.get('labelKeys') || ''
  const orderNumber = params.get('orderNumber') || ''
  if (!date && !orderNumber) {
    return (
      <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
        Missing date or order number. Open labels from the calendar, or use{' '}
        <code>/labels/print?orderNumber=12945</code>
      </div>
    )
  }
  return (
    <PrintLabelsClient
      date={date}
      orderIds={orderIds}
      labelKeys={labelKeys}
      orderNumber={orderNumber}
    />
  )
}


