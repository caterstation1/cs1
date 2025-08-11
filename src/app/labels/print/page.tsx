import { Suspense } from 'react'
import PrintLabelsClient from './print-client'

export const dynamic = 'force-dynamic'

export default function PrintLabelsPage({ searchParams }: any) {
  const date = (searchParams.date as string) || ''
  const orderIds = (searchParams.orderIds as string) || ''
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Preparing...</div>}>
      <PrintLabelsClient date={date} orderIds={orderIds} />
    </Suspense>
  )
}


