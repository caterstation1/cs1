'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatValue, formatAxisTick } from '@/lib/format'
import { KpiCard } from './primitives/KpiCard'
import { AsyncSection } from './primitives/AsyncSection'
import { ChartCard, FormattedLegend, FormattedTooltip, axisTick } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'

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

function KpiGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

export function OperationsSummarySection() {
  const palette = useChartColors()
  const [preset, setPreset] = useState('this_week')
  const [region, setRegion] = useState('all')
  const [loading, setLoading] = useState(true)
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

  const csvQuery = (() => {
    const params = new URLSearchParams({ preset, format: 'csv' })
    if (region === 'AKL' || region === 'WLG') params.set('region', region)
    return params.toString()
  })()

  const dailySeries: any[] = Array.isArray(data?.dailySeries) ? data.dailySeries : []
  const dailyColumns = [
    { key: 'date', label: 'Date' },
    { key: 'revenue', label: 'Revenue', format: 'currency' as const },
    { key: 'cogs', label: 'COGS', format: 'currency' as const },
    { key: 'labourCost', label: 'Labour', format: 'currency' as const },
    { key: 'deliveryCost', label: 'Delivery', format: 'currency' as const },
    { key: 'netProfit', label: 'Net profit', format: 'currency' as const },
  ]
  const coveragePct = kpis?.cogsCoveragePct

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Period">{PRESETS.find(p => p.value === preset)?.label || preset}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Region">{REGIONS.find(r => r.value === region)?.label || region}</SelectValue>
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
        <Button asChild variant="outline" size="sm">
          <a href={`/api/dashboard/operations-summary?${csvQuery}`}>Download CSV (all)</a>
        </Button>
        {data?.params ? (
          <span className="text-xs text-muted-foreground">
            Delivery days {data.params.startDate} to {data.params.endDate}
          </span>
        ) : null}
      </div>

      <AsyncSection loading={loading} error={error} isEmpty={!kpis} onRetry={load} skeletonHeight={280}>
        {kpis ? (
          <div className="space-y-4">
            <KpiGroup title="Output">
              <KpiCard label="Deliveries" value={kpis.deliveries} format="count" size="compact" />
              <KpiCard label="Items out the door" value={kpis.itemsOut} format="count" size="compact" />
              <KpiCard label="Delivered revenue" value={kpis.revenue} format="currencyCompact" size="compact" />
              <KpiCard label="Avg order value" value={kpis.avgOrderValue} format="currency" size="compact" />
            </KpiGroup>
            <KpiGroup title="Costs">
              <KpiCard
                label="COGS (components)"
                value={kpis.cogs}
                format="currencyCompact"
                size="compact"
                footnote={
                  coveragePct != null && coveragePct < 100
                    ? `Costs understated — ${formatValue(coveragePct, 'percent')} coverage`
                    : undefined
                }
              />
              <KpiCard
                label="Ops labour"
                value={kpis.labourCost}
                format="currencyCompact"
                size="compact"
                footnote={`${formatValue(kpis.labourHours, 'hours')}`}
              />
              <KpiCard label="Delivery cost" value={kpis.deliveryCost} format="currencyCompact" size="compact" />
              <KpiCard
                label="Admin/overhead labour"
                value={kpis.adminLabourCost}
                format="currencyCompact"
                size="compact"
                footnote={`${formatValue(kpis.adminLabourHours, 'hours')} — excluded from net`}
              />
            </KpiGroup>
            <KpiGroup title="Profit">
              <KpiCard
                label="Gross profit"
                value={kpis.grossProfit}
                format="currencyCompact"
                size="compact"
                footnote={`Margin ${formatValue(kpis.grossMarginPct, 'percent')}`}
              />
              <KpiCard
                label="Net operational profit"
                value={kpis.netOperationalProfit}
                format="currencyCompact"
                size="compact"
                footnote={`Margin ${formatValue(kpis.netOperationalMarginPct, 'percent')}`}
              />
            </KpiGroup>
            <KpiGroup title="Efficiency">
              <KpiCard label="Labour % of revenue" value={kpis.labourPctOfRevenue} format="percent" size="compact" />
              <KpiCard label="Revenue / labour hour" value={kpis.revenuePerLabourHour} format="currency" size="compact" />
              <KpiCard label="Deliveries / labour hour" value={kpis.deliveriesPerLabourHour} format="count" size="compact" />
              <KpiCard label="Cost / delivery" value={kpis.costPerDelivery} format="currency" size="compact" />
            </KpiGroup>

            {Array.isArray(data?.regionBreakdown) && data.regionBreakdown.length > 1 ? (
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">Region breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    {data.regionBreakdown.map((r: any) => (
                      <div key={r.region} className="rounded-md border p-3 space-y-1">
                        <p className="font-medium">{r.region === 'AKL' ? 'Auckland' : r.region === 'WLG' ? 'Wellington' : 'Other'}</p>
                        <p className="text-muted-foreground">
                          {formatValue(r.deliveries, 'count')} deliveries · {formatValue(r.items, 'count')} items
                        </p>
                        <p className="text-muted-foreground">
                          Revenue {formatValue(r.revenue, 'currencyCompact')} · COGS {formatValue(r.cogs, 'currencyCompact')}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {dailySeries.length > 1 ? (
              <ChartCard
                title="Daily revenue vs costs"
                subtitle="Stacked daily costs with revenue overlay; net profit per day below"
                badge={
                  coveragePct != null && coveragePct < 100 ? (
                    <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300">
                      ⚠ Costs understated — {formatValue(coveragePct, 'percent')} COGS coverage
                    </Badge>
                  ) : null
                }
                data={dailySeries}
                columns={dailyColumns}
                height={400}
              >
                <div className="flex h-full flex-col">
                  <div className="flex-[3] min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dailySeries} syncId="ops-daily" barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
                        <XAxis dataKey="date" tick={axisTick(palette.ink.axis)} hide />
                        <YAxis
                          tick={axisTick(palette.ink.axis)}
                          tickFormatter={(v) => formatAxisTick(v, 'currency')}
                          width={52}
                        />
                        <Tooltip content={<FormattedTooltip columns={dailyColumns} />} />
                        <Legend content={<FormattedLegend />} verticalAlign="top" />
                        <Bar dataKey="cogs" stackId="cost" name="COGS" fill={palette.semantic.cogs} />
                        <Bar dataKey="labourCost" stackId="cost" name="Labour" fill={palette.semantic.labour} />
                        <Bar dataKey="deliveryCost" stackId="cost" name="Delivery" fill={palette.semantic.delivery} />
                        <Line
                          type="linear"
                          dataKey="revenue"
                          name="Revenue"
                          stroke={palette.semantic.revenue}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-[1.4] min-h-0 border-t pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailySeries} syncId="ops-daily" barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
                        <XAxis dataKey="date" tick={axisTick(palette.ink.axis)} />
                        <YAxis
                          tick={axisTick(palette.ink.axis)}
                          tickFormatter={(v) => formatAxisTick(v, 'currency')}
                          width={52}
                        />
                        <Tooltip
                          content={
                            <FormattedTooltip columns={[{ key: 'netProfit', label: 'Net profit', format: 'currency' }]} />
                          }
                        />
                        <ReferenceLine y={0} stroke={palette.ink.axis} />
                        <Bar dataKey="netProfit" name="Net profit">
                          {dailySeries.map((row: any) => (
                            <Cell
                              key={row.date}
                              fill={Number(row.netProfit) >= 0 ? palette.status.good : palette.status.serious}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </ChartCard>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Based on delivery date (what went out the door), so figures differ from the order-date sales summary above.
              Labour is bucketed by shift day company-wide{data?.params?.region ? ' and is not filtered by region' : ''};
              admin/overhead staff are excluded from net operational profit.
            </p>
          </div>
        ) : (
          <div />
        )}
      </AsyncSection>
    </div>
  )
}
