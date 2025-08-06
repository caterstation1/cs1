'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, DollarSign, TrendingUp, Users, MapPin, Clock, Package, Target } from 'lucide-react'
import DeliveryMap from '@/components/DeliveryMap'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears, isToday, isYesterday } from 'date-fns'

interface DashboardData {
  today: PeriodData
  yesterday: PeriodData
  weekToDate: PeriodData
  monthToDate: PeriodData
  yearToDate: PeriodData
  historicPeriod1: PeriodData
  historicPeriod2: PeriodData
  outTheDoorToday: OutTheDoorData
  outTheDoorTomorrow: OutTheDoorData
  staffClockedIn: StaffMember[]
  deliveryMap: DeliveryPoint[]
}

interface PeriodData {
  salesValue: number
  costOfSales: number
  totalGP: number
  gpPercentage: number
  staffCosts: number
  totalGPWithStaffing: number
  totalGPWithStaffingPercentage: number
  orderCount: number
}

interface OutTheDoorData {
  salesValue: number
  orderCount: number
  orders: any[]
}

interface StaffMember {
  id: string
  name: string
  clockInTime: string
  role: string
}

interface DeliveryPoint {
  orderNumber: string
  deliveryTime: string
  address: string
  coordinates: [number, number]
  salesValue: number
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard')
      if (!response.ok) throw new Error('Failed to fetch dashboard data')
      const data = await response.json()
      setDashboardData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FFF8E2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A0000] mx-auto"></div>
          <p className="mt-4 text-[#4A0000]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button 
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!dashboardData) return null

  return (
    <div className="min-h-screen bg-[#FFF8E2]">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#4A0000]">CaterStation Dashboard</h1>
            <p className="text-[#6B0000] mt-1">Real-time business insights and analytics</p>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-[#FF701F]" />
            <span className="text-sm text-[#4A0000]">
              {format(new Date(), 'EEEE, MMMM do, yyyy')}
            </span>
          </div>
        </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-[#4A0000] to-[#6B0000] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Sales Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.today.salesValue)}</div>
            <p className="text-xs opacity-75 mt-1">{dashboardData.today.orderCount} orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-[#FFB600] to-[#FFA000] text-[#4A0000]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Week to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.weekToDate.salesValue)}</div>
            <p className="text-xs opacity-75 mt-1">{dashboardData.weekToDate.orderCount} orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-[#FF701F] to-[#FF5A00] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Month to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.monthToDate.salesValue)}</div>
            <p className="text-xs opacity-75 mt-1">{dashboardData.monthToDate.orderCount} orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-[#00C2FF] to-[#0099CC] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Year to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.yearToDate.salesValue)}</div>
            <p className="text-xs opacity-75 mt-1">{dashboardData.yearToDate.orderCount} orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="today" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 bg-[#FFF8E2] border-[#FFB600]">
          <TabsTrigger value="today" className="data-[state=active]:bg-[#4A0000] data-[state=active]:text-white">Today</TabsTrigger>
          <TabsTrigger value="yesterday" className="data-[state=active]:bg-[#4A0000] data-[state=active]:text-white">Yesterday</TabsTrigger>
          <TabsTrigger value="week" className="data-[state=active]:bg-[#4A0000] data-[state=active]:text-white">Week to Date</TabsTrigger>
          <TabsTrigger value="month" className="data-[state=active]:bg-[#4A0000] data-[state=active]:text-white">Month to Date</TabsTrigger>
          <TabsTrigger value="year" className="data-[state=active]:bg-[#4A0000] data-[state=active]:text-white">Year to Date</TabsTrigger>
          <TabsTrigger value="historic" className="data-[state=active]:bg-[#4A0000] data-[state=active]:text-white">Historic</TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales & Profitability */}
            <Card>
              <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-[#FF701F]" />
                    Today&apos;s Performance
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Sales Value</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(dashboardData.today.salesValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Cost of Sales</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(dashboardData.today.costOfSales)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total GP</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(dashboardData.today.totalGP)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">GP %</p>
                    <p className="text-xl font-bold text-purple-600">
                      {formatPercentage(dashboardData.today.gpPercentage)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Out the Door Today */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Out the Door Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {formatCurrency(dashboardData.outTheDoorToday.salesValue)}
                </div>
                <p className="text-sm text-gray-600">
                  {dashboardData.outTheDoorToday.orderCount} orders being delivered today
                </p>
                <div className="mt-4 space-y-2">
                  {dashboardData.outTheDoorToday.orders.slice(0, 3).map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">#{order.orderNumber}</span>
                      <span className="text-sm text-gray-600">{order.deliveryTime}</span>
                      <span className="font-medium">{formatCurrency(order.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Yesterday Tab */}
        <TabsContent value="yesterday" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  Yesterday&apos;s Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Sales Value</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(dashboardData.yesterday.salesValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Cost of Sales</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(dashboardData.yesterday.costOfSales)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total GP</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(dashboardData.yesterday.totalGP)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">GP %</p>
                    <p className="text-xl font-bold text-purple-600">
                      {formatPercentage(dashboardData.yesterday.gpPercentage)}
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Staff Costs</p>
                      <p className="text-lg font-bold text-orange-600">
                        {formatCurrency(dashboardData.yesterday.staffCosts)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">GP % (with staffing)</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatPercentage(dashboardData.yesterday.totalGPWithStaffingPercentage)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Week to Date Tab */}
        <TabsContent value="week" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Week to Date Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Sales Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(dashboardData.weekToDate.salesValue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cost of Sales</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(dashboardData.weekToDate.costOfSales)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total GP</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(dashboardData.weekToDate.totalGP)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">GP %</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatPercentage(dashboardData.weekToDate.gpPercentage)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Staff Costs</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(dashboardData.weekToDate.staffCosts)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">GP % (with staffing)</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatPercentage(dashboardData.weekToDate.totalGPWithStaffingPercentage)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Month to Date Tab */}
        <TabsContent value="month" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Month to Date Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Sales Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(dashboardData.monthToDate.salesValue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cost of Sales</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(dashboardData.monthToDate.costOfSales)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total GP</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(dashboardData.monthToDate.totalGP)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">GP %</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatPercentage(dashboardData.monthToDate.gpPercentage)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Staff Costs</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(dashboardData.monthToDate.staffCosts)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">GP % (with staffing)</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatPercentage(dashboardData.monthToDate.totalGPWithStaffingPercentage)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Year to Date Tab */}
        <TabsContent value="year" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                Year to Date Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Sales Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(dashboardData.yearToDate.salesValue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cost of Sales</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(dashboardData.yearToDate.costOfSales)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total GP</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(dashboardData.yearToDate.totalGP)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">GP %</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatPercentage(dashboardData.yearToDate.gpPercentage)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Staff Costs</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(dashboardData.yearToDate.staffCosts)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">GP % (with staffing)</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatPercentage(dashboardData.yearToDate.totalGPWithStaffingPercentage)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historic Tab */}
        <TabsContent value="historic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Previous Period Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Previous Period</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Sales</p>
                        <p className="text-lg font-bold">{formatCurrency(dashboardData.historicPeriod1.salesValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">GP %</p>
                        <p className="text-lg font-bold">{formatPercentage(dashboardData.historicPeriod1.gpPercentage)}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Previous Year</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Sales</p>
                        <p className="text-lg font-bold">{formatCurrency(dashboardData.historicPeriod2.salesValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">GP %</p>
                        <p className="text-lg font-bold">{formatPercentage(dashboardData.historicPeriod2.gpPercentage)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  Tomorrow&apos;s Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {formatCurrency(dashboardData.outTheDoorTomorrow.salesValue)}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {dashboardData.outTheDoorTomorrow.orderCount} orders scheduled for tomorrow
                </p>
                <div className="space-y-2">
                  {dashboardData.outTheDoorTomorrow.orders.slice(0, 3).map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">#{order.orderNumber}</span>
                      <span className="text-sm text-gray-600">{order.deliveryTime}</span>
                      <span className="font-medium">{formatCurrency(order.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Staff and Map Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Clocked In */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Staff Clocked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.staffClockedIn.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.staffClockedIn.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium">{staff.name}</p>
                      <p className="text-sm text-gray-600">{staff.role}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Clocked In
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{staff.clockInTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No staff currently clocked in</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interactive Delivery Map */}
        <DeliveryMap deliveryPoints={dashboardData.deliveryMap} />
      </div>
      </div>
    </div>
  )
} 