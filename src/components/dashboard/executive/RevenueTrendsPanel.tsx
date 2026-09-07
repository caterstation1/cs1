'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartCard,
  FormattedLegend,
  FormattedTooltip,
  axisTick,
  paddedDomain,
  withPartialSplit,
} from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { formatAxisTick } from '@/lib/format'

const PARTIAL_OPACITY = 0.45

export function RevenueTrendsPanel({ data }: { data?: any }) {
  const palette = useChartColors()

  const monthlyRevenue = data?.monthlyRevenue || []
  const monthlyOrders = data?.monthlyOrders || []
  const monthlyAov = useMemo(
    () => withPartialSplit(data?.monthlyAov || [], ['averageOrderValue']),
    [data?.monthlyAov]
  )
  const monthlyCompanies = useMemo(
    () => withPartialSplit(data?.monthlyActiveCompanies || [], ['activeCompanies', 'newCompanies', 'reactivatedCompanies']),
    [data?.monthlyActiveCompanies]
  )

  if (!data || data.notEnoughData) return null

  const aovValues = (data.monthlyAov || [])
    .map((row: any) => Number(row.averageOrderValue))
    .filter((v: number) => Number.isFinite(v) && v > 0)
  const aovDomain = paddedDomain(aovValues)

  const revenueColumns = [
    { key: 'month', label: 'Month' },
    { key: 'newRevenue', label: 'New', format: 'currency' as const },
    { key: 'returningRevenue', label: 'Returning', format: 'currency' as const },
    { key: 'revenue', label: 'Total', format: 'currency' as const },
  ]
  const ordersColumns = [
    { key: 'month', label: 'Month' },
    { key: 'newOrders', label: 'New', format: 'count' as const },
    { key: 'returningOrders', label: 'Returning', format: 'count' as const },
    { key: 'orders', label: 'Total', format: 'count' as const },
  ]
  const aovColumns = [
    { key: 'month', label: 'Month' },
    { key: 'averageOrderValue', label: 'Average order value', format: 'currency' as const },
  ]
  const companiesColumns = [
    { key: 'month', label: 'Month' },
    { key: 'activeCompanies', label: 'Active', format: 'count' as const },
    { key: 'newCompanies', label: 'New', format: 'count' as const },
    { key: 'reactivatedCompanies', label: 'Reactivated', format: 'count' as const },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard
        title="Monthly revenue (new vs returning)"
        subtitle="Lighter final bar = current month to date"
        data={monthlyRevenue}
        columns={revenueColumns}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
            <XAxis dataKey="month" tick={axisTick(palette.ink.axis)} />
            <YAxis tick={axisTick(palette.ink.axis)} tickFormatter={(v) => formatAxisTick(v, 'currency')} width={52} />
            <Tooltip content={<FormattedTooltip columns={revenueColumns} />} />
            <Legend content={<FormattedLegend />} />
            <Bar dataKey="newRevenue" stackId="a" name="New" fill={palette.semantic.newCompany}>
              {monthlyRevenue.map((row: any) => (
                <Cell key={row.month} fillOpacity={row.isPartial ? PARTIAL_OPACITY : 1} />
              ))}
            </Bar>
            <Bar dataKey="returningRevenue" stackId="a" name="Returning" fill={palette.semantic.returningCompany}>
              {monthlyRevenue.map((row: any) => (
                <Cell key={row.month} fillOpacity={row.isPartial ? PARTIAL_OPACITY : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Monthly orders (new vs returning)"
        subtitle="Lighter final bar = current month to date"
        data={monthlyOrders}
        columns={ordersColumns}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyOrders}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
            <XAxis dataKey="month" tick={axisTick(palette.ink.axis)} />
            <YAxis tick={axisTick(palette.ink.axis)} tickFormatter={(v) => formatAxisTick(v)} width={44} />
            <Tooltip content={<FormattedTooltip columns={ordersColumns} />} />
            <Legend content={<FormattedLegend />} />
            <Bar dataKey="newOrders" stackId="a" name="New" fill={palette.semantic.newCompany}>
              {monthlyOrders.map((row: any) => (
                <Cell key={row.month} fillOpacity={row.isPartial ? PARTIAL_OPACITY : 1} />
              ))}
            </Bar>
            <Bar dataKey="returningOrders" stackId="a" name="Returning" fill={palette.semantic.returningCompany}>
              {monthlyOrders.map((row: any) => (
                <Cell key={row.month} fillOpacity={row.isPartial ? PARTIAL_OPACITY : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Average order value over time"
        subtitle="Y-axis zoomed to the data range so month-to-month movement is visible; dashed tail = current month to date"
        data={data.monthlyAov || []}
        columns={aovColumns}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthlyAov}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
            <XAxis dataKey="month" tick={axisTick(palette.ink.axis)} />
            <YAxis
              domain={aovDomain}
              tick={axisTick(palette.ink.axis)}
              tickFormatter={(v) => formatAxisTick(v, 'currency')}
              width={52}
            />
            <Tooltip content={<FormattedTooltip columns={aovColumns} />} />
            <Line
              type="linear"
              dataKey="averageOrderValue"
              name="Average order value"
              stroke={palette.semantic.revenue}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="linear"
              dataKey="averageOrderValue__partial"
              name="AOV (month to date)"
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
        title="Active, new and reactivated companies"
        subtitle="Dashed tail = current month to date"
        data={data.monthlyActiveCompanies || []}
        columns={companiesColumns}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthlyCompanies}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
            <XAxis dataKey="month" tick={axisTick(palette.ink.axis)} />
            <YAxis tick={axisTick(palette.ink.axis)} tickFormatter={(v) => formatAxisTick(v)} width={44} />
            <Tooltip content={<FormattedTooltip columns={companiesColumns} />} />
            <Legend content={<FormattedLegend />} />
            {[
              { key: 'activeCompanies', name: 'Active', color: palette.semantic.revenue },
              { key: 'newCompanies', name: 'New', color: palette.semantic.newCompany },
              { key: 'reactivatedCompanies', name: 'Reactivated', color: palette.categorical[2] },
            ].map((series) => (
              <Line
                key={series.key}
                type="linear"
                dataKey={series.key}
                name={series.name}
                stroke={series.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
            ))}
            {['activeCompanies', 'newCompanies', 'reactivatedCompanies'].map((key, index) => (
              <Line
                key={`${key}__partial`}
                type="linear"
                dataKey={`${key}__partial`}
                stroke={[palette.semantic.revenue, palette.semantic.newCompany, palette.categorical[2]][index]}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeOpacity={0.7}
                dot={{ r: 2 }}
                legendType="none"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
