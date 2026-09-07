'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { KpiCard } from './primitives/KpiCard'
import { ChartCard, FormattedTooltip, axisTick } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { ValueFormat, formatValue } from '@/lib/format'

interface CardMeta {
  deltaPct: number | null
  sparkline: number[] | null
}

export interface ExecutiveSummaryData {
  cards?: Record<string, unknown>
  cardMeta?: Record<string, CardMeta>
  concentration?: {
    curve: Array<{ rank: number; cumulativePct: number; companyName?: string }>
    companiesWithRevenue: number
    top10Pct: number
    top25Pct: number
  }
  validationChecks?: Array<{ id: string; level: 'warning' | 'error'; message: string }>
}

interface CardSpec {
  key: string
  label: string
  format: ValueFormat
  deltaDirectionGood?: 'up' | 'down'
  footnote?: string
}

const HERO_CARDS: CardSpec[] = [
  { key: 'totalRevenue', label: 'Total revenue', format: 'currencyCompact' },
  { key: 'totalOrders', label: 'Total orders', format: 'count' },
  { key: 'averageOrderValue', label: 'Average order value', format: 'currency' },
  { key: 'repeatCompanyRevenuePct', label: 'Repeat company revenue', format: 'percent' },
]

const GROUPS: Array<{ title: string; cards: CardSpec[] }> = [
  {
    title: 'Revenue',
    cards: [
      { key: 'averageRevenuePerCompany', label: 'Avg revenue / company', format: 'currency' },
      { key: 'medianRevenuePerCompany', label: 'Median revenue / company', format: 'currency' },
      { key: 'revenueFromReturningCompanies', label: 'Revenue from returning', format: 'currencyCompact' },
      {
        key: 'privateRevenueSharePct',
        label: 'Private/unmatched share',
        format: 'percent',
        deltaDirectionGood: 'down',
      },
    ],
  },
  {
    title: 'Companies',
    cards: [
      { key: 'activeCompanies', label: 'Active companies', format: 'count' },
      { key: 'newCompanies', label: 'New companies', format: 'count' },
      { key: 'returningCompanies', label: 'Returning companies', format: 'count' },
      { key: 'companyLifetimeValue', label: 'Company lifetime value', format: 'currency' },
    ],
  },
  {
    title: 'Retention',
    cards: [
      { key: 'averageOrdersPerCompanyAllTime', label: 'Avg orders / company (all time)', format: 'count' },
      { key: 'averageOrdersPerCompany12m', label: 'Avg orders / company (12m)', format: 'count' },
      {
        key: 'averageDaysBetweenCompanyOrders',
        label: 'Avg days between orders',
        format: 'days',
        deltaDirectionGood: 'down',
      },
    ],
  },
  {
    title: 'Risk',
    cards: [
      { key: 'atRiskCompanies', label: 'At-risk companies', format: 'count', deltaDirectionGood: 'down' },
      { key: 'lapsedCompanies', label: 'Lapsed companies', format: 'count', deltaDirectionGood: 'down' },
    ],
  },
]

function AlertCard({ level, message }: { level: 'warning' | 'error'; message: string }) {
  const isError = level === 'error'
  return (
    <div
      role="alert"
      className={
        isError
          ? 'flex items-start gap-2 rounded-md border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3'
          : 'flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3'
      }
    >
      <span aria-hidden className={isError ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}>
        {isError ? '⛔' : '⚠️'}
      </span>
      <div>
        <p
          className={
            isError
              ? 'text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300'
              : 'text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300'
          }
        >
          {isError ? 'Data error' : 'Warning'}
        </p>
        <p className="text-sm text-foreground/90">{message}</p>
      </div>
    </div>
  )
}

