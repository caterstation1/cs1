'use client'

import { useState } from 'react'
import { useAccountingGet } from '@/lib/use-accounting'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function DeliveryProfitByZone({ params }: { params: Record<string, any> }) {
  const [groupBy, setGroupBy] = useState<'zone' | 'suburb'>('suburb')
  const [metric, setMetric] = useState<'revenue' | 'profit'>('revenue')
  const merged = { ...params, groupBy, sortBy: metric }
  const { data, error, isLoading } = useAccountingGet<any>('/api/accounting/delivery-profitability', merged)

  if (isLoading) return <div className="rounded-lg border p-4 min-h-[300px] animate-pulse bg-muted/30">Loading Delivery Profitability…</div>
  if (error) return <div className="rounded-lg border p-4 text-red-600">Failed to load Delivery Profitability</div>

  const rows = Array.isArray(data?.top) ? data.top : []

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Delivery Profitability by Zone</h2>
        <div className="flex items-center gap-2 text-sm">
          <div className="inline-flex rounded-md border overflow-hidden">
            {(['zone','suburb'] as const).map(k => (
              <button key={k} onClick={() => setGroupBy(k)}
                className={`px-2 py-1 ${groupBy === k ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{k}</button>
            ))}
          </div>
          <div className="inline-flex rounded-md border overflow-hidden">
            {(['revenue','profit'] as const).map(k => (
              <button key={k} onClick={() => setMetric(k)}
                className={`px-2 py-1 ${metric === k ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{k}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[260px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={Array.isArray(data?.bar) ? data.bar : []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="revenue" fill="#2563eb" />
            <Bar dataKey="profit" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-4">Zone/Suburb</th>
              <th className="py-2 pr-4 text-right">Orders</th>
              <th className="py-2 pr-4 text-right">Revenue</th>
              <th className="py-2 pr-4 text-right">COGS</th>
              <th className="py-2 pr-4 text-right">Delivery</th>
              <th className="py-2 pr-4 text-right">Profit</th>
              <th className="py-2 pr-4 text-right">Margin %</th>
              <th className="py-2 pr-0 text-right">Avg Deliv. / order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any) => (
              <tr key={r.name} className="border-b last:border-0">
                <td className="py-2 pr-4">{r.name}</td>
                <td className="py-2 pr-4 text-right">{r.ordersCount}</td>
                <td className="py-2 pr-4 text-right">{currency(r.revenue)}</td>
                <td className="py-2 pr-4 text-right">{currency(r.cogs)}</td>
                <td className="py-2 pr-4 text-right">{currency(r.deliveryCost)}</td>
                <td className={`py-2 pr-4 text-right ${r.profit < 0 ? 'text-red-600 font-semibold' : ''}`}>{currency(r.profit)}</td>
                <td className={`py-2 pr-4 text-right ${r.profit < 0 ? 'text-red-600 font-semibold' : ''}`}>{Number(r.marginPct || 0).toFixed(1)}%</td>
                <td className="py-2 pr-0 text-right">{currency(r.avgDeliveryCost)}</td>
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

