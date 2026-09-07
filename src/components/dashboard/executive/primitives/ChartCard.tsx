'use client'

import { ReactNode, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatValue, ValueFormat } from '@/lib/format'

export interface ChartColumn {
  key: string
  label: string
  format?: ValueFormat
}

export interface ChartCardProps {
  title: string
  subtitle?: string
  /** One-line plain-language takeaway rendered under the title. */
  insight?: string
  /** Extra badge/adornment rendered next to the title (e.g. a data caveat). */
  badge?: ReactNode
  height?: number
  /** Rows backing the "view as table" toggle. */
  data: Array<Record<string, unknown>>
  columns: ChartColumn[]
  children: ReactNode
  footnote?: string
  className?: string
}

/**
 * Shell for every dashboard chart: title, optional insight, a chart/table
 * view toggle, and consistent spacing. Charts inside should use
 * <FormattedTooltip> so tooltip values share the global formatter.
 */
export function ChartCard({
  title,
  subtitle,
  insight,
  badge,
  height = 288,
  data,
  columns,
  children,
  footnote,
  className,
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')

  return (
    <Card className={className}>
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {badge}
          </div>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          {insight ? <p className="text-xs font-medium text-foreground/80">{insight}</p> : null}
        </div>
        <div className="flex shrink-0 rounded-md border overflow-hidden" role="group" aria-label="Chart view toggle">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7 rounded-none px-2 text-xs', view === 'chart' && 'bg-muted font-semibold')}
            onClick={() => setView('chart')}
            aria-pressed={view === 'chart'}
          >
            Chart
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7 rounded-none px-2 text-xs border-l', view === 'table' && 'bg-muted font-semibold')}
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
          >
            Table
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {view === 'chart' ? (
          <div style={{ height }}>{children}</div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: height }}>
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn('text-xs', col.format && col.format !== 'text' ? 'text-right' : '')}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index} className={index % 2 === 1 ? 'bg-muted/40' : ''}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          'text-xs',
                          col.format && col.format !== 'text' ? 'text-right tabular-nums' : ''
                        )}
                      >
                        {formatValue(row[col.key], col.format || 'text')}
                        {col.key === columns[0].key && (row as any).isPartial ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">(MTD)</span>
                        ) : null}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {footnote ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{footnote}</p> : null}
      </CardContent>
    </Card>
  )
}

/**
 * Recharts tooltip content with shared formatting: full-precision values,
 * text-colored labels with a color chip, and an "MTD" tag for partial periods.
 * Use as: <Tooltip content={<FormattedTooltip columns={columns} />} />
 */
export function FormattedTooltip({
  active,
  payload,
  label,
  columns,
}: {
  active?: boolean
  payload?: Array<any>
  label?: string | number
  columns: ChartColumn[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const formatFor = (key: string): ValueFormat => {
    const col = columns.find((c) => c.key === key)
    if (col?.format && col.format !== 'text') {
      return col.format === 'currencyCompact' ? 'currency' : col.format
    }
    return 'count'
  }
  const datum = payload[0]?.payload as Record<string, unknown> | undefined
  const isPartial = !!datum?.isPartial
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md text-xs space-y-1 max-w-64">
      <p className="font-medium">
        {label}
        {isPartial ? <span className="ml-1 text-muted-foreground font-normal">· MTD (partial period)</span> : null}
      </p>
      {payload
        .filter((entry) => entry.value != null && !String(entry.dataKey).endsWith('__partial'))
        .map((entry) => (
          <p key={String(entry.dataKey)} className="flex items-center gap-1.5 tabular-nums">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-muted-foreground">{entry.name || entry.dataKey}:</span>
            <span className="font-medium">{formatValue(entry.value, formatFor(String(entry.dataKey)))}</span>
          </p>
        ))}
    </div>
  )
}

/**
 * Recharts legend content where labels wear text colors (not series colors);
 * a colored chip beside each label carries identity.
 * Use as: <Legend content={<FormattedLegend />} />
 */
export function FormattedLegend({ payload }: { payload?: Array<any> }) {
  if (!payload || payload.length === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs">
      {payload
        .filter((entry) => !String(entry.dataKey || '').endsWith('__partial'))
        .map((entry) => (
          <span key={String(entry.value)} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.value}
          </span>
        ))}
    </div>
  )
}

/** Shared axis tick style so ticks meet contrast requirements in both themes. */
export function axisTick(axisColor: string): { fontSize: number; fill: string } {
  return { fontSize: 11, fill: axisColor }
}

/**
 * Padded [dataMin, dataMax] domain for rate/average charts (B2). Bars and
 * absolute-revenue charts must NOT use this — they stay anchored at 0.
 */
export function paddedDomain(values: number[]): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v))
  if (!finite.length) return [0, 1]
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const range = max - min
  const pad = range > 0 ? range * 0.15 : Math.abs(max) * 0.05 || 1
  const lower = min - pad
  return [min >= 0 ? Math.max(0, lower) : lower, max + pad]
}

/**
 * Splits a monthly series into a solid segment (complete periods) and a
 * dashed tail (the trailing partial period), for B3 partial-month rendering.
 * Adds `${key}` (nulled on partial rows) and `${key}__partial` (only the last
 * complete point + the partial point, so the dashed connector renders).
 */
export function withPartialSplit<T extends Record<string, any>>(rows: T[], keys: string[]): Array<T & Record<string, any>> {
  const lastPartialIndex = rows.length - 1
  const hasTrailingPartial = rows.length > 0 && !!rows[lastPartialIndex]?.isPartial
  return rows.map((row, index) => {
    const out: Record<string, any> = { ...row }
    for (const key of keys) {
      const value = row[key]
      out[key] = hasTrailingPartial && row.isPartial ? null : value
      out[`${key}__partial`] =
        hasTrailingPartial && (index === lastPartialIndex || index === lastPartialIndex - 1) ? value : null
    }
    return out as T & Record<string, any>
  })
}
