'use client'

import { useState, useEffect } from 'react'

interface StockItem {
  id: number
  name: string
  quantity: number
  unit: string
}

export default function StockList() {
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Initial data fetch
  useEffect(() => {
    fetchStockItems()
  }, [])
  
  const fetchStockItems = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      
      // This is a placeholder for actual stock data fetching
      // In a real implementation, you would fetch from your API
      setStockItems([
        { id: 1, name: 'Chicken Breast', quantity: 15, unit: 'kg' },
        { id: 2, name: 'Rice', quantity: 25, unit: 'kg' },
        { id: 3, name: 'Tomatoes', quantity: 10, unit: 'kg' },
        { id: 4, name: 'Olive Oil', quantity: 5, unit: 'L' },
        { id: 5, name: 'Garlic', quantity: 2, unit: 'kg' },
      ])
      setLoading(false)
      setRefreshing(false)
    } catch (error) {
      console.error('Error fetching stock items:', error)
      setLoading(false)
      setRefreshing(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Stock Levels</h2>
        {refreshing && (
          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            Refreshing...
          </div>
        )}
      </div>
      
      {loading && stockItems.length === 0 ? (
        <div className="text-center py-4">Loading stock data...</div>
      ) : (
        <div className="space-y-3">
          {stockItems.map((item) => (
            <div key={item.id} className="flex justify-between items-center">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">{item.unit}</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs ${
                item.quantity > 10 ? 'bg-green-100 text-green-800' : 
                item.quantity > 5 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
              }`}>
                {item.quantity}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t">
        <button 
          onClick={() => fetchStockItems(true)}
          className="w-full py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          Update Stock
        </button>
      </div>
    </div>
  )
} 