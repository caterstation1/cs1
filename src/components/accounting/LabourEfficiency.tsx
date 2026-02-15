'use client'

import { useState } from 'react'
import { useAccountingGet } from '@/lib/use-accounting'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'

export default function LabourEfficiency({ params }: { params: Record<string, any> }) {
  const [bucket, setBucket] = useState<'week' | 'day'>('week')
  const merged = { ...params, bucket }
  const { data, error, isLoading } = useAccountingGet<any>('/api/accounting/labour-efficiency', merged)

  if (isLoading) return <div className="rounded-lg border p-4 min-h-[300px] animate-pulse bg-muted/30">Loading Labour Efficiency…</div>
  if (error) return <div className="rounded-lg border p-4 text-red-600">Failed to load Labour Efficiency</div>

  const k = data?.kpis || { labourPct: 0, totalLabourHours: 0, salesPerHour: 0 }
  const rows = Array.isArray(data?.series) ? data.series : []

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Labour Efficiency</h2>
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          {(['week','day'] as const).map(v => (
            <button key={v} onClick={() => setBucket(v)} className={`px-2 py-1 ${bucket === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{v === 'week' ? 'Weekly' : 'Daily'}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KPI label="Labour % of revenue" value={`${Number(k.labourPct || 0).toFixed(1)}%`} />
        <KPI label="Total labour hours" value={`${Number(k.totalLabourHours || 0).toFixed(2)}`} />
        <KPI label="Sales per labour hour" value={currency(k.salesPerHour)} />
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="labourPct" stroke="#ef4444" dot={false} />
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

function currency(n: number) {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(v)
}

