"use client";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OrderCardList from '@/components/realtime-orders/order-card-list'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react'
import { Order } from '@/types/order'

interface NeedsReviewResponse {
  orders: Order[]
  pagination: {
    total: number
    page: number
    pageSize: number
    hasMore: boolean
  }
}

export default function NeedsReviewPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Get region from URL params or default to AKL
  const [region, setRegion] = useState<'AKL' | 'WLG'>('AKL')
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const regionParam = params.get('region')
    if (regionParam === 'AKL' || regionParam === 'WLG') {
      setRegion(regionParam)
    }
  }, [])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50

  const fetchNeedsReview = async (pageNum: number = 1) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/orders/needs-review?region=${region}&page=${pageNum}&pageSize=${pageSize}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data: NeedsReviewResponse = await response.json()
      setOrders(data.orders)
      setTotalCount(data.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
      console.error('Error fetching needs review orders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNeedsReview(page)
  }, [region, page])

  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>): Promise<Order> => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update order')
      const updatedOrder = await response.json()
      
      // Refresh the list
      fetchNeedsReview(page)
      
      return updatedOrder
    } catch (err) {
      console.error('Error updating order:', err)
      throw err
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              Orders Needing Review
            </h1>
            <p className="text-muted-foreground mt-2">
              Orders with unclear delivery dates that require manual scheduling
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Region:</label>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value as 'AKL' | 'WLG')
                  setPage(1)
                }}
                className="px-3 py-2 border rounded-md"
              >
                <option value="AKL">Auckland (AKL)</option>
                <option value="WLG">Wellington (WLG)</option>
              </select>
            </div>
            
            <Button
              onClick={() => fetchNeedsReview(page)}
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800">
            <strong>Total orders needing review:</strong> {totalCount} ({region})
          </p>
          <p className="text-xs text-orange-700 mt-1">
            These orders couldn't have their delivery dates automatically extracted. 
            Please review and set the delivery date manually.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No orders need review!</h2>
          <p className="text-muted-foreground">
            All orders have been successfully scheduled.
          </p>
        </div>
      ) : (
        <>
          <OrderCardList
            orders={orders}
            onUpdateOrder={handleUpdateOrder}
            onBulkUpdateComplete={() => fetchNeedsReview(page)}
            selectedDate={new Date()}
          />
          
          {totalCount > pageSize && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} orders
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= totalCount}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
