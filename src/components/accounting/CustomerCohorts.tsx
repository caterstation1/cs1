'use client'

import { useAccountingGet } from '@/lib/use-accounting'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'

export default function CustomerCohorts({ params }: { params: Record<string, any> }) {
  const { data, error, isLoading } = useAccountingGet<any>('/api/accounting/customer-cohorts', params)

  if (isLoading) return <div className="rounded-lg border p-4 min-h-[300px] animate-pulse bg-muted/30">Loading Cohorts…</div>
  if (error) return <div className="rounded-lg border p-4 text-red-600">Failed to load Cohorts</div>

  const monthly = Array.isArray(data?.monthly) ? data.monthly : []
  const repeat = data?.repeatRates || { repeat30: 0, repeat60: 0, repeat90: 0, baseCustomers: 0 }
  const aov = Array.isArray(data?.aov) ? data.aov : []

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Customer Cohorts & Repeat</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPI label="Repeat 30d" value={`${Number(repeat.repeat30 || 0).toFixed(1)}%`} />
        <KPI label="Repeat 60d" value={`${Number(repeat.repeat60 || 0).toFixed(1)}%`} />
        <KPI label="Repeat 90d" value={`${Number(repeat.repeat90 || 0).toFixed(1)}%`} />
        <KPI label="Base (first‑ever in range)" value={String(repeat.baseCustomers || 0)} />
      </div>
      <div className="h-[220px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="newCustomers" stackId="a" fill="#2563eb" />
            <Bar dataKey="returningCustomers" stackId="a" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={aov}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="aov" stroke="#f59e0b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
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

