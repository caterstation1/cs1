'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function FetchAllOrdersPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAllOrders = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('🚀 Starting bulk fetch...')
      const response = await fetch('/api/shopify/fetch-all-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          saveToDatabase: false
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setResult(data)
        console.log('✅ Bulk fetch completed:', data)
      } else {
        setError(data.error || 'Unknown error occurred')
        console.error('❌ Bulk fetch failed:', data)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Error during bulk fetch:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Fetch All Shopify Orders</h1>
      
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Important Notes</h2>
          <ul className="text-yellow-700 space-y-1">
            <li>• This will fetch ALL orders from Shopify (potentially 10,000+ orders)</li>
            <li>• The process may take several minutes due to API rate limits</li>
            <li>• Orders are fetched in batches of 250 per request</li>
            <li>• A 100ms delay is added between requests to respect Shopify&apos;s API</li>
            <li>• This is currently a test endpoint - orders are not saved to database</li>
          </ul>
        </div>

        <Button 
          onClick={fetchAllOrders}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-lg"
        >
          {isLoading ? '🔄 Fetching Orders...' : '🚀 Fetch All Orders'}
        </Button>

        {isLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">
              ⏳ Fetching all orders from Shopify... This may take several minutes.
              <br />
              Check the browser console for progress updates.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Success</h3>
            <div className="text-green-700 space-y-2">
              <p><strong>Message:</strong> {result.message}</p>
              <p><strong>Total Orders:</strong> {result.count}</p>
              <p><strong>Duration:</strong> {result.duration}</p>
            </div>
            
            {result.orders && result.orders.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Sample Orders (first 5):</h4>
                <div className="bg-white border rounded p-3 max-h-96 overflow-y-auto">
                  {result.orders.slice(0, 5).map((order: any, index: number) => (
                    <div key={index} className="border-b border-gray-200 py-2 last:border-b-0">
                      <p><strong>Order #{order.order_number}</strong></p>
                      <p className="text-sm text-gray-600">
                        Customer: {order.customer?.first_name} {order.customer?.last_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Date: {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Total: ${order.total_price}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
