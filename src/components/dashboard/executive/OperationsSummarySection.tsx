'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
]

const REGIONS = [
  { value: 'all', label: 'All regions' },
  { value: 'AKL', label: 'Auckland' },
  { value: 'WLG', label: 'Wellington' },
]

function fmtCurrency(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 })
}

function fmtNumber(value: unknown, dp = 0): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('en-NZ', { maximumFractionDigits: dp })
}

function fmtPct(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toLocaleString('en-NZ', { maximumFractionDigits: 1 })}%`
}

type KpiCard = { label: string; value: string; sub?: string }

function KpiGroup({ title, cards }: { title: string; cards: KpiCard[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{card.value}</p>
              {card.sub ? <p className="text-xs text-muted-foreground">{card.sub}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function OperationsSummarySection() {
  const [preset, setPreset] = useState('this_week')
  const [region, setRegion] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ preset })
      if (region === 'AKL' || region === 'WLG') params.set('region', region)
      const response = await fetch(`/api/dashboard/operations-summary?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load operations summary')
      setData(await response.json())
    } catch (e: any) {
      setError(e?.message || 'Failed to load operations summary')
    } finally {
      setLoading(false)
    }
  }, [preset, region])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = data?.kpis

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
        {data?.params ? (
          <span className="text-xs text-muted-foreground">
            Delivery days {data.params.startDate} to {data.params.endDate}
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {kpis ? (
        <>
          <KpiGroup
            title="Output"
            cards={[
              { label: 'Deliveries', value: fmtNumber(kpis.deliveries) },
              { label: 'Items out the door', value: fmtNumber(kpis.itemsOut) },
              { label: 'Delivered revenue', value: fmtCurrency(kpis.revenue) },
              { label: 'Avg order value', value: fmtCurrency(kpis.avgOrderValue) },
            ]}
          />
          <KpiGroup
            title="Costs"
            cards={[
              { label: 'COGS (components)', value: fmtCurrency(kpis.cogs), sub: `Coverage ${fmtPct(kpis.cogsCoveragePct)}` },
              { label: 'Ops labour', value: fmtCurrency(kpis.labourCost), sub: `${fmtNumber(kpis.labourHours, 1)} hrs` },
              { label: 'Delivery cost', value: fmtCurrency(kpis.deliveryCost) },
              { label: 'Admin/overhead labour', value: fmtCurrency(kpis.adminLabourCost), sub: `${fmtNumber(kpis.adminLabourHours, 1)} hrs — excluded from net` },
            ]}
          />
          <KpiGroup
            title="Profit"
            cards={[
              { label: 'Gross profit', value: fmtCurrency(kpis.grossProfit), sub: `Margin ${fmtPct(kpis.grossMarginPct)}` },
              { label: 'Net operational profit', value: fmtCurrency(kpis.netOperationalProfit), sub: `Margin ${fmtPct(kpis.netOperationalMarginPct)}` },
            ]}
          />
          <KpiGroup
            title="Efficiency"
            cards={[
              { label: 'Labour % of revenue', value: fmtPct(kpis.labourPctOfRevenue) },
              { label: 'Revenue / labour hour', value: fmtCurrency(kpis.revenuePerLabourHour) },
              { label: 'Deliveries / labour hour', value: fmtNumber(kpis.deliveriesPerLabourHour, 2) },
              { label: 'Cost / delivery', value: fmtCurrency(kpis.costPerDelivery) },
            ]}
          />

          {Array.isArray(data?.regionBreakdown) && data.regionBreakdown.length > 1 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Region breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  {data.regionBreakdown.map((r: any) => (
                    <div key={r.region} className="rounded-md border p-3 space-y-1">
                      <p className="font-medium">{r.region === 'AKL' ? 'Auckland' : r.region === 'WLG' ? 'Wellington' : 'Other'}</p>
                      <p className="text-muted-foreground">
                        {fmtNumber(r.deliveries)} deliveries · {fmtNumber(r.items)} items
                      </p>
                      <p className="text-muted-foreground">
                        Revenue {fmtCurrency(r.revenue)} · COGS {fmtCurrency(r.cogs)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {Array.isArray(data?.dailySeries) && data.dailySeries.length > 1 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily revenue vs costs</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => fmtCurrency(value)} />
                    <Legend />
                    <Bar dataKey="cogs" stackId="cost" name="COGS" fill="#f59e0b" />
                    <Bar dataKey="labourCost" stackId="cost" name="Labour" fill="#ef4444" />
                    <Bar dataKey="deliveryCost" stackId="cost" name="Delivery" fill="#a855f7" />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} />
                    <Line type="monotone" dataKey="netProfit" name="Net profit" stroke="#16a34a" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Based on delivery date (what went out the door), so figures differ from the order-date sales summary above.
            COGS coverage {fmtPct(kpis.cogsCoveragePct)} of revenue has component costs — treat COGS as understated below ~100%.
            Labour is bucketed by shift day company-wide{data?.params?.region ? ' and is not filtered by region' : ''}; admin/overhead staff are excluded from net operational profit.
          </p>
        </>
      ) : !loading && !error ? (
        <p className="text-sm text-muted-foreground">Not enough data yet</p>
      ) : null}
    </div>
  )
}
