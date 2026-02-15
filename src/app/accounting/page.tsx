'use client'

import { useState, useMemo, useEffect, ErrorInfo, Component } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { buildQuery } from '@/lib/use-accounting'
import SalesProfitTrend from '@/components/accounting/SalesProfitTrend'
import DeliveryProfitByZone from '@/components/accounting/DeliveryProfitByZone'
import CustomerCohorts from '@/components/accounting/CustomerCohorts'
import CogsDrivers from '@/components/accounting/CogsDrivers'
import LabourEfficiency from '@/components/accounting/LabourEfficiency'

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: React.ReactNode; componentName: string },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode; componentName: string }) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.componentName}] Error caught:`, error)
    console.error(`[ErrorBoundary:${this.props.componentName}] Error info:`, errorInfo)
    console.error(`[ErrorBoundary:${this.props.componentName}] Stack:`, error.stack)
    this.setState({ error, errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border p-4 text-red-600">
          <h3 className="font-semibold mb-2">Error in {this.props.componentName}</h3>
          <p className="text-sm mb-2">{this.state.error?.message || 'Unknown error'}</p>
          <details className="text-xs">
            <summary>Stack trace</summary>
            <pre className="mt-2 overflow-auto">{this.state.error?.stack}</pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

type RangePreset = '7D' | '30D' | '6M' | '12M' | 'YTD'

export default function AccountingPage() {
  // All hooks must be called before any conditional returns
  const { data: session, status } = useSession()
  const router = useRouter()
  const [range, setRange] = useState<RangePreset>('30D')
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [includeUnpaid, setIncludeUnpaid] = useState(false)
  const [useBusinessDate, setUseBusinessDate] = useState(true)

  // Use the same fallback pattern as dashboard to handle different session structures
  const access = (session as any)?.session?.user?.accessLevel || (session as any)?.user?.accessLevel || ''

  const commonParams = useMemo(
    () => {
      const params = { rangePreset: range, includeCancelled, includeUnpaid, useBusinessDate }
      console.log('[AccountingPage] commonParams updated:', params)
      return params
    },
    [range, includeCancelled, includeUnpaid, useBusinessDate]
  )

  // Add error logging
  useEffect(() => {
    console.log('[AccountingPage] Component mounted/updated')
    console.log('[AccountingPage] Session:', { status, hasSession: !!session, access })
    console.log('[AccountingPage] State:', { range, includeCancelled, includeUnpaid, useBusinessDate })
    
    // Global error handler
    const handleError = (event: ErrorEvent) => {
      console.error('[AccountingPage] Global error:', event.error)
      console.error('[AccountingPage] Error message:', event.message)
      console.error('[AccountingPage] Error filename:', event.filename)
      console.error('[AccountingPage] Error lineno:', event.lineno)
      console.error('[AccountingPage] Error colno:', event.colno)
    }
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[AccountingPage] Unhandled promise rejection:', event.reason)
    }
    
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [status, session, access, range, includeCancelled, includeUnpaid, useBusinessDate])
  const accessLower = String(access || '').toLowerCase()
  const allowed = accessLower === 'admin' || accessLower === 'owner' || accessLower === 'manager'

  // Wait for session to load before checking access
  if (status === 'loading') {
    return (
      <div className="max-w-[1000px] w-full mx-auto px-4 py-10">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // Basic/no-access handling (middleware also restricts, this is UI fallback)
  if (!allowed) {
    return (
      <div className="max-w-[1000px] w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-2">No access</h1>
        <p className="text-muted-foreground">This page is restricted to Owner/Admin.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1600px] w-full mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between py-3 gap-3">
            <div className="text-xl font-semibold">Accounting</div>
            <div className="flex items-center gap-2 text-sm">
              <div className="inline-flex rounded-md border overflow-hidden">
                {(['7D','30D','6M','12M','YTD'] as RangePreset[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 ${range === r ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={includeCancelled} onChange={e => setIncludeCancelled(e.target.checked)} />
                <span>Include cancelled</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={includeUnpaid} onChange={e => setIncludeUnpaid(e.target.checked)} />
                <span>Include unpaid</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={useBusinessDate} onChange={e => setUseBusinessDate(e.target.checked)} />
                <span>Business date</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] w-full mx-auto px-4 py-6 grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <ErrorBoundary componentName="SalesProfitTrend">
            <SalesProfitTrend params={commonParams} />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <ErrorBoundary componentName="DeliveryProfitByZone">
            <DeliveryProfitByZone params={commonParams} />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <ErrorBoundary componentName="CustomerCohorts">
            <CustomerCohorts params={commonParams} />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <ErrorBoundary componentName="CogsDrivers">
            <CogsDrivers params={commonParams} />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <ErrorBoundary componentName="LabourEfficiency">
            <LabourEfficiency params={commonParams} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

