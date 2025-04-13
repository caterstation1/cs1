"use client"

import { useState, useEffect } from "react"
import { OrderCardList } from "@/components/OrderCardList"
import { StockList } from "@/components/StockList"

export default function RealtimePage() {
  const [orders, setOrders] = useState([])
  const [stockItems, setStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [ordersResponse, stockResponse] = await Promise.all([
          fetch("/api/orders/realtime"),
          fetch("/api/stock")
        ])

        if (!ordersResponse.ok) {
          throw new Error("Failed to fetch orders")
        }
        if (!stockResponse.ok) {
          throw new Error("Failed to fetch stock items")
        }

        const [ordersData, stockData] = await Promise.all([
          ordersResponse.json(),
          stockResponse.json()
        ])

        setOrders(ordersData)
        setStockItems(stockData)
      } catch (err: any) {
        setError(err.message)
        console.error("Error fetching data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Set up polling to refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-screen">
      <div className="w-[88%] overflow-auto">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Realtime Orders</h1>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 p-4 border border-red-300 rounded-md">
              {error}
            </div>
          ) : (
            <OrderCardList orders={orders} />
          )}
        </div>
      </div>
      <div className="w-[12%] border-l">
        <StockList items={stockItems} />
      </div>
    </div>
  )
} 