'use client'

import { useMemo, useState } from 'react'
import { useAccountingGet } from '@/lib/use-accounting'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type WindowKey = '7D' | '30D' | '6M' | '12M' | 'ALL'
type MetricKey = 'avgRevenue' | 'avgCogs' | 'avgStaffing' | 'avgGrossProfit' | 'avgGpAfterStaffing'

export default function SalesByWeekday({ params }: { params: Record<string, any> }) {
  const [activeWindow, setActiveWindow] = useState<WindowKey>('30D')
  const [metric, setMetric] = useState<MetricKey>('avgRevenue')
  const merged = { ...params, includeAll: activeWindow === 'ALL' }
  const { data, error, isLoading } = useAccountingGet<any>('/api/accounting/sales-by-weekday', merged)
  const windows: WindowKey[] = ['7D', '30D', '6M', '12M', 'ALL']
  const metrics: Array<{ key: MetricKey; label: string }> = [
    { key: 'avgRevenue', label: 'Sales avg' },
    { key: 'avgCogs', label: 'Costs avg' },
    { key: 'avgStaffing', label: 'Staffing avg' },
    { key: 'avgGrossProfit', label: 'GP avg' },
    { key: 'avgGpAfterStaffing', label: 'GP after staffing avg' },
  ]

  if (isLoading) {
    return <div className="rounded-lg border p-4 min-h-[340px] animate-pulse bg-muted/30">Loading Sales by Weekday…</div>
  }
  if (error) {
    return <div className="rounded-lg border p-4 text-red-600">Failed to load Sales by Weekday</div>
  }

  const byWindow = data?.byWindow || {}
  const chartRows = Array.isArray(byWindow?.[activeWindow]) ? byWindow[activeWindow] : []
  const hasData = chartRows.length > 0
  const summaryByWindow = data?.summaryByWindow || {}

  const weekdayRows = useMemo<Array<{ weekday: string; avgRevenue: number; avgCogs: number; avgStaffing: number; avgGrossProfit: number; avgGpAfterStaffing: number }>>(() => {
    if (!hasData) return []
    return chartRows.map((r: any) => ({
      weekday: String(r.weekday || ''),
      avgRevenue: Number(r.avgRevenue || 0),
      avgCogs: Number(r.avgCogs || 0),
      avgStaffing: Number(r.avgStaffing || 0),
      avgGrossProfit: Number(r.avgGrossProfit || 0),
      avgGpAfterStaffing: Number(r.avgGpAfterStaffing || 0),
    }))
  }, [chartRows, hasData])

  if (!hasData) {
    return <div className="rounded-lg border p-4">No weekday sales data available.</div>
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Sales by Day of Week (Averages)</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border overflow-hidden text-sm">
            {windows.map(w => (
              <button
                key={w}
                onClick={() => setActiveWindow(w)}
                className={`px-2 py-1 ${activeWindow === w ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md border overflow-hidden text-sm">
            {metrics.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`px-2 py-1 ${metric === m.key ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KPI label="Sales avg" value={currency(Number(summaryByWindow?.[activeWindow]?.avgRevenue || 0))} />
        <KPI label="Costs avg" value={currency(Number(summaryByWindow?.[activeWindow]?.avgCogs || 0))} />
        <KPI label="Staffing avg" value={currency(Number(summaryByWindow?.[activeWindow]?.avgStaffing || 0))} />
        <KPI label="GP avg" value={currency(Number(summaryByWindow?.[activeWindow]?.avgGrossProfit || 0))} />
        <KPI label="GP after staffing avg" value={currency(Number(summaryByWindow?.[activeWindow]?.avgGpAfterStaffing || 0))} />
      </div>

      <div className="h-[280px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="weekday" />
            <YAxis tickFormatter={(v) => `$${Number(v || 0).toFixed(0)}`} />
            <Tooltip formatter={(value: any) => currency(Number(value || 0))} />
            <Bar dataKey={metric} fill="#2563eb" name={metrics.find(m => m.key === metric)?.label || metric} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-4">Weekday</th>
              <th className="py-2 pr-4 text-right">Sales avg</th>
              <th className="py-2 pr-4 text-right">Costs avg</th>
              <th className="py-2 pr-4 text-right">Staffing avg</th>
              <th className="py-2 pr-4 text-right">GP avg</th>
              <th className="py-2 pr-0 text-right">GP after staffing avg</th>
            </tr>
          </thead>
          <tbody>
            {weekdayRows.map((r: any) => (
              <tr key={r.weekday} className="border-b last:border-0">
                <td className="py-2 pr-4">{r.weekday}</td>
                <td className="py-2 pr-4 text-right">{currency(r.avgRevenue)}</td>
                <td className="py-2 pr-4 text-right">{currency(r.avgCogs)}</td>
                <td className="py-2 pr-4 text-right">{currency(r.avgStaffing)}</td>
                <td className="py-2 pr-4 text-right">{currency(r.avgGrossProfit)}</td>
                <td className="py-2 pr-0 text-right">{currency(r.avgGpAfterStaffing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function currency(n: number) {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(v)
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
