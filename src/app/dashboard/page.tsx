'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useCachedFetch } from '@/lib/use-cached-fetch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, DollarSign, TrendingUp, Users, MapPin, Clock, Package, Target } from 'lucide-react'
import DeliveryMap from '@/components/DeliveryMap'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears, isToday, isYesterday } from 'date-fns'
import AdminSDashboard from '@/components/dashboard/AdminSDashboard'
import BasicDashboard from '@/components/dashboard/BasicDashboard'
import { IngredientSelector } from '@/components/IngredientSelector'
import HistoricPanel from './_components/HistoricPanel'

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

// Lightweight sparkline component (no external deps)
function Sparkline({ data }: { data: { date: string; sales28: number }[] }) {
  const width = 800
  const height = 200
  const pad = 2
  if (!data || data.length === 0) return <div className="text-sm text-gray-500">No data</div>

  // Extract values
  const values = data.map(d => Number(d.sales28 || 0))
  const seriesMax = Math.max(...values)
  const seriesMin = Math.min(...values)

  // Horizontal reference markers (in thousands) and target
  const MARKERS_K = [100, 150, 200]
  const TARGET_K = 160
  const markerValues = MARKERS_K.map(k => k * 1000)
  const targetValue = TARGET_K * 1000

  // Expand domain to include marker and target lines so they always render
  const domainMin = Math.min(seriesMin, ...markerValues, targetValue)
  const domainMax = Math.max(seriesMax, ...markerValues, targetValue)
  const domainRange = domainMax - domainMin === 0 ? 1 : domainMax - domainMin

  // Map y with expanded domain
  const step = (width - pad * 2) / Math.max(1, data.length - 1)
  const toY = (value: number) => pad + (height - pad * 2) * (1 - (value - domainMin) / domainRange)

  const pts = data.map((d, i) => {
    const x = pad + i * step
    const y = toY(Number(d.sales28 || 0))
    return { x, y }
  })
  const points = pts.map(p => `${p.x},${p.y}`).join(' ')

  // Determine the x-position for the vertical marker 12 months ago
  const twelveMonthsAgoStr = format(subMonths(new Date(), 12), 'yyyy-MM-dd')
  let twelveIndex = data.findIndex(d => d.date >= twelveMonthsAgoStr)
  if (twelveIndex < 0) twelveIndex = 0
  const twelveX = pad + twelveIndex * step

  // Helpers for year-based features
  const getIndexForDate = (dateStr: string) => {
    let idx = data.findIndex(d => d.date === dateStr)
    if (idx < 0) {
      idx = data.findIndex(d => d.date >= dateStr)
    }
    if (idx < 0) idx = data.length - 1
    return Math.max(0, Math.min(data.length - 1, idx))
  }
  const firstYear = Number((data[0]?.date || '2000-01-01').slice(0, 4))
  const lastYear = Number((data[data.length - 1]?.date || '2000-01-01').slice(0, 4))
  const janLines = []
  for (let y = firstYear; y <= lastYear; y++) {
    const idx = getIndexForDate(`${y}-01-01`)
    janLines.push({ year: y, x: pad + idx * step, idx })
  }

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const currency = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n)

  // Fix hover mapping by accounting for SVG scale relative to viewBox
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const relX = e.clientX - rect.left
    const scaleX = rect.width / width
    const leftPadPx = pad * scaleX
    const stepPx = step * scaleX
    const i = Math.round((relX - leftPadPx) / stepPx)
    const clamped = Math.max(0, Math.min(data.length - 1, i))
    setHoverIndex(clamped)
  }

  const handleLeave = () => setHoverIndex(null)

  // Build markers for the hovered date across all year segments (same MM-DD each year)
  const marker = hoverIndex != null ? pts[hoverIndex] : null
  const markerLeftPct = marker ? (marker.x / width) * 100 : 0
  const multiYearMarkers: { idx: number; x: number; y: number; date: string }[] = []
  if (hoverIndex != null) {
    const hoveredDate = data[hoverIndex].date
    const mmdd = hoveredDate.slice(5) // MM-DD
    for (let y = firstYear; y <= lastYear; y++) {
      const target = `${String(y).padStart(4, '0')}-${mmdd}`
      const idx = getIndexForDate(target)
      multiYearMarkers.push({
        idx,
        x: pad + idx * step,
        y: toY(Number(data[idx]?.sales28 || 0)),
        date: data[idx]?.date || target,
      })
    }
  }

  return (
    <div className="relative w-full h-[200px]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[200px]"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        preserveAspectRatio="none"
      >
        {/* Year dividers: every 1st Jan */}
        {janLines.map((j) => (
          <g key={`jan-${j.year}`}>
            <line x1={j.x} y1={pad} x2={j.x} y2={height - pad} stroke="#e2e8f0" strokeDasharray="2 2" />
            <text x={Math.min(width - 24, Math.max(pad + 2, j.x + 4))} y={height - 6} fontSize="10" fill="#6b7280">
              {String(j.year)}
            </text>
          </g>
        ))}

        {/* Grid markers */}
        {markerValues.map((mv) => {
          const y = toY(mv)
          return (
            <g key={`marker-${mv}`}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#e5e7eb" strokeDasharray="2 4" />
              <text x={pad + 6} y={y - 4} fontSize="10" fill="#6b7280">{`${Math.round(mv / 1000)}k`}</text>
            </g>
          )
        })}

        {/* Target line */}
        {(() => {
          const y = toY(targetValue)
          return (
            <g>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#a855f7" strokeDasharray="6 4" />
            </g>
          )
        })()}

        {/* Data line */}
        <polyline fill="none" stroke="#10b981" strokeWidth="2" points={points} />

        {/* 12 months ago vertical marker */}
        <g>
          <line x1={twelveX} y1={pad} x2={twelveX} y2={height - pad} stroke="#ef4444" strokeDasharray="4 2" />
          <text
            x={Math.min(width - 48, Math.max(pad + 2, twelveX + 4))}
            y={12}
            fontSize="10"
            fill="#ef4444"
          >
            12m ago
          </text>
        </g>

        {/* Hover markers across all year segments */}
        {multiYearMarkers.map((m, i) => {
          const isHoveredYear = hoverIndex != null && m.idx === hoverIndex
          const stroke = isHoveredYear ? '#94a3b8' : '#60a5fa'
          const radius = isHoveredYear ? 3.5 : 3
          const fill = isHoveredYear ? '#10b981' : '#60a5fa'
          return (
            <g key={`multi-${i}`}>
              <line x1={m.x} y1={pad} x2={m.x} y2={height - pad} stroke={stroke} strokeDasharray="4 4" />
              <circle cx={m.x} cy={m.y} r={radius} fill={fill} stroke="#ffffff" strokeWidth="1" />
            </g>
          )
        })}
      </svg>
      {hoverIndex != null && marker && (
        <div
          className="absolute top-2 text-xs bg-white border border-gray-200 shadow-sm rounded px-2 py-1 pointer-events-none"
          style={{ left: `calc(${markerLeftPct}% - 60px)` }}
        >
          <div className="font-medium text-black">{data[hoverIndex].date}</div>
          <div className="text-green-700">{currency(Number(data[hoverIndex].sales28 || 0))}</div>
        </div>
      )}
      {hoverIndex != null &&
        multiYearMarkers
          .filter(m => m.idx !== hoverIndex)
          .map((m, i) => {
            const leftPct = (m.x / width) * 100
            return (
              <div
                key={`tip-${i}`}
                className="absolute text-xs bg-white border border-gray-200 shadow-sm rounded px-2 py-1 pointer-events-none"
                style={{ top: `${10 + i * 18}px`, left: `calc(${leftPct}% - 60px)` }}
              >
                <div className="font-medium text-black">{m.date}</div>
                <div className="text-blue-700">{currency(Number(data[m.idx]?.sales28 || 0))}</div>
              </div>
            )
          })}
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const access = (session as any)?.session?.user?.accessLevel || (session as any)?.user?.accessLevel || ''
  const accessLower = String(access || '').toLowerCase()
  const [ownerView, setOwnerView] = useState<'owner'|'adminS'|'basic'>('owner')
  
  // Use cached fetch for dashboard data
  const { 
    data: dashboardData, 
    loading, 
    error, 
    refresh: refreshDashboard,
    lastFetch: dashboardLastFetch 
  } = useCachedFetch<DashboardData>(
    (accessLower === 'owner' || accessLower === 'admin') ? '/api/dashboard' : null,
    { key: 'dashboard', ttl: 120000 } // 2 minutes cache
  )
  const [rollingSeries, setRollingSeries] = useState<{ date: string; sales28: number }[]>([])
  const [longSeries, setLongSeries] = useState<{ date: string; sales28: number }[]>([])
  const [mapDate, setMapDate] = useState<string>(() => {
    const d = new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
  })
  const [mapPoints, setMapPoints] = useState<{ orderId?: string; orderNumber: string; deliveryTime: string; address: string; coordinates: [number, number]; salesValue: number }[]>([])
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [isCostsModalOpen, setIsCostsModalOpen] = useState(false)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [costItems, setCostItems] = useState<Array<{ orderNumber: number; sku: string; variantId: string | null; name: string; quantity: number; unitCost: number; lineCost: number; productTitle?: string; variantTitle?: string }>>([])
  const [staffItems, setStaffItems] = useState<Array<{ staffId: string; name: string; payRate: number; totalHours: number; totalCost: number; shifts: Array<{ id: string; date: string; clockIn: string | null; clockOut: string | null; hours: number; cost: number; notes: string | null }> }>>([])
  const [costsPeriod, setCostsPeriod] = useState<'today'|'yesterday'|'week'|'month'|'year'>('today')
  const [staffPeriod, setStaffPeriod] = useState<'today'|'yesterday'|'week'|'month'|'year'>('yesterday')
  const [variantDetail, setVariantDetail] = useState<any | null>(null)
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false)
  const [isAddBaseOpen, setIsAddBaseOpen] = useState(false)
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false)
  const [pendingBaseIngredients, setPendingBaseIngredients] = useState<any[]>([])
  const [pendingVariantIngredients, setPendingVariantIngredients] = useState<any[]>([])
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false)
  const [ordersPeriod, setOrdersPeriod] = useState<'today'|'yesterday'|'week'|'month'|'year'>('yesterday')
  const [ordersList, setOrdersList] = useState<Array<{ orderNumber: number; deliveryTime: string | null; salesExGst: number; gst: number; salesIncGst: number }>>([])

  const addToBase = async () => {
    if (!variantDetail?.productId) return
    try {
      const base = Array.isArray(variantDetail.baseIngredients) ? [...variantDetail.baseIngredients] : []
      const payload = { baseIngredients: [...base, ...pendingBaseIngredients] }
      const res = await fetch(`/api/products/${encodeURIComponent(variantDetail.productId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to update base ingredients')
      await fetch('/api/products/recalculate-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variantDetail.variantId })
      })
      await openVariantDetail(variantDetail.variantId)
      setPendingBaseIngredients([])
      setIsAddBaseOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  const addToVariant = async () => {
    if (!variantDetail?.variantId) return
    try {
      const ings = Array.isArray(variantDetail?.ingredients) ? [...(variantDetail.ingredients as any[])] : []
      const res = await fetch(`/api/products/variant/${encodeURIComponent(variantDetail.variantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: [...ings, ...pendingVariantIngredients] })
      })
      if (!res.ok) throw new Error('Failed to update variant ingredients')
      await fetch('/api/products/recalculate-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variantDetail.variantId })
      })
      await openVariantDetail(variantDetail.variantId)
      setPendingVariantIngredients([])
      setIsAddVariantOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    const privileged = accessLower === 'owner' || accessLower === 'admin'
    if (privileged) {
      // Only fetch analytics for admin/owner
      // Dashboard data is auto-fetched by useCachedFetch
      fetchRollingSeries()
      fetchLongSeries()
      fetchDeliveriesMap(mapDate)
    }
    try {
      const url = new URL(window.location.href)
      const v = url.searchParams.get('view')
      const saved = localStorage.getItem('owner-dashboard-view')
      const initial = (v || saved || 'owner') as 'owner'|'adminS'|'basic'
      if (accessLower === 'owner') setOwnerView(initial)
    } catch {}
  // Re-run if role changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLower])

  useEffect(() => {
    const privileged = accessLower === 'owner' || accessLower === 'admin'
    if (privileged) {
      fetchDeliveriesMap(mapDate)
    }
  }, [mapDate, accessLower])

  // Dashboard data is now handled by useCachedFetch
  const fetchDashboardData = refreshDashboard

  const fetchRollingSeries = async () => {
    try {
      // Approx 24 months (2 years) of daily points for the rolling 28-day totals
      const res = await fetch('/api/dashboard/rolling-sales?days=730&window=28')
      if (!res.ok) return
      const data = await res.json()
      setRollingSeries(Array.isArray(data.series) ? data.series : [])
    } catch {}
  }

  const fetchLongSeries = async () => {
    try {
      // ~3.5 years of daily points
      const res = await fetch('/api/dashboard/rolling-sales?days=1280&window=28')
      if (!res.ok) return
      const data = await res.json()
      setLongSeries(Array.isArray(data.series) ? data.series : [])
    } catch {}
  }

  const fetchDeliveriesMap = async (dateStr: string) => {
    try {
      const res = await fetch(`/api/dashboard/deliveries-map?date=${encodeURIComponent(dateStr)}&region=auckland`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setMapPoints(Array.isArray(data.points) ? data.points : [])
    } catch {}
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

  const fetchCostBreakdown = async (period: 'today'|'yesterday'|'week'|'month'|'year') => {
    try {
      const res = await fetch(`/api/dashboard/cost-breakdown?period=${period}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load cost breakdown')
      const data = await res.json()
      setCostItems(Array.isArray(data.items) ? data.items : [])
      setCostsPeriod(period)
      setIsCostsModalOpen(true)
    } catch (e) {
      console.error(e)
      setCostItems([])
      setIsCostsModalOpen(true)
    }
  }

  const fetchOrdersList = async (period: 'today'|'yesterday'|'week'|'month'|'year') => {
    try {
      const res = await fetch(`/api/dashboard/orders?period=${period}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load orders list')
      const data = await res.json()
      const rows = Array.isArray(data.orders) ? data.orders : []
      setOrdersList(rows.map((r: any) => ({
        orderNumber: Number(r.orderNumber),
        deliveryTime: r.deliveryTime || null,
        salesExGst: Number(r.salesExGst || 0),
        gst: Number(r.gst || 0),
        salesIncGst: Number(r.salesIncGst || 0),
      })))
      setOrdersPeriod(period)
      setIsOrdersModalOpen(true)
    } catch (e) {
      console.error(e)
      setOrdersList([])
      setOrdersPeriod(period)
      setIsOrdersModalOpen(true)
    }
  }

  const fetchStaffBreakdown = async (period: 'today'|'yesterday'|'week'|'month'|'year') => {
    try {
      const res = await fetch(`/api/dashboard/staff-breakdown?period=${period}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load staff breakdown')
      const data = await res.json()
      setStaffItems(Array.isArray(data.staff) ? data.staff : [])
      setStaffPeriod(period)
      setIsStaffModalOpen(true)
    } catch (e) {
      console.error(e)
      setStaffItems([])
      setIsStaffModalOpen(true)
    }
  }

  const openVariantDetail = async (variantId: string | null) => {
    if (!variantId) return
    try {
      const res = await fetch(`/api/products/variant/${encodeURIComponent(variantId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load variant')
      const data = await res.json()
      setVariantDetail(data)
      setIsVariantModalOpen(true)
    } catch (e) {
      console.error(e)
      setVariantDetail(null)
    }
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

  if (error && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button 
            onClick={() => refreshDashboard()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // For non-admin/owner roles, show Basic dashboard even without analytics data
  if (!dashboardData && !(String(access || '').toLowerCase() === 'owner' || String(access || '').toLowerCase() === 'admin')) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <div className="w-full max-w-none px-4 py-0 space-y-4">
          <BasicDashboard />
        </div>
      </div>
    )
  }

  // Show loading state only if we have no cached data and are loading
  if (!dashboardData && loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Loading dashboard...</div>
          <div className="text-sm text-slate-400">Fetching latest data</div>
        </div>
      </div>
    )
  }
  
  // If no data and not loading, show error or basic dashboard
  if (!dashboardData) {
    if (error) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg mb-2 text-red-400">{error}</div>
            <button
              onClick={() => refreshDashboard()}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return null
  }

  const OwnerContent = (
    <div className="w-full max-w-none px-0 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">CaterStation Dashboard</h1>
            <p className="text-slate-400 mt-1">Real-time business insights and analytics</p>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            <span className="text-sm text-slate-300">
              {format(new Date(), 'EEEE, MMMM do, yyyy')}
            </span>
          </div>
        </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800 text-slate-100 border border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Sales — Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(dashboardData.today.salesValue)}</div>
            <p className="text-xs opacity-70 mt-1">{dashboardData.today.orderCount} orders</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 text-slate-100 border border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Sales — Week to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(dashboardData.weekToDate.salesValue)}</div>
            <p className="text-xs opacity-70 mt-1">{dashboardData.weekToDate.orderCount} orders</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 text-slate-100 border border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Month to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(dashboardData.monthToDate.salesValue)}</div>
            <p className="text-xs opacity-70 mt-1">{dashboardData.monthToDate.orderCount} orders</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 text-slate-100 border border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Year to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(dashboardData.yearToDate.salesValue)}</div>
            <p className="text-xs opacity-70 mt-1">{dashboardData.yearToDate.orderCount} orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Rolling 28-day Sales Trend (hidden on mobile to save space) */}
      <div className="hidden sm:block">
        <Sparkline data={rollingSeries} />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="today" className="space-y-6">
        <TabsList className="flex flex-wrap gap-2 bg-transparent">
          <TabsTrigger value="today" className="px-4 py-1.5 rounded-full text-slate-200 hover:bg-slate-800 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow">Today</TabsTrigger>
          <TabsTrigger value="yesterday" className="px-4 py-1.5 rounded-full text-slate-200 hover:bg-slate-800 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow">Yesterday</TabsTrigger>
          <TabsTrigger value="week" className="px-4 py-1.5 rounded-full text-slate-200 hover:bg-slate-800 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow">Week to Date</TabsTrigger>
          <TabsTrigger value="month" className="px-4 py-1.5 rounded-full text-slate-200 hover:bg-slate-800 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow">Month to Date</TabsTrigger>
          <TabsTrigger value="year" className="px-4 py-1.5 rounded-full text-slate-200 hover:bg-slate-800 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow">Year to Date</TabsTrigger>
          <TabsTrigger value="historic" className="px-4 py-1.5 rounded-full text-slate-200 hover:bg-slate-800 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow">Historic</TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales & Profitability */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-[#FF701F]" />
                    Sales — Today
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-slate-400">Based on order creation date (Sales)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Sales Value</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(dashboardData.today.salesValue)}
                    </p>
                  </div>
                  <div onClick={() => fetchCostBreakdown('today')} className="cursor-pointer">
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
                  Out‑of‑Door — Yesterday
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-slate-400">Based on delivery date (Out‑of‑Door). Staff costs included for the day.</div>
                <div className="grid grid-cols-2 gap-4">
                  <div onClick={() => fetchOrdersList('yesterday')} className="cursor-pointer">
                    <p className="text-sm text-gray-600">Out‑of‑Door Value</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(dashboardData.yesterday.salesValue)}
                    </p>
                  </div>
                  <div onClick={() => fetchCostBreakdown('yesterday')} className="cursor-pointer">
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
                    <div onClick={() => fetchStaffBreakdown('yesterday')} className="cursor-pointer">
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
                  <div className="mt-3">
                    <p className="text-sm text-gray-600">Total GP (with staff costs)</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(dashboardData.yesterday.totalGPWithStaffing)}
                    </p>
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
                <div onClick={() => fetchCostBreakdown('week')} className="cursor-pointer">
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
                <div onClick={() => fetchStaffBreakdown('week')} className="cursor-pointer">
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
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Total GP (with staff costs)</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(dashboardData.weekToDate.totalGPWithStaffing)}
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
                <div onClick={() => fetchCostBreakdown('month')} className="cursor-pointer">
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
                <div onClick={() => fetchStaffBreakdown('month')} className="cursor-pointer">
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
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Total GP (with staff costs)</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(dashboardData.monthToDate.totalGPWithStaffing)}
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
                <div onClick={() => fetchCostBreakdown('year')} className="cursor-pointer">
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
                <div onClick={() => fetchStaffBreakdown('year')} className="cursor-pointer">
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
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Total GP (with staff costs)</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(dashboardData.yearToDate.totalGPWithStaffing)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historic Tab */}
        <TabsContent value="historic" className="space-y-6">
          <HistoricPanel />
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

        {/* Interactive Delivery Map (hide on mobile) */}
        <div className="hidden sm:block">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Map Date</label>
              <input
                type="date"
                value={mapDate}
                onChange={(e)=>setMapDate(e.target.value)}
                className="bg-slate-800 text-slate-100 border border-slate-700 rounded px-2 py-1 text-xs"
              />
            </div>
            <button
              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
              onClick={()=>setIsMapModalOpen(true)}
            >
              Expand Map
            </button>
          </div>
          <DeliveryMap deliveryPoints={mapPoints} allowAssignDriver />
        </div>
      </div>

      {/* Fullscreen-ish Map Modal */}
      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent className="sm:max-w-[80vw]">
          <DialogHeader>
            <DialogTitle>Deliveries Map — {mapDate}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {(() => {
              const modalH = (typeof window !== 'undefined' && window.innerHeight) ? Math.round(window.innerHeight * 0.8) : 600
              const listH = Math.round(modalH * 0.25)
              return (
                <DeliveryMap
                  deliveryPoints={mapPoints}
                  heightPx={modalH}
                  listHeightPx={listH}
                  allowAssignDriver
                />
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cost of Sales Breakdown Modal */}
      <Dialog open={isCostsModalOpen} onOpenChange={setIsCostsModalOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Cost of Sales — {costsPeriod[0].toUpperCase() + costsPeriod.slice(1)}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-400 border-b pb-2">
              <div className="col-span-2">Order</div>
              <div className="col-span-4">Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Cost</div>
              <div className="col-span-2 text-right">Line Cost</div>
            </div>
            {costItems.map((it, idx) => (
              <div key={`${it.orderNumber}-${it.sku}-${idx}`} className="grid grid-cols-12 gap-2 py-2 border-b items-center text-sm">
                <div className="col-span-2">#{it.orderNumber}</div>
                <div className="col-span-4">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-slate-500">SKU: {it.sku}</div>
                <div className="text-xs text-slate-500">
                  Title: {it.productTitle || '-'}{it.variantTitle ? ` • Variant: ${it.variantTitle}` : ''}
                </div>
                  {it.variantId && (
                    <button className="mt-1 text-xs text-blue-400 underline" onClick={() => openVariantDetail(it.variantId)}>
                      Details
                    </button>
                  )}
                </div>
                <div className="col-span-2 text-right">{it.quantity}</div>
                <div className="col-span-2 text-right">{formatCurrency(it.unitCost)}</div>
                <div className="col-span-2 text-right font-semibold">{formatCurrency(it.lineCost)}</div>
              </div>
            ))}
            {costItems.length === 0 && <div className="text-sm text-slate-500 py-4">No items found.</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Orders List Modal */}
      <Dialog open={isOrdersModalOpen} onOpenChange={setIsOrdersModalOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Orders — {ordersPeriod[0].toUpperCase() + ordersPeriod.slice(1)}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-400 border-b pb-2">
              <div className="col-span-3">Order</div>
              <div className="col-span-3">Delivery Time</div>
              <div className="col-span-2 text-right">Ex GST</div>
              <div className="col-span-2 text-right">GST</div>
              <div className="col-span-2 text-right">Inc GST</div>
            </div>
            {ordersList.map((o) => (
              <div key={o.orderNumber} className="grid grid-cols-12 gap-2 py-2 border-b items-center text-sm">
                <div className="col-span-3 font-medium">#{o.orderNumber}</div>
                <div className="col-span-3">{o.deliveryTime || '-'}</div>
                <div className="col-span-2 text-right">{formatCurrency(o.salesExGst)}</div>
                <div className="col-span-2 text-right">{formatCurrency(o.gst)}</div>
                <div className="col-span-2 text-right font-semibold">{formatCurrency(o.salesIncGst)}</div>
              </div>
            ))}
            {ordersList.length === 0 && <div className="text-sm text-slate-500 py-4">No orders found.</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Detail Modal */}
      <Dialog open={isVariantModalOpen} onOpenChange={setIsVariantModalOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Variant Details</DialogTitle>
          </DialogHeader>
          {!variantDetail ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="font-semibold">
                {variantDetail.displayName || variantDetail.shopifyTitle}
                {variantDetail.displayName && (variantDetail.shopifyTitle || variantDetail.title) ? (
                  <span className="opacity-80"> — {variantDetail.shopifyTitle || variantDetail.title}</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>Variant ID: {variantDetail.variantId}</div>
                <div>Total Cost: {formatCurrency(Number(variantDetail.totalCost || 0))}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>Title: {variantDetail.productTitle || '-'}</div>
                <div>Variant title: {variantDetail.variantTitle || variantDetail.shopifyTitle || '-'}</div>
              </div>
              <div>
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/products/recalculate-costs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ variantId: variantDetail.variantId })
                      })
                      // Reload variant to reflect new cost
                      await openVariantDetail(variantDetail.variantId)
                    } catch {}
                  }}
                  className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
                >
                  Recalculate cost (base + variant)
                </button>
              </div>
              {/* Add Ingredient - using same selector as Products tab */}
              <div className="flex gap-2">
                <button onClick={() => { setPendingBaseIngredients([]); setIsAddBaseOpen(true) }} className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600">
                  Add base ingredient
                </button>
                <button onClick={() => { setPendingVariantIngredients([]); setIsAddVariantOpen(true) }} className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600">
                  Add ingredient
                </button>
              </div>
              <div className="mt-2">
                <div className="font-medium mb-1">Base Ingredients (Product)</div>
                <div className="border rounded p-2 max-h-[30vh] overflow-auto">
                  {Array.isArray(variantDetail.baseIngredients) && variantDetail.baseIngredients.length > 0 ? (
                    variantDetail.baseIngredients.map((ing: any, i: number) => (
                      <div key={`base-${i}`} className="flex items-center justify-between py-1 border-b last:border-b-0">
                        <div>
                          <div className="font-medium">{ing.name || ing.id || 'Item'}</div>
                          <div className="text-xs text-slate-500">{ing.source}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs">Qty: {Number(ing.quantity || 0)}</div>
                          <div className="text-xs">Cost: {formatCurrency(Number(ing.cost || 0))}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No base ingredients recorded.</div>
                  )}
                </div>
              </div>
              <div className="mt-2">
                <div className="font-medium mb-1">Ingredients</div>
                <div className="border rounded p-2 max-h-[40vh] overflow-auto">
                  {Array.isArray(variantDetail.ingredients) && variantDetail.ingredients.length > 0 ? (
                    variantDetail.ingredients.map((ing: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b last:border-b-0">
                        <div>
                          <div className="font-medium">{ing.name || ing.id || 'Item'}</div>
                          <div className="text-xs text-slate-500">{ing.source}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs">Qty: {Number(ing.quantity || 0)}</div>
                          <div className="text-xs">Cost: {formatCurrency(Number(ing.cost || 0))}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No ingredients recorded.</div>
                  )}
                </div>
              </div>
              {(!Array.isArray(variantDetail.baseIngredients) || variantDetail.baseIngredients.length === 0) &&
               (!Array.isArray(variantDetail.ingredients) || variantDetail.ingredients.length === 0) &&
               Array.isArray(variantDetail.legacyIngredients) && variantDetail.legacyIngredients.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium mb-1">Legacy Ingredients (fallback)</div>
                  <div className="border rounded p-2 max-h-[40vh] overflow-auto">
                    {variantDetail.legacyIngredients.map((ing: any, i: number) => (
                      <div key={`legacy-${i}`} className="flex items-center justify-between py-1 border-b last:border-b-0">
                        <div>
                          <div className="font-medium">{ing.name || ing.id || 'Item'}</div>
                          <div className="text-xs text-slate-500">{ing.source}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs">Qty: {Number(ing.quantity || 0)}</div>
                          <div className="text-xs">Cost: {formatCurrency(Number(ing.cost || 0))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Base Ingredient Modal */}
      <Dialog open={isAddBaseOpen} onOpenChange={setIsAddBaseOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Add base ingredient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <IngredientSelector
              initialIngredients={[]}
              onIngredientsChange={(ings) => setPendingBaseIngredients(ings)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAddBaseOpen(false)} className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600">Cancel</button>
              <button onClick={addToBase} className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600">Add to Base</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Variant Ingredient Modal */}
      <Dialog open={isAddVariantOpen} onOpenChange={setIsAddVariantOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Add ingredient (variant)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <IngredientSelector
              initialIngredients={[]}
              onIngredientsChange={(ings) => setPendingVariantIngredients(ings)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAddVariantOpen(false)} className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600">Cancel</button>
              <button onClick={addToVariant} className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600">Add to Variant</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff Costs Breakdown Modal */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Staff Costs — {staffPeriod[0].toUpperCase() + staffPeriod.slice(1)}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-400 border-b pb-2">
              <div className="col-span-4">Staff</div>
              <div className="col-span-2 text-right">Pay Rate</div>
              <div className="col-span-2 text-right">Hours</div>
              <div className="col-span-2 text-right">Cost</div>
              <div className="col-span-2 text-right">Shifts</div>
            </div>
            {staffItems.map((s) => (
              <div key={s.staffId} className="grid grid-cols-12 gap-2 py-2 border-b items-center text-sm">
                <div className="col-span-4">
                  <div className="font-medium">{s.name}</div>
                </div>
                <div className="col-span-2 text-right">{formatCurrency(Number(s.payRate || 0))}/h</div>
                <div className="col-span-2 text-right">{Number(s.totalHours).toFixed(2)}</div>
                <div className="col-span-2 text-right font-semibold">{formatCurrency(Number(s.totalCost || 0))}</div>
                <div className="col-span-2 text-right text-xs text-blue-400">
                  {s.shifts.length}
                </div>
                <div className="col-span-12 text-xs text-slate-500">
                  {s.shifts.map(sh => (
                    <div key={sh.id} className="flex flex-wrap items-center justify-between py-1 border-t">
                      <div>{sh.date}</div>
                      <div>Start: {sh.clockIn || '-'}</div>
                      <div>End: {sh.clockOut || '-'}</div>
                      <div>Hours: {sh.hours.toFixed(2)}</div>
                      <div>Cost: {formatCurrency(sh.cost)}</div>
                      {sh.notes && <div className="italic text-slate-400 truncate max-w-[40ch]">Notes: {sh.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {staffItems.length === 0 && <div className="text-sm text-slate-500 py-4">No staff shifts found.</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Historic Sales - 3.5 Years */}
      <div className="hidden sm:block mt-6">
        <Card className="bg-slate-800 text-slate-100 border border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Rolling 28-day Sales — Last 3.5 Years</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline data={longSeries} />
          </CardContent>
        </Card>
      </div>
      </div>
  )

  // Owner can tab through views; Admin sees Admin S; Basic sees Basic
  if (access === 'owner') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <div className="w-full max-w-none px-[15vw] space-y-4">
          <div className="flex items-center gap-2">
            <Tabs className="w-full" value={ownerView} onValueChange={(v)=>{ setOwnerView(v as any); try{ localStorage.setItem('owner-dashboard-view', v) }catch{}; const u=new URL(window.location.href); u.searchParams.set('view', v); window.history.replaceState({},'',u.toString()) }}>
              <TabsList>
                <TabsTrigger value="owner">Owner</TabsTrigger>
                <TabsTrigger value="adminS">Admin S</TabsTrigger>
                <TabsTrigger value="basic">Basic</TabsTrigger>
              </TabsList>
              <TabsContent value="owner" className="w-full">{OwnerContent}</TabsContent>
              <TabsContent value="adminS" className="w-full"><AdminSDashboard /></TabsContent>
              <TabsContent value="basic" className="w-full"><BasicDashboard /></TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    )
  }

  if ((access || '').toLowerCase() === 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <div className="w-full max-w-none px-[15vw] space-y-4">
          <AdminSDashboard />
        </div>
      </div>
    )
  }

  // Default to Basic dashboard for all other roles (e.g., 'basic')
  return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="w-full max-w-none px-[15vw] space-y-4">
        <BasicDashboard />
      </div>
    </div>
  )
} 