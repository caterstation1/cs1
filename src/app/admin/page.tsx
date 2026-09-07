'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Database, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export default function AdminPage() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [initResult, setInitResult] = useState<any>(null)
  const [normalizationStatus, setNormalizationStatus] = useState<any>(null)
  const [normalizationLoading, setNormalizationLoading] = useState(false)
  const [privatePassRunning, setPrivatePassRunning] = useState(false)
  const [privatePassResult, setPrivatePassResult] = useState<any>(null)
  const [metricsRefreshing, setMetricsRefreshing] = useState(false)
  const [metricsResult, setMetricsResult] = useState<any>(null)

  const initializeData = async () => {
    setIsInitializing(true)
    setInitResult(null)
    
    try {
      const response = await fetch('/api/initialize-data', {
        method: 'POST'
      })
      
      const result = await response.json()
      setInitResult(result)
      
      if (result.success) {
        // Refresh status after initialization
        checkStatus()
      }
    } catch (error) {
      console.error('Error initializing data:', error)
      setInitResult({
        success: false,
        error: 'Failed to initialize data',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsInitializing(false)
    }
  }

  const checkStatus = async () => {
    setIsCheckingStatus(true)
    
    try {
      // Check products
      const productsResponse = await fetch('/api/products-with-custom-data')
      const productsData = await productsResponse.json()
      
      // Check orders
      const ordersResponse = await fetch('/api/orders')
      const ordersData = await ordersResponse.json()
      
      // Check rules
      const rulesResponse = await fetch('/api/product-rules')
      const rulesData = await rulesResponse.json()
      
      setStatus({
        products: productsData.success ? productsData.products?.length || 0 : 'Error',
        orders: ordersData.success ? ordersData.orders?.length || 0 : 'Error',
        rules: rulesData.success ? rulesData.rules?.length || 0 : 'Error',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error checking status:', error)
      setStatus({
        error: 'Failed to check status',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const checkNormalizationStatus = async () => {
    setNormalizationLoading(true)
    try {
      const response = await fetch('/api/admin/company-normalization/status')
      const data = await response.json()
      setNormalizationStatus(data)
    } catch (error) {
      setNormalizationStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch status',
      })
    } finally {
      setNormalizationLoading(false)
    }
  }

  const runPrivatePass = async () => {
    setPrivatePassRunning(true)
    setPrivatePassResult(null)
    try {
      let batch = 1
      let aggregate = { processed: 0, privateAssigned: 0, skipped: 0, failed: 0 }
      while (true) {
        const response = await fetch(`/api/admin/backfill-private-customers?batch=${batch}&take=300`, {
          method: 'POST',
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Private pass batch failed')
        }
        aggregate = {
          processed: aggregate.processed + Number(data.processed || 0),
          privateAssigned: aggregate.privateAssigned + Number(data.privateAssigned || 0),
          skipped: aggregate.skipped + Number(data.skipped || 0),
          failed: aggregate.failed + Number(data.failed || 0),
        }
        if (!data.hasMore) break
        batch = Number(data.nextBatch || batch + 1)
      }
      setPrivatePassResult({ success: true, ...aggregate })
      await checkNormalizationStatus()
    } catch (error) {
      setPrivatePassResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed private pass',
      })
    } finally {
      setPrivatePassRunning(false)
    }
  }

  const runMetricsRefresh = async () => {
    setMetricsRefreshing(true)
    setMetricsResult(null)
    try {
      const response = await fetch('/api/admin/company-metrics/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full: true }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Metrics refresh failed')
      setMetricsResult({ success: true, ...data })
      await checkNormalizationStatus()
    } catch (error) {
      setMetricsResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed metrics refresh',
      })
    } finally {
      setMetricsRefreshing(false)
    }
  }

  return (
    <div className="container mx-auto min-h-screen bg-slate-800 text-slate-50 p-6 space-y-6 rounded-lg">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-500 bg-slate-700/90 text-slate-50 shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle>Company Normalization (Temporary)</CardTitle>
            <CardDescription>
              Run Step 2/3 online and check live progress while away from local terminal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={checkNormalizationStatus} variant="outline" disabled={normalizationLoading}>
                {normalizationLoading ? 'Checking…' : 'Check progress'}
              </Button>
              <Button onClick={runPrivatePass} disabled={privatePassRunning}>
                {privatePassRunning ? 'Running Step 2…' : 'Run Step 2: Private customer assignment'}
              </Button>
              <Button onClick={runMetricsRefresh} variant="outline" disabled={metricsRefreshing}>
                {metricsRefreshing ? 'Running Step 3…' : 'Run Step 3: Refresh metrics'}
              </Button>
            </div>

            {normalizationStatus?.success ? (
              <div className="rounded border border-slate-600 p-3 text-sm space-y-1">
                <div>
                  Step 1 (parsing): {normalizationStatus.progress?.step1?.processed ?? 0}/
                  {normalizationStatus.progress?.step1?.total ?? 0} (
                  {normalizationStatus.progress?.step1?.pct ?? 0}%)
                </div>
                <div>
                  Step 2 (private): {normalizationStatus.progress?.step2?.processed ?? 0}/
                  {normalizationStatus.progress?.step2?.total ?? 0} (
                  {normalizationStatus.progress?.step2?.pct ?? 0}%)
                </div>
                <div>
                  Step 3 (metrics): company rows {normalizationStatus.progress?.step3?.companyRows ?? 0}, customer rows{' '}
                  {normalizationStatus.progress?.step3?.customerRows ?? 0}
                </div>
                <div>Pending reviews: {normalizationStatus.pendingReviews ?? 0}</div>
              </div>
            ) : null}

            {privatePassResult ? (
              <div className="rounded border border-slate-600 p-3 text-xs">
                {privatePassResult.success
                  ? `Step 2 done: processed ${privatePassResult.processed}, private ${privatePassResult.privateAssigned}, skipped ${privatePassResult.skipped}, failed ${privatePassResult.failed}`
                  : `Step 2 error: ${privatePassResult.error}`}
              </div>
            ) : null}

            {metricsResult ? (
              <div className="rounded border border-slate-600 p-3 text-xs">
                {metricsResult.success
                  ? `Step 3 done: company rows ${metricsResult.refreshedCompanyRows ?? 0}, customer rows ${metricsResult.refreshedCustomerRows ?? 0}`
                  : `Step 3 error: ${metricsResult.error}`}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-500 bg-slate-700/90 text-slate-50 shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle>Company Normalization</CardTitle>
            <CardDescription>
              Review low-confidence company matches before finalizing merges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/company-matches">Open company review queue</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-500 bg-slate-700/90 text-slate-50 shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle>Customer Lifecycle + Rewards (MVP)</CardTitle>
            <CardDescription>
              Manual-first lifecycle queue, preview/test send, approve send, and reward issue tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/customer-lifecycle">Open customer lifecycle admin</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Data Initialization Card */}
        <Card className="border-slate-500 bg-slate-700/90 text-slate-50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Initialize Data
            </CardTitle>
            <CardDescription>
              Sync all data from Shopify and initialize PostgreSQL (Prisma/Railway) records with custom data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={initializeData} 
              disabled={isInitializing}
              className="w-full"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Initialize All Data'
              )}
            </Button>
            
            {initResult && (
              <div className={`p-3 rounded-md ${
                initResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {initResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">
                    {initResult.success ? 'Success' : 'Error'}
                  </span>
                </div>
                <p className="text-sm mt-1">{initResult.message || initResult.error}</p>
                {initResult.summary && (
                  <div className="text-xs mt-2 space-y-1">
                    <div>Shopify Products: {initResult.summary.shopifyProducts}</div>
                    <div>Total in Firestore: {initResult.summary.totalProductsInFirestore}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Check Card */}
        <Card className="border-slate-500 bg-slate-700/90 text-slate-50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Status
            </CardTitle>
            <CardDescription>
              Check the current status of your PostgreSQL database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={checkStatus} 
              disabled={isCheckingStatus}
              variant="outline"
              className="w-full"
            >
              {isCheckingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check Status'
              )}
            </Button>
            
            {status && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Products:</span>
                  <span className="font-medium">{status.products}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Orders:</span>
                  <span className="font-medium">{status.orders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Rules:</span>
                  <span className="font-medium">{status.rules}</span>
                </div>
                {status.timestamp && (
                  <div className="text-xs text-slate-300 mt-2">
                    Last checked: {new Date(status.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="border-slate-500 bg-slate-700/90 text-slate-50 shadow-sm">
        <CardHeader>
          <CardTitle>What This Does</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Initialize Data</strong> will:</p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Sync all products from Shopify to PostgreSQL</li>
            <li>Create product records with custom data fields</li>
            <li>Apply any existing product rules to populate custom data</li>
            <li>Set up the foundation for your app to work properly</li>
          </ol>
          <p className="mt-4 text-slate-200">
            <strong>Note:</strong> This should only need to be run once after setting up Prisma/Railway, 
            or when you need to refresh all data from Shopify.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 