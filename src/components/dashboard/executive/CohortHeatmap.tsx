'use client'

import { Fragment, useMemo } from 'react'
import { ChartCard } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { formatValue } from '@/lib/format'

interface CohortCell {
  offset: number
  count: number
  pct: number
}

export interface CohortRetentionData {
  maxOffset: number
  rows: Array<{ cohort: string; size: number; cells: Array<CohortCell | null> }>
}

/**
 * D1: acquisition month (rows) x months since first order (columns);
 * cell = % of the cohort that ordered again in that month. Single-hue
 * sequential scale — darker always means more.
 */
export function CohortHeatmap({ data }: { data?: CohortRetentionData }) {
  const palette = useChartColors()
  const rows = data?.rows || []
  const maxOffset = data?.maxOffset || 11

  const tableRows = useMemo(
    () =>
      rows.map((row) => {
        const out: Record<string, unknown> = { cohort: row.cohort, size: row.size }
        row.cells.forEach((cell, index) => {
          out[`m${index + 1}`] = cell ? cell.pct : null
        })
        return out
      }),
    [rows]
  )

  if (!rows.length) return null

  const columns = [
    { key: 'cohort', label: 'Cohort' },
    { key: 'size', label: 'Companies', format: 'count' as const },
    ...Array.from({ length: maxOffset }, (_, index) => ({
      key: `m${index + 1}`,
      label: `+${index + 1}m`,
      format: 'percent' as const,
    })),
  ]

  const maxPct = Math.max(1, ...rows.flatMap((row) => row.cells.map((cell) => cell?.pct || 0)))
  const colorFor = (pct: number) => {
    const ramp = palette.sequential
    const idx = Math.min(ramp.length - 1, Math.round((pct / maxPct) * (ramp.length - 1)))
    return { background: ramp[idx], dark: idx > ramp.length / 2 }
  }

  const gridHeight = Math.max(220, rows.length * 30 + 40)

  return (
    <ChartCard
      title="Cohort retention"
      subtitle="Share of each acquisition month's companies ordering again, by months since first order (darker = more)"
      data={tableRows}
      columns={columns}
      height={gridHeight}
    >
      <div className="h-full overflow-auto">
        <div
          className="grid text-[11px] tabular-nums min-w-[640px]"
          style={{ gridTemplateColumns: `88px 64px repeat(${maxOffset}, minmax(36px, 1fr))` }}
          role="table"
          aria-label="Cohort retention heatmap"
        >
          <div className="px-1 py-1.5 font-medium text-muted-foreground sticky left-0 bg-card">Cohort</div>
          <div className="px-1 py-1.5 font-medium text-muted-foreground text-right">Cos.</div>
          {Array.from({ length: maxOffset }, (_, index) => (
            <div key={index} className="px-1 py-1.5 font-medium text-muted-foreground text-center">
              +{index + 1}m
            </div>
          ))}
          {rows.map((row) => (
            <Fragment key={row.cohort}>
              <div className="px-1 py-1.5 font-medium sticky left-0 bg-card">
                {row.cohort}
              </div>
              <div className="px-1 py-1.5 text-right text-muted-foreground">
                {row.size}
              </div>
              {row.cells.map((cell, index) => {
                if (!cell) {
                  return (
                    <div
                      key={`${row.cohort}-${index}`}
                      className="m-0.5 rounded-sm bg-muted/30"
                      aria-label="Not yet observable"
                    />
                  )
                }
                const { background, dark } = colorFor(cell.pct)
                return (
                  <div
                    key={`${row.cohort}-${index}`}
                    className="m-0.5 rounded-sm flex items-center justify-center"
                    style={{ background, color: dark ? '#fff' : palette.ink.axis }}
                    title={`${row.cohort} +${index + 1}m: ${formatValue(cell.pct, 'percent')} (${cell.count} of ${row.size} companies)`}
                  >
                    {cell.pct > 0 ? `${Math.round(cell.pct)}%` : ''}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}
