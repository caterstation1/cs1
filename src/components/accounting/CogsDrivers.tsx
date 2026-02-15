'use client'

import { useState } from 'react'
import { useAccountingGet } from '@/lib/use-accounting'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function CogsDrivers({ params }: { params: Record<string, any> }) {
  const [view, setView] = useState<'products' | 'ingredients'>('products')
  const merged = { ...params, view }
  const { data, error, isLoading } = useAccountingGet<any>('/api/accounting/cogs-drivers', merged)

  if (isLoading) return <div className="rounded-lg border p-4 min-h-[300px] animate-pulse bg-muted/30">Loading COGS Drivers…</div>
  if (error) return <div className="rounded-lg border p-4 text-red-600">Failed to load COGS Drivers</div>

  if (view === 'ingredients' && data?.comingSoon) {
    return (
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">COGS Drivers</h2>
          <div className="inline-flex rounded-md border overflow-hidden text-sm">
            {(['products','ingredients'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-2 py-1 ${view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{v}</button>
            ))}
          </div>
        </div>
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Coming soon — requires ingredient-level recipe attribution.
        </div>
      </div>
    )
  }

  const top = Array.isArray(data?.top) ? data.top : []

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">COGS Drivers</h2>
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          {(['products','ingredients'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-2 py-1 ${view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{v}</button>
          ))}
        </div>
      </div>
      <div className="h-[220px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalCogs" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4 text-right">% of total</th>
              <th className="py-2 pr-0 text-right">Total COGS</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r:any) => (
              <tr key={r.name} className="border-b last:border-0">
                <td className="py-2 pr-4">{r.name}</td>
                <td className="py-2 pr-4 text-right">{Number(r.percentOfTotal || 0).toFixed(1)}%</td>
                <td className="py-2 pr-0 text-right">{currency(r.totalCogs)}</td>
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

