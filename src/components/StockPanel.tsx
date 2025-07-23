'use client'

import { useState, useEffect, useMemo } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Calendar } from 'lucide-react'

interface ComponentRequirement {
  id: string
  name: string
  quantity: number
  unit: string
  totalCost: number
}

interface DailyComponentsResponse {
  date: string
  components: ComponentRequirement[]
  totalOrders: number
  totalProducts: number
  summary: {
    totalComponents: number
    totalQuantity: number
    totalCost: number
  }
}

interface StockPanelProps {
  className?: string
  showRefreshButton?: boolean
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
  targetDate?: Date // Date to show components for (defaults to today)
}

export function StockPanel({ 
  className = "", 
  showRefreshButton = true, 
  autoRefresh = false, 
  refreshInterval = 30000,
  targetDate
}: StockPanelProps) {
  // Use a stable default date to prevent infinite re-renders
  const defaultDate = useMemo(() => new Date(), [])
  const effectiveTargetDate = targetDate || defaultDate
  
  const [componentRequirements, setComponentRequirements] = useState<ComponentRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set())
  
  const fetchDailyComponents = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      // Fix timezone issue: use local date formatting instead of toISOString()
      const year = effectiveTargetDate.getFullYear()
      const month = String(effectiveTargetDate.getMonth() + 1).padStart(2, '0')
      const day = String(effectiveTargetDate.getDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}` // YYYY-MM-DD format
      
      console.log('📅 Fetching components for date:', dateString, '(selected date:', effectiveTargetDate.toDateString(), ')')
      
      const response = await fetch(`/api/daily-components?date=${dateString}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: DailyComponentsResponse = await response.json()
      
      console.log('📦 Daily components data:', data)
      
      setComponentRequirements(data.components || [])
    } catch (err) {
      console.error('❌ Error fetching daily components:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch daily components')
      setComponentRequirements([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchDailyComponents()
    // Reset completed items when date changes
    setCompletedItems(new Set())
  }, [effectiveTargetDate])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchDailyComponents(true)
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, effectiveTargetDate])

  const handleRefresh = () => {
    fetchDailyComponents(true)
  }

  const safeFormatDate = (date: Date | undefined | null) => {
    if (!date) return 'N/A';
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleItemClick = (componentId: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(componentId)) {
        newSet.delete(componentId)
      } else {
        newSet.add(componentId)
      }
      return newSet
    })
  }

  // Sort components: incomplete first, then completed
  const sortedComponents = [...componentRequirements].sort((a, b) => {
    const aCompleted = completedItems.has(a.id)
    const bCompleted = completedItems.has(b.id)
    
    if (aCompleted && !bCompleted) return 1
    if (!aCompleted && bCompleted) return -1
    return 0
  })

  return (
    <div className={`border rounded-lg bg-white ${className}`}>
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Daily Components</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-3 w-3" />
              <span>{safeFormatDate(effectiveTargetDate)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {refreshing && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                Refreshing...
              </div>
            )}
            {showRefreshButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="h-[400px]">
        {loading && componentRequirements.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading component requirements...
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-500">
              <p className="text-sm">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </div>
        ) : componentRequirements.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No components required</p>
              <p className="text-xs">No orders found for this date</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {sortedComponents.map((component) => {
                const isCompleted = completedItems.has(component.id)
                return (
                  <div 
                    key={component.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      isCompleted 
                        ? 'bg-gray-100 text-gray-500 border-gray-200' 
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                    onClick={() => handleItemClick(component.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        isCompleted 
                          ? 'bg-gray-400 border-gray-400' 
                          : 'border-gray-300'
                      }`}>
                        {isCompleted && (
                          <div className="w-full h-full bg-gray-400 rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isCompleted ? 'line-through' : ''}`}>
                          {component.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium text-sm ${isCompleted ? 'text-gray-400' : ''}`}>
                        {component.quantity}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
      
      {showRefreshButton && !loading && !error && (
        <div className="p-4 border-t">
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full"
            variant="outline"
          >
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Update Components
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
} 