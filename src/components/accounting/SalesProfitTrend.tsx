'use client'

import { useState } from 'react'
import { useAccountingGet } from '@/lib/use-accounting'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'

export default function SalesProfitTrend({ params }: { params: Record<string, any> }) {
  const [localRange, setLocalRange] = useState<string | null>(null)
  const merged = { ...params, ...(localRange ? { rangePreset: localRange } : {}) }
  const { data, error, isLoading } = useAccountingGet<any>('/api/accounting/sales-profit-trend', merged)

  if (isLoading) {
    return <div className="rounded-lg border p-4 min-h-[360px] animate-pulse bg-muted/30">Loading Sales vs Profit…</div>
  }
  if (error) {
    return <div className="rounded-lg border p-4 text-red-600">Failed to load Sales vs Profit</div>
  }
  if (!data || !Array.isArray(data.series) || data.series.length === 0) {
    return <div className="rounded-lg border p-4">No data in selected range.</div>
  }

  const k = data.kpis || {}
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Sales vs Profit Trend</h2>
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          {['7D','30D','6M','12M','YTD'].map(r => (
            <button key={r} onClick={() => setLocalRange(r === localRange ? null : r)}
              className={`px-2 py-1 ${localRange === r ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPI label="Revenue (inc‑GST)" value={currency(k.revenue)} />
        <KPI label="COGS" value={currency(k.cogs)} />
        <KPI label="Gross Profit" value={currency(k.grossProfit)} />
        <KPI label="Margin %" value={`${Number(k.grossMarginPct || 0).toFixed(1)}%`} />
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#2563eb" dot={false} />
            <Line type="monotone" dataKey="cogs" stroke="#ef4444" dot={false} />
            <Line type="monotone" dataKey="grossProfit" stroke="#10b981" dot={false} />
            <Line type="monotone" dataKey="grossMarginPct" stroke="#f59e0b" dot={false} yAxisId={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-muted-foreground mt-2">COGS coverage: {data?.kpis?.cogsCoveragePct ?? 0}% of revenue</div>
    </div>
  )
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

function currency(n: number) {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(v)
}

