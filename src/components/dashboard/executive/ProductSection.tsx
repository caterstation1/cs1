'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatValue, formatAxisTick } from '@/lib/format'
import { KpiCard } from './primitives/KpiCard'
import { ChartCard, FormattedTooltip, axisTick, withPartialSplit } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { DataTable } from './primitives/DataTable'
import { CoPurchaseNetwork } from './CoPurchaseNetwork'

const PRODUCT_TABLE_COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'revenue', label: 'Revenue', format: 'currency' as const },
  { key: 'orders', label: 'Orders', format: 'count' as const },
  { key: 'averageOrderValueWhenIncluded', label: 'AOV when included', format: 'currency' as const },
  { key: 'repeatPurchaseRate', label: 'Repeat %', format: 'percent' as const },
]

function ProductTable({ title, rows, limit = 10 }: { title: string; rows: any[]; limit?: number }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <DataTable
          columns={PRODUCT_TABLE_COLUMNS}
          rows={(rows || []).slice(0, limit)}
          rowKey={(row: any) => row.product}
          emptyMessage="No qualifying products."
        />
      </CardContent>
    </Card>
  )
}

export function ProductSection({ data }: { data?: any }) {
  const palette = useChartColors()
  const [showFullRanking, setShowFullRanking] = useState(false)

  const revenueTrend = useMemo(
    () => withPartialSplit(data?.productRevenueTrend || [], ['revenue']),
    [data?.productRevenueTrend]
  )

  const topProductsData = useMemo(() => {
    const metrics: any[] = Array.isArray(data?.productMetrics) ? data.productMetrics : []
    const top = metrics.slice(0, 10).map((row) => ({ name: row.product, revenue: Number(row.revenue || 0) }))
    const rest = metrics.slice(10)
    if (rest.length) {
      top.push({
        name: `Other (${rest.length})`,
        revenue: rest.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
      })
    }
    return top
  }, [data?.productMetrics])

  const repeatRateRanking: any[] = Array.isArray(data?.repeatRateRanking) ? data.repeatRateRanking : []
  const repeatChartData = useMemo(() => {
    if (repeatRateRanking.length <= 16) {
      return repeatRateRanking.map((row) => ({ name: row.product, repeatPurchaseRate: row.repeatPurchaseRate }))
    }
    const top = repeatRateRanking.slice(0, 8)
    const bottom = repeatRateRanking.slice(-8)
    return [...top, ...bottom].map((row) => ({ name: row.product, repeatPurchaseRate: row.repeatPurchaseRate }))
  }, [repeatRateRanking])

  const productRevenueMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of data?.productMetrics || []) {
      map.set(row.product, Number(row.revenue || 0))
    }
    return map
  }, [data?.productMetrics])

  if (!data || data.notEnoughData) return null

  const trendColumns = [
    { key: 'month', label: 'Month' },
    { key: 'revenue', label: 'Revenue', format: 'currency' as const },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Products tracked" value={data.summary.totalProducts} format="count" size="compact" />
        <KpiCard label="Revenue" value={data.summary.totalRevenue} format="currencyCompact" size="compact" />
        <KpiCard label="Orders" value={data.summary.totalOrders} format="count" size="compact" />
        <KpiCard label="Overall AOV" value={data.summary.averageOrderValueOverall} format="currency" size="compact" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Revenue trend over time"
          subtitle="Dashed tail = current month to date"
          data={data.productRevenueTrend || []}
          columns={trendColumns}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
              <XAxis dataKey="month" tick={axisTick(palette.ink.axis)} />
              <YAxis
                tick={axisTick(palette.ink.axis)}
                tickFormatter={(v) => formatAxisTick(v, 'currency')}
                width={52}
              />
              <Tooltip content={<FormattedTooltip columns={trendColumns} />} />
              <Line
                type="linear"
                dataKey="revenue"
                name="Revenue"
                stroke={palette.semantic.revenue}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="linear"
                dataKey="revenue__partial"
                stroke={palette.semantic.revenue}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeOpacity={0.7}
                dot={{ r: 2 }}
                legendType="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top products by revenue"
          subtitle="Top 10 products; remaining products rolled into Other"
          data={topProductsData}
          columns={[
            { key: 'name', label: 'Product' },
            { key: 'revenue', label: 'Revenue', format: 'currency' },
          ]}
          height={Math.max(288, topProductsData.length * 30 + 30)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProductsData} layout="vertical" margin={{ left: 8, right: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={axisTick(palette.ink.axis)}
                tickFormatter={(v) => formatValue(v, 'currencyCompact')}
              />
              <YAxis type="category" dataKey="name" width={180} tick={{ ...axisTick(palette.ink.axis), fontSize: 11 }} />
              <Tooltip
                content={<FormattedTooltip columns={[{ key: 'revenue', label: 'Revenue', format: 'currency' }]} />}
              />
              <Bar dataKey="revenue" name="Revenue" fill={palette.semantic.revenue}>
                <LabelList
                  dataKey="revenue"
                  position="right"
                  formatter={(value: number) => formatValue(value, 'currencyCompact')}
                  style={{ fontSize: 11, fill: palette.ink.axis }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProductTable title="Hero products" rows={data.heroProducts} />
        <ProductTable title="Fastest growing products" rows={data.fastestGrowingProducts} />
        <ProductTable title="Products increasing AOV" rows={data.productsIncreasingAov} />
        <ProductTable title="Underperforming products" rows={data.underperformingProducts} />
      </div>

      <div className="space-y-3">
        <ChartCard
          title="Menu repeat rate — best and worst"
          subtitle="Top 8 and bottom 8 products by repeat purchase rate (min. order/revenue thresholds applied)"
          data={repeatChartData}
          columns={[
            { key: 'name', label: 'Product' },
            { key: 'repeatPurchaseRate', label: 'Repeat %', format: 'percent' },
          ]}
          height={Math.max(288, repeatChartData.length * 28 + 30)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={repeatChartData} layout="vertical" margin={{ left: 8, right: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={axisTick(palette.ink.axis)}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis type="category" dataKey="name" width={180} tick={{ ...axisTick(palette.ink.axis), fontSize: 11 }} />
              <Tooltip
                content={
                  <FormattedTooltip columns={[{ key: 'repeatPurchaseRate', label: 'Repeat %', format: 'percent' }]} />
                }
              />
              <Bar dataKey="repeatPurchaseRate" name="Repeat %" fill={palette.categorical[3]}>
                <LabelList
                  dataKey="repeatPurchaseRate"
                  position="right"
                  formatter={(value: number) => formatValue(value, 'percent')}
                  style={{ fontSize: 11, fill: palette.ink.axis }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div>
          <Button variant="outline" size="sm" onClick={() => setShowFullRanking((prev) => !prev)}>
            {showFullRanking ? 'Hide full ranking' : `Show full ranking (${repeatRateRanking.length} products)`}
          </Button>
        </div>
        {showFullRanking ? (
          <ProductTable title="Full menu repeat ranking" rows={repeatRateRanking} limit={repeatRateRanking.length} />
        ) : null}
      </div>

      <CoPurchaseNetwork pairs={data.commonlyBoughtTogether} productRevenue={productRevenueMap} />
    </div>
  )
}
