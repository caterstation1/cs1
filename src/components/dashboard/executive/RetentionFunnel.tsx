'use client'

import { useMemo } from 'react'
import { ChartCard } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { formatValue } from '@/lib/format'

interface FrequencyBucket {
  bucket: string
  companies: number
  revenue: number
  averageCompanyRevenue: number
  revenuePct: number
}

/**
 * D2: order-frequency distribution re-presented as a funnel emphasising
 * drop-off between stages, with conversion labels between stages.
 */
export function RetentionFunnel({ buckets }: { buckets?: FrequencyBucket[] }) {
  const palette = useChartColors()

  const stages = useMemo(() => {
    if (!buckets?.length) return []
    const count = (label: string) => buckets.find((b) => b.bucket === label)?.companies || 0
    const c1 = count('1 order')
    const c23 = count('2-3 orders')
    const c49 = count('4-9 orders')
    const c10 = count('10+ orders')
    const ge1 = c1 + c23 + c49 + c10
    const ge2 = c23 + c49 + c10
    const ge4 = c49 + c10
    const ge10 = c10
    return [
      { label: 'Placed 1+ orders', companies: ge1 },
      { label: 'Placed 2+ orders', companies: ge2 },
      { label: 'Placed 4+ orders', companies: ge4 },
      { label: 'Placed 10+ orders', companies: ge10 },
    ].map((stage, index, list) => ({
      ...stage,
      conversionPct: index === 0 ? null : list[index - 1].companies > 0 ? (stage.companies / list[index - 1].companies) * 100 : 0,
    }))
  }, [buckets])

  if (!stages.length) return null

  const max = Math.max(1, stages[0].companies)
  const ordinal = ['', '2nd', '4th', '10th']

  return (
    <ChartCard
      title="Retention funnel"
      subtitle="How many companies keep ordering — conversion between stages"
      data={stages.map((stage) => ({
        stage: stage.label,
        companies: stage.companies,
        conversionPct: stage.conversionPct,
      }))}
      columns={[
        { key: 'stage', label: 'Stage' },
        { key: 'companies', label: 'Companies', format: 'count' },
        { key: 'conversionPct', label: 'Conversion from prior stage', format: 'percent' },
      ]}
      height={288}
    >
      <div className="flex h-full flex-col justify-center gap-0.5">
        {stages.map((stage, index) => {
          const widthPct = Math.max(6, (stage.companies / max) * 100)
          return (
            <div key={stage.label}>
              {index > 0 ? (
                <p className="py-0.5 text-center text-[11px] text-muted-foreground">
                  {formatValue(stage.conversionPct, 'percent')} place a {ordinal[index]} order
                </p>
              ) : null}
              <div className="relative flex items-center justify-center">
                <div
                  className="flex h-11 items-center justify-center rounded-sm text-xs font-medium text-white"
                  style={{
                    width: `${widthPct}%`,
                    background: palette.sequential[Math.min(palette.sequential.length - 1, 4 + index)],
                  }}
                  title={`${stage.label}: ${formatValue(stage.companies, 'count')} companies`}
                >
                  {widthPct >= 30 ? (
                    <span className="px-2 truncate">
                      {stage.label} · {formatValue(stage.companies, 'count')}
                    </span>
                  ) : null}
                </div>
                {widthPct < 30 ? (
                  <span
                    className="absolute whitespace-nowrap text-xs font-medium text-foreground"
                    style={{ left: `calc(50% + ${widthPct / 2}%)`, paddingLeft: 8 }}
                  >
                    {stage.label} · {formatValue(stage.companies, 'count')}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
