'use client'

import RealtimeOrdersView from '@/components/realtime-orders/realtime-orders-view'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function RealtimeOrdersPage() {
  return (
    <ErrorBoundary>
      <RealtimeOrdersView />
    </ErrorBoundary>
  )
} 