export function ExecutiveKpiGrid({ summary }: { summary?: ExecutiveSummaryData }) {
  const palette = useChartColors()
  const cards = summary?.cards
  const cardMeta = summary?.cardMeta || {}
  const concentration = summary?.concentration

  const paretoData = useMemo(() => {
    if (!concentration?.curve?.length) return []
    const total = concentration.curve[concentration.curve.length - 1]?.rank || 1
    return concentration.curve.map((point) => ({
      ...point,
      evenSharePct: Number(((point.rank / total) * 100).toFixed(2)),
    }))
  }, [concentration])

  if (!cards) return null

  const renderCard = (spec: CardSpec, size: 'hero' | 'compact') => {
    const meta = cardMeta[spec.key]
    return (
      <KpiCard
        key={spec.key}
        label={spec.label}
        value={cards[spec.key]}
        format={spec.format}
        size={size}
        deltaPct={meta?.deltaPct ?? null}
        deltaDirectionGood={spec.deltaDirectionGood || 'up'}
        sparklineData={size === 'hero' ? meta?.sparkline : null}
        footnote={spec.footnote}
      />
    )
  }

  const top25 = concentration?.top25Pct ?? null
  const concentrationInsight =
    top25 != null
      ? `Top 25 companies = ${formatValue(top25, 'percent')} of revenue — ${
          top25 >= 60 ? 'high' : top25 >= 35 ? 'moderate' : 'low'
        } concentration risk`
      : undefined

  return (
    <div className="space-y-4">
      {Array.isArray(summary?.validationChecks) && summary.validationChecks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {summary.validationChecks.map((check) => (
            <AlertCard key={check.id} level={check.level} message={check.message} />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {HERO_CARDS.map((spec) => renderCard(spec, 'hero'))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
        {GROUPS.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              {group.cards.map((spec) => renderCard(spec, 'compact'))}
            </div>
          </div>
        ))}
      </div>

      {paretoData.length > 1 ? (
        <ChartCard
          title="Revenue concentration"
          subtitle="Companies ranked by period revenue vs cumulative share of revenue"
          insight={concentrationInsight}
          data={paretoData}
          columns={[
            { key: 'rank', label: 'Company rank', format: 'count' },
            { key: 'cumulativePct', label: 'Cumulative revenue %', format: 'percent' },
          ]}
          height={280}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={paretoData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
              <XAxis
                dataKey="rank"
                type="number"
                domain={[1, 'dataMax']}
                tick={axisTick(palette.ink.axis)}
                label={{
                  value: 'Companies (ranked by revenue)',
                  position: 'insideBottom',
                  offset: -2,
                  fontSize: 11,
                  fill: palette.ink.axis,
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={axisTick(palette.ink.axis)}
                tickFormatter={(v) => `${v}%`}
                width={44}
              />
              <Tooltip
                content={
                  <FormattedTooltip
                    columns={[
                      { key: 'cumulativePct', label: 'Cumulative revenue %', format: 'percent' },
                      { key: 'evenSharePct', label: 'Even distribution', format: 'percent' },
                    ]}
                  />
                }
              />
              <Line
                type="linear"
                dataKey="cumulativePct"
                name="Cumulative revenue %"
                stroke={palette.semantic.revenue}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="linear"
                dataKey="evenSharePct"
                name="Even distribution"
                stroke={palette.ink.axis}
                strokeDasharray="4 4"
                strokeWidth={1}
                dot={false}
              />
              {[
                { rank: 10, pct: concentration?.top10Pct },
                { rank: 25, pct: concentration?.top25Pct },
              ]
                .filter((marker) => marker.pct != null && paretoData.some((p) => p.rank >= marker.rank))
                .map((marker) => (
                  <ReferenceDot
                    key={marker.rank}
                    x={marker.rank}
                    y={marker.pct as number}
                    r={4}
                    fill={palette.semantic.revenue}
                    stroke="var(--card)"
                    label={{
                      value: `Top ${marker.rank}: ${formatValue(marker.pct, 'percent')}`,
                      position: 'top',
                      fontSize: 11,
                      fill: palette.ink.axis,
                    }}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  )
}
