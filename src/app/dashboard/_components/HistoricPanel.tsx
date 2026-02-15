"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IngredientSelector } from '@/components/IngredientSelector'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Brush, Legend } from 'recharts'

type DayRow = {
  date: string
  salesIncGst: number
  salesExGst: number
  costOfSales: number
  staffCosts: number
  ordersCount: number
  gp: number
  gpPct: number
  gpWithStaff: number
  gpWithStaffPct: number
}

type Metric = 'salesEx' | 'gpPct' | 'gpStaffPct'

function formatCurrency(n: number) {
  return n.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })
}
function formatPct(n: number) {
  return `${n.toFixed(1)}%`
}
function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

export default function HistoricPanel() {
  const today = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => {
    const back = new Date(today); back.setDate(back.getDate() - 364)
    return ymd(back)
  }, [today])
  const defaultEnd = useMemo(() => ymd(today), [today])

  const [metric, setMetric] = useState<Metric>('salesEx')
  const [start, setStart] = useState<string>(defaultStart)
  const [end, setEnd] = useState<string>(defaultEnd)
  const [series, setSeries] = useState<DayRow[]>([])
  const lastShapeRef = useRef<number>(0)

  const load = useCallback(async (s: string, e: string) => {
    const res = await fetch(`/api/dashboard/series?start=${s}&end=${e}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load series')
    const data = await res.json()
    const days = Array.isArray(data.days) ? data.days as DayRow[] : []
    // background swap without flash: only commit if shape changed or newer length
    const shape = days.length
    if (shape !== lastShapeRef.current) {
      lastShapeRef.current = shape
      setSeries(days)
    } else {
      // same length: replace contents quietly
      setSeries(days)
    }
  }, [])

  useEffect(() => {
    load(start, end).catch(console.error)
  }, [start, end, load])

  // 60s background refresh
  useEffect(() => {
    const id = setInterval(() => {
      load(start, end).catch(console.error)
    }, 60_000)
    return () => clearInterval(id)
  }, [start, end, load])

  const chartData = series
  const metricKey = metric === 'salesEx' ? 'salesExGst' : metric === 'gpPct' ? 'gpPct' : 'gpWithStaffPct'
  const isPct = metric !== 'salesEx'

  // Averages for current range
  const avg = useCallback((rows: DayRow[], key: keyof DayRow, digits = 2, ignoreZeros = false) => {
    if (!rows.length) return 0
    const values = rows.map(r => Number(r[key]) || 0)
    const filtered = ignoreZeros ? values.filter(v => isFinite(v) && v !== 0) : values.filter(v => isFinite(v))
    if (!filtered.length) return 0
    const v = filtered.reduce((s, n) => s + n, 0) / filtered.length
    return Number(v.toFixed(digits))
  }, [])
  const rangeAvg = useMemo(() => {
    return {
      salesEx: avg(series, 'salesExGst', 2),
      cogs: avg(series, 'costOfSales', 2),
      gp: avg(series, 'gp', 2),
      gpPct: avg(series, 'gpPct', 1, true),
      staff: avg(series, 'staffCosts', 2),
      gpStaff: avg(series, 'gpWithStaff', 2),
      gpStaffPct: avg(series, 'gpWithStaffPct', 1, true),
      ordersPerDay: avg(series, 'ordersCount', 2),
    }
  }, [series, avg])

  // Tables
  const last7 = useMemo(() => series.slice(-7), [series])
  const last28 = useMemo(() => series.slice(-28), [series])
  const ytdMonthly = useMemo(() => {
    const byMonth = new Map<string, { salesEx: number; cogs: number; staff: number; orders: number }>()
    const year = new Date().getFullYear()
    for (const d of series) {
      if (!d.date.startsWith(String(year))) continue
      const month = d.date.slice(0,7)
      const prev = byMonth.get(month) || { salesEx: 0, cogs: 0, staff: 0, orders: 0 }
      prev.salesEx += d.salesExGst
      prev.cogs += d.costOfSales
      prev.staff += d.staffCosts
      prev.orders += d.ordersCount
      byMonth.set(month, prev)
    }
    const rows = Array.from(byMonth.entries()).sort((a,b) => a[0] < b[0] ? -1 : 1).map(([month, v]) => {
      const gp = v.salesEx - v.cogs
      const gpPct = v.salesEx > 0 ? (gp / v.salesEx) * 100 : 0
      const gpStaff = v.salesEx - v.cogs - v.staff
      const gpStaffPct = v.salesEx > 0 ? (gpStaff / v.salesEx) * 100 : 0
      return { month, salesEx: v.salesEx, cogs: v.cogs, gp, gpPct, staff: v.staff, gpStaff, gpStaffPct, orders: v.orders }
    })
    return rows
  }, [series])

  // Day cost breakdown modal
  const [isDayCostOpen, setIsDayCostOpen] = useState(false)
  const [dayCostItems, setDayCostItems] = useState<any[]>([])
  const [dayLabel, setDayLabel] = useState<string>('')
  const openDayCost = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/dashboard/cost-breakdown?start=${date}&end=${date}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed load')
      const data = await res.json()
      setDayCostItems(Array.isArray(data.items) ? data.items : [])
      setDayLabel(date)
      setIsDayCostOpen(true)
    } catch (e) {
      console.error(e)
      setDayCostItems([])
      setDayLabel(date)
      setIsDayCostOpen(true)
    }
  }, [])

  // Variant detail + ingredient editing
  const [variantDetail, setVariantDetail] = useState<any | null>(null)
  const [isVariantOpen, setIsVariantOpen] = useState(false)
  const [isAddBaseOpen, setIsAddBaseOpen] = useState(false)
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false)
  const [pendingBaseIngredients, setPendingBaseIngredients] = useState<any[]>([])
  const [pendingVariantIngredients, setPendingVariantIngredients] = useState<any[]>([])

  const openVariantDetail = useCallback(async (variantId: string | null) => {
    if (!variantId) return
    try {
      const res = await fetch(`/api/products/variant/${encodeURIComponent(variantId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load variant')
      const data = await res.json()
      setVariantDetail(data)
      setIsVariantOpen(true)
    } catch (e) {
      console.error(e)
      setVariantDetail(null)
    }
  }, [])

  const addToBase = useCallback(async () => {
    if (!variantDetail?.productId) return
    try {
      const base = Array.isArray(variantDetail.baseIngredients) ? [...variantDetail.baseIngredients] : []
      const payload = { baseIngredients: [...base, ...pendingBaseIngredients] }
      const res = await fetch(`/api/products/${encodeURIComponent(variantDetail.productId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to update base')
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
  }, [variantDetail, pendingBaseIngredients, openVariantDetail])

  const addToVariant = useCallback(async () => {
    if (!variantDetail?.variantId) return
    try {
      const ings = Array.isArray(variantDetail?.ingredients) ? [...(variantDetail.ingredients as any[])] : []
      const res = await fetch(`/api/products/variant/${encodeURIComponent(variantDetail.variantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: [...ings, ...pendingVariantIngredients] })
      })
      if (!res.ok) throw new Error('Failed to update variant')
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
  }, [variantDetail, pendingVariantIngredients, openVariantDetail])

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 text-slate-100 border border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex gap-2">
              <button className={`px-3 py-1.5 rounded ${metric==='salesEx'?'bg-amber-600 text-white':'bg-slate-700 text-slate-200'}`} onClick={()=>setMetric('salesEx')}>Sales Ex GST</button>
              <button className={`px-3 py-1.5 rounded ${metric==='gpPct'?'bg-amber-600 text-white':'bg-slate-700 text-slate-200'}`} onClick={()=>setMetric('gpPct')}>GP %</button>
              <button className={`px-3 py-1.5 rounded ${metric==='gpStaffPct'?'bg-amber-600 text-white':'bg-slate-700 text-slate-200'}`} onClick={()=>setMetric('gpStaffPct')}>GP % (with staffing)</button>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={start} onChange={e=>setStart(e.target.value)} className="bg-slate-700 text-slate-100 rounded px-2 py-1" />
              <span className="text-slate-300">to</span>
              <input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="bg-slate-700 text-slate-100 rounded px-2 py-1" />
            </div>
          </div>
          <div className="mt-4 w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" tickFormatter={(v)=> isPct ? `${v}%` : `$${Number(v).toFixed(0)}`} />
                <Tooltip formatter={(v:any)=> isPct ? `${v}%` : formatCurrency(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey={metricKey} stroke="#f59e0b" dot={false} strokeWidth={2} />
                <Brush dataKey="date" height={20} stroke="#94a3b8" travellerWidth={8} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Averages footer */}
          <div className="mt-3 grid grid-cols-8 gap-2 text-xs text-slate-300">
            <div>Avg Sales Ex: <span className="font-semibold">{formatCurrency(rangeAvg.salesEx)}</span></div>
            <div>Avg COGS: <span className="font-semibold">{formatCurrency(rangeAvg.cogs)}</span></div>
            <div>Avg GP: <span className="font-semibold">{formatCurrency(rangeAvg.gp)}</span></div>
            <div>Avg GP %: <span className="font-semibold">{formatPct(rangeAvg.gpPct)}</span></div>
            <div>Avg Staff: <span className="font-semibold">{formatCurrency(rangeAvg.staff)}</span></div>
            <div>Avg GP w/Staff: <span className="font-semibold">{formatCurrency(rangeAvg.gpStaff)}</span></div>
            <div>Avg GP w/Staff %: <span className="font-semibold">{formatPct(rangeAvg.gpStaffPct)}</span></div>
            <div>Avg Orders/Day: <span className="font-semibold">{rangeAvg.ordersPerDay.toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Last 7 Days */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-2">Last 7 days</div>
          <div className="grid grid-cols-13 text-xs text-slate-500 border-b pb-1">
            <div className="col-span-2">Date</div>
            <div className="col-span-2 text-right">Sales Ex</div>
            <div className="col-span-2 text-right">COGS</div>
            <div className="col-span-2 text-right">GP</div>
            <div className="col-span-1 text-right">GP %</div>
            <div className="col-span-1 text-right">Staff</div>
            <div className="col-span-2 text-right">GP w/Staff</div>
            <div className="col-span-1 text-right">GP % w/Staff</div>
          </div>
          {last7.map(d => (
            <div key={d.date} className="grid grid-cols-13 text-sm py-1 border-b">
              <button className="col-span-2 text-left text-blue-400 underline hover:text-blue-300" onClick={()=>openDayCost(d.date)}>{d.date}</button>
              <div className="col-span-2 text-right">{formatCurrency(d.salesExGst)}</div>
              <div className="col-span-2 text-right">{formatCurrency(d.costOfSales)}</div>
              <div className="col-span-2 text-right">{formatCurrency(d.gp)}</div>
              <div className="col-span-1 text-right">{formatPct(d.gpPct)}</div>
              <div className="col-span-1 text-right">{formatCurrency(d.staffCosts)}</div>
              <div className="col-span-2 text-right">{formatCurrency(d.gpWithStaff)}</div>
              <div className="col-span-1 text-right">{formatPct(d.gpWithStaffPct)}</div>
            </div>
          ))}
          <div className="grid grid-cols-13 text-sm py-1 border-t mt-2 font-semibold">
            <div className="col-span-2">AVERAGE</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last7, 'salesExGst'))}</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last7, 'costOfSales'))}</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last7, 'gp'))}</div>
            <div className="col-span-1 text-right">{formatPct(avg(last7, 'gpPct', 1, true))}</div>
            <div className="col-span-1 text-right">{formatCurrency(avg(last7, 'staffCosts'))}</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last7, 'gpWithStaff'))}</div>
            <div className="col-span-1 text-right">{formatPct(avg(last7, 'gpWithStaffPct', 1, true))}</div>
          </div>
        </CardContent>
      </Card>

      {/* Last 28 Days */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-2">Last 28 days</div>
          <div className="grid grid-cols-13 text-xs text-slate-500 border-b pb-1">
            <div className="col-span-2">Date</div>
            <div className="col-span-2 text-right">Sales Ex</div>
            <div className="col-span-2 text-right">COGS</div>
            <div className="col-span-2 text-right">GP</div>
            <div className="col-span-1 text-right">GP %</div>
            <div className="col-span-1 text-right">Staff</div>
            <div className="col-span-2 text-right">GP w/Staff</div>
            <div className="col-span-1 text-right">GP % w/Staff</div>
          </div>
          {last28.map(d => (
            <div key={d.date} className="grid grid-cols-13 text-sm py-1 border-b">
              <button className="col-span-2 text-left text-blue-400 underline hover:text-blue-300" onClick={()=>openDayCost(d.date)}>{d.date}</button>
              <div className="col-span-2 text-right">{formatCurrency(d.salesExGst)}</div>
              <div className="col-span-2 text-right">{formatCurrency(d.costOfSales)}</div>
              <div className="col-span-2 text-right">{formatCurrency(d.gp)}</div>
              <div className="col-span-1 text-right">{formatPct(d.gpPct)}</div>
              <div className="col-span-1 text-right">{formatCurrency(d.staffCosts)}</div>
              <div className="col-span-2 text-right">{formatCurrency(d.gpWithStaff)}</div>
              <div className="col-span-1 text-right">{formatPct(d.gpWithStaffPct)}</div>
            </div>
          ))}
          <div className="grid grid-cols-13 text-sm py-1 border-t mt-2 font-semibold">
            <div className="col-span-2">AVERAGE</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last28, 'salesExGst'))}</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last28, 'costOfSales'))}</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last28, 'gp'))}</div>
            <div className="col-span-1 text-right">{formatPct(avg(last28, 'gpPct', 1, true))}</div>
            <div className="col-span-1 text-right">{formatCurrency(avg(last28, 'staffCosts'))}</div>
            <div className="col-span-2 text-right">{formatCurrency(avg(last28, 'gpWithStaff'))}</div>
            <div className="col-span-1 text-right">{formatPct(avg(last28, 'gpWithStaffPct', 1, true))}</div>
          </div>
        </CardContent>
      </Card>

      {/* YTD (Monthly) */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-2">Year to Date (monthly)</div>
          <div className="grid grid-cols-13 text-xs text-slate-500 border-b pb-1">
            <div className="col-span-2">Month</div>
            <div className="col-span-2 text-right">Sales Ex</div>
            <div className="col-span-2 text-right">COGS</div>
            <div className="col-span-2 text-right">GP</div>
            <div className="col-span-1 text-right">GP %</div>
            <div className="col-span-1 text-right">Staff</div>
            <div className="col-span-2 text-right">GP w/Staff</div>
            <div className="col-span-1 text-right">GP % w/Staff</div>
          </div>
          {ytdMonthly.map((m) => (
            <div key={m.month} className="grid grid-cols-13 text-sm py-1 border-b">
              <div className="col-span-2">{m.month}</div>
              <div className="col-span-2 text-right">{formatCurrency(m.salesEx)}</div>
              <div className="col-span-2 text-right">{formatCurrency(m.cogs)}</div>
              <div className="col-span-2 text-right">{formatCurrency(m.gp)}</div>
              <div className="col-span-1 text-right">{formatPct(m.gpPct)}</div>
              <div className="col-span-1 text-right">{formatCurrency(m.staff)}</div>
              <div className="col-span-2 text-right">{formatCurrency(m.gpStaff)}</div>
              <div className="col-span-1 text-right">{formatPct(m.gpStaffPct)}</div>
            </div>
          ))}
          {ytdMonthly.length > 0 && (
            <div className="grid grid-cols-13 text-sm py-1 border-t mt-2 font-semibold">
              <div className="col-span-2">AVERAGE</div>
              <div className="col-span-2 text-right">{formatCurrency(ytdMonthly.reduce((s,r)=>s+r.salesEx,0)/ytdMonthly.length)}</div>
              <div className="col-span-2 text-right">{formatCurrency(ytdMonthly.reduce((s,r)=>s+r.cogs,0)/ytdMonthly.length)}</div>
              <div className="col-span-2 text-right">{formatCurrency(ytdMonthly.reduce((s,r)=>s+r.gp,0)/ytdMonthly.length)}</div>
              <div className="col-span-1 text-right">{formatPct((() => {
                const vals = ytdMonthly.map(r => r.gpPct).filter(v => isFinite(v) && v !== 0)
                return (vals.length ? vals.reduce((s,r)=>s+r,0)/vals.length : 0)
              })())}</div>
              <div className="col-span-1 text-right">{formatCurrency(ytdMonthly.reduce((s,r)=>s+r.staff,0)/ytdMonthly.length)}</div>
              <div className="col-span-2 text-right">{formatCurrency(ytdMonthly.reduce((s,r)=>s+r.gpStaff,0)/ytdMonthly.length)}</div>
              <div className="col-span-1 text-right">{formatPct((() => {
                const vals = ytdMonthly.map(r => r.gpStaffPct).filter(v => isFinite(v) && v !== 0)
                return (vals.length ? vals.reduce((s,r)=>s+r,0)/vals.length : 0)
              })())}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day Cost Modal */}
      <Dialog open={isDayCostOpen} onOpenChange={setIsDayCostOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Cost of Sales — {dayLabel}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-400 border-b pb-2">
              <div className="col-span-3">Order</div>
              <div className="col-span-5">Item</div>
              <div className="col-span-1 text-right">Qty</div>
              <div className="col-span-1 text-right">Unit</div>
              <div className="col-span-2 text-right">Line</div>
            </div>
            {dayCostItems.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 py-2 border-b items-center text-sm">
                <div className="col-span-3 font-medium">#{it.orderNumber}</div>
                <div className="col-span-5">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-slate-500">Title: {it.productTitle || '-'}{it.variantTitle ? ` • Variant: ${it.variantTitle}` : ''}</div>
                  {it.variantId && (
                    <button className="mt-1 text-xs text-blue-400 underline" onClick={()=>openVariantDetail(it.variantId)}>
                      Details
                    </button>
                  )}
                </div>
                <div className="col-span-1 text-right">{it.quantity}</div>
                <div className="col-span-1 text-right">{formatCurrency(it.unitCost)}</div>
                <div className="col-span-2 text-right font-semibold">{formatCurrency(it.lineCost)}</div>
              </div>
            ))}
            {dayCostItems.length === 0 && <div className="text-sm text-slate-500 py-4">No items.</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Detail Modal */}
      <Dialog open={isVariantOpen} onOpenChange={setIsVariantOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Variant Detail</DialogTitle>
          </DialogHeader>
          {!variantDetail ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">
                <div><span className="text-slate-400">Product:</span> {variantDetail.productTitle || '-'}</div>
                <div><span className="text-slate-400">Variant:</span> {variantDetail.shopifyName || '-'}</div>
                <div><span className="text-slate-400">Current cost:</span> {formatCurrency(Number(variantDetail.totalCost || 0))}</div>
              </div>
              {/* Existing ingredients (read-only view) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1">Base Ingredients</div>
                  <div className="border rounded-md max-h-56 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Cost</th>
                          <th className="text-right p-2">Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(variantDetail.baseIngredients) ? variantDetail.baseIngredients : []).map((ing: any, i: number) => {
                          const qty = Number(ing?.quantity || 0)
                          const cost = Number(ing?.cost || 0)
                          const line = qty * cost
                          return (
                            <tr key={i} className="border-t">
                              <td className="p-2">{ing?.name || ing?.id || '—'}</td>
                              <td className="p-2 text-right">{isFinite(qty) ? qty : 0}</td>
                              <td className="p-2 text-right">{formatCurrency(isFinite(cost) ? cost : 0)}</td>
                              <td className="p-2 text-right">{formatCurrency(isFinite(line) ? line : 0)}</td>
                            </tr>
                          )
                        })}
                        {(!Array.isArray(variantDetail.baseIngredients) || variantDetail.baseIngredients.length === 0) && (
                          <tr><td className="p-2 text-slate-500" colSpan={4}>No base ingredients.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1">Variant Ingredients</div>
                  <div className="border rounded-md max-h-56 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Cost</th>
                          <th className="text-right p-2">Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(variantDetail.ingredients) ? variantDetail.ingredients : []).map((ing: any, i: number) => {
                          const qty = Number(ing?.quantity || 0)
                          const cost = Number(ing?.cost || 0)
                          const line = qty * cost
                          return (
                            <tr key={i} className="border-t">
                              <td className="p-2">{ing?.name || ing?.id || '—'}</td>
                              <td className="p-2 text-right">{isFinite(qty) ? qty : 0}</td>
                              <td className="p-2 text-right">{formatCurrency(isFinite(cost) ? cost : 0)}</td>
                              <td className="p-2 text-right">{formatCurrency(isFinite(line) ? line : 0)}</td>
                            </tr>
                          )
                        })}
                        {(!Array.isArray(variantDetail.ingredients) || variantDetail.ingredients.length === 0) && (
                          <tr><td className="p-2 text-slate-500" colSpan={4}>No variant ingredients.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600" onClick={()=>setIsAddBaseOpen(true)}>Add Base Ingredient</button>
                <button className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600" onClick={()=>setIsAddVariantOpen(true)}>Add Variant Ingredient</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Base Ingredient */}
      <Dialog open={isAddBaseOpen} onOpenChange={setIsAddBaseOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader><DialogTitle>Add Base Ingredient</DialogTitle></DialogHeader>
          <IngredientSelector onIngredientsChange={setPendingBaseIngredients} />
          <div className="flex justify-end gap-2 mt-4">
            <button className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600" onClick={()=>setIsAddBaseOpen(false)}>Cancel</button>
            <button className="px-3 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white" onClick={addToBase}>Save</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Variant Ingredient */}
      <Dialog open={isAddVariantOpen} onOpenChange={setIsAddVariantOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader><DialogTitle>Add Variant Ingredient</DialogTitle></DialogHeader>
          <IngredientSelector onIngredientsChange={setPendingVariantIngredients} />
          <div className="flex justify-end gap-2 mt-4">
            <button className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600" onClick={()=>setIsAddVariantOpen(false)}>Cancel</button>
            <button className="px-3 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white" onClick={addToVariant}>Save</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

