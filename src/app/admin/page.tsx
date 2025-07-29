'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Database, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export default function AdminPage() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [initResult, setInitResult] = useState<any>(null)

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Initialization Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Initialize Data
            </CardTitle>
            <CardDescription>
              Sync all data from Shopify and initialize Firestore with custom data
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Status
            </CardTitle>
            <CardDescription>
              Check the current status of your Firestore database
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
                  <div className="text-xs text-gray-500 mt-2">
                    Last checked: {new Date(status.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>What This Does</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Initialize Data</strong> will:</p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Sync all products from Shopify to Firestore</li>
            <li>Create product records with custom data fields</li>
            <li>Apply any existing product rules to populate custom data</li>
            <li>Set up the foundation for your app to work properly</li>
          </ol>
          <p className="mt-4 text-gray-600">
            <strong>Note:</strong> This should only need to be run once after setting up Firestore, 
            or when you need to refresh all data from Shopify.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 