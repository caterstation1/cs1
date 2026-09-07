'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatValue, formatAxisTick } from '@/lib/format'
import { KpiCard } from './primitives/KpiCard'
import { ChartCard, FormattedLegend, FormattedTooltip, axisTick } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { DataTable } from './primitives/DataTable'

const PARTIAL_OPACITY = 0.45

export function CustomerSection({ data }: { data?: any }) {
  const palette = useChartColors()
  if (!data || data.notEnoughData) return null

  const m = data.metrics
  const monthly = data.charts.newVsReturningRevenue || []
  const monthlyColumns = [
    { key: 'month', label: 'Month' },
    { key: 'newRevenue', label: 'New', format: 'currency' as const },
    { key: 'returningRevenue', label: 'Returning', format: 'currency' as const },
    { key: 'totalRevenue', label: 'Total', format: 'currency' as const },
  ]
  const orderNumberColumns = [
    { key: 'segment', label: 'Order number' },
    { key: 'revenue', label: 'Revenue', format: 'currency' as const },
    { key: 'orders', label: 'Orders', format: 'count' as const },
    { key: 'averageOrderValue', label: 'AOV', format: 'currency' as const },
  ]
  const frequencyColumns = [
    { key: 'bucket', label: 'Orders placed' },
    { key: 'count', label: 'Customers', format: 'count' as const },
  ]
  const ltvColumns = [
    { key: 'bucket', label: 'Lifetime value' },
    { key: 'customers', label: 'Customers', format: 'count' as const },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Customer metrics (secondary to company metrics)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <KpiCard label="Total customers" value={m.totalCustomers} format="count" size="compact" />
          <KpiCard label="New customers" value={m.newCustomers} format="count" size="compact" />
          <KpiCard label="Returning customers" value={m.returningCustomers} format="count" size="compact" />
          <KpiCard label="Avg orders/customer (all time)" value={m.averageOrdersPerCustomerAllTime} format="count" size="compact" />
          <KpiCard label="Avg orders/customer (12m)" value={m.averageOrdersPerCustomer12m} format="count" size="compact" />
          <KpiCard label="Average customer LTV" value={m.averageCustomerLifetimeValue} format="currency" size="compact" />
          <KpiCard label="Median customer LTV" value={m.medianCustomerLifetimeValue} format="currency" size="compact" />
          <KpiCard label="Repeat purchase rate" value={m.customerRepeatPurchaseRate} format="percent" size="compact" />
          <KpiCard label="Revenue from returning" value={m.revenueFromReturningCustomers} format="currencyCompact" size="compact" />
          <KpiCard label="Avg days between orders" value={m.averageDaysBetweenCustomerOrders} format="days" size="compact" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="New vs returning customer revenue"
          subtitle="Lighter final bar = current month to date"
          data={monthly}
          columns={monthlyColumns}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
              <XAxis dataKey="month" tick={axisTick(palette.ink.axis)} />
              <YAxis
                tick={axisTick(palette.ink.axis)}
                tickFormatter={(v) => formatAxisTick(v, 'currency')}
                width={52}
              />
              <Tooltip content={<FormattedTooltip columns={monthlyColumns} />} />
              <Legend content={<FormattedLegend />} />
              <Bar dataKey="newRevenue" stackId="a" name="New" fill={palette.semantic.newCompany}>
                {monthly.map((row: any) => (
                  <Cell key={row.month} fillOpacity={row.isPartial ? PARTIAL_OPACITY : 1} />
                ))}
              </Bar>
              <Bar dataKey="returningRevenue" stackId="a" name="Returning" fill={palette.semantic.returningCompany}>
                {monthly.map((row: any) => (
                  <Cell key={row.month} fillOpacity={row.isPartial ? PARTIAL_OPACITY : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Revenue by customer order number"
          data={data.charts.revenueByOrderNumber || []}
          columns={orderNumberColumns}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.revenueByOrderNumber}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
              <XAxis dataKey="segment" tick={axisTick(palette.ink.axis)} />
              <YAxis
                tick={axisTick(palette.ink.axis)}
                tickFormatter={(v) => formatAxisTick(v, 'currency')}
                width={52}
              />
              <Tooltip content={<FormattedTooltip columns={orderNumberColumns} />} />
              <Bar dataKey="revenue" name="Revenue" fill={palette.semantic.revenue} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Customer order frequency distribution"
          data={data.charts.orderFrequencyDistribution || []}
          columns={frequencyColumns}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.orderFrequencyDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
              <XAxis dataKey="bucket" tick={axisTick(palette.ink.axis)} />
              <YAxis tick={axisTick(palette.ink.axis)} tickFormatter={(v) => formatAxisTick(v)} width={44} />
              <Tooltip content={<FormattedTooltip columns={frequencyColumns} />} />
              <Bar dataKey="count" name="Customers" fill={palette.categorical[1]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">
              Top customers by revenue (top {data.topCustomerLimit || 25})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <DataTable
              columns={[
                {
                  key: 'contact',
                  label: 'Customer',
                  render: (row: any) => (
                    <span>
                      {row.contact || row.customerId}
                      {row.companyName ? <span className="text-muted-foreground"> · {row.companyName}</span> : null}
                    </span>
                  ),
                },
                { key: 'revenue', label: 'Revenue', format: 'currency' },
                { key: 'orders', label: 'Orders', format: 'count' },
                { key: 'averageOrderValue', label: 'AOV', format: 'currency' },
              ]}
              rows={data.charts.topCustomers || []}
              rowKey={(row: any) => row.customerId}
              maxHeight={420}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Customer LTV distribution"
          data={data.charts.ltvDistribution || []}
          columns={ltvColumns}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.ltvDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
              <XAxis dataKey="bucket" tick={axisTick(palette.ink.axis)} />
              <YAxis tick={axisTick(palette.ink.axis)} tickFormatter={(v) => formatAxisTick(v)} width={44} />
              <Tooltip content={<FormattedTooltip columns={ltvColumns} />} />
              <Bar dataKey="customers" name="Customers" fill={palette.categorical[3]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardContent className="p-6 flex h-full flex-col justify-center">
            <p className="text-sm text-muted-foreground">Average days: 1st to 2nd customer order</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {formatValue(data.charts.timeBetweenFirstAndSecondOrder, 'days')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
