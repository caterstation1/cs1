'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDeltaPct, formatValue, ValueFormat } from '@/lib/format'

export interface KpiCardProps {
  label: string
  value: unknown
  format?: ValueFormat
  size?: 'hero' | 'default' | 'compact'
  /** Percent change vs the prior comparable period. */
  deltaPct?: number | null
  /** Which direction is favourable (e.g. 'down' for "Avg days between orders"). */
  deltaDirectionGood?: 'up' | 'down'
  sparklineData?: number[] | null
  footnote?: string
  className?: string
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean | null }) {
  const width = 120
  const height = 28
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((value, index) => {
    const x = index * step
    const y = height - 2 - ((value - min) / range) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = points[points.length - 1].split(',').map(Number)
  const strokeClass =
    positive == null ? 'stroke-muted-foreground' : positive ? 'stroke-emerald-600 dark:stroke-emerald-400' : 'stroke-red-600 dark:stroke-red-400'
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1 overflow-visible"
      role="img"
      aria-label="12 period trend"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        strokeWidth={1.5}
        className={cn('opacity-70', strokeClass)}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} className={cn('opacity-90', strokeClass.replace(/stroke-/g, 'fill-'))} />
    </svg>
  )
}

export function KpiCard({
  label,
  value,
  format = 'count',
  size = 'default',
  deltaPct,
  deltaDirectionGood = 'up',
  sparklineData,
  footnote,
  className,
}: KpiCardProps) {
  const hasDelta = deltaPct != null && Number.isFinite(deltaPct)
  const isNeutral = hasDelta && Math.abs(deltaPct!) < 0.05
  const favourable = hasDelta && !isNeutral ? (deltaPct! > 0) === (deltaDirectionGood === 'up') : null

  const valueText =
    size === 'hero' && (format === 'currency' || format === 'currencyCompact')
      ? formatValue(value, 'currencyCompact')
      : formatValue(value, format)
  const fullPrecision = formatValue(value, format === 'currencyCompact' ? 'currency' : format)

  return (
    <Card className={className}>
      <CardContent className={cn(size === 'compact' ? 'p-3' : 'p-4', 'space-y-0.5')}>
        <p
          className={cn(
            'font-medium text-muted-foreground',
            size === 'hero' ? 'text-sm' : 'text-xs'
          )}
        >
          {label}
        </p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <p
            title={fullPrecision}
            className={cn(
              'font-semibold tabular-nums text-foreground',
              size === 'hero' ? 'text-3xl' : size === 'compact' ? 'text-base' : 'text-lg'
            )}
          >
            {valueText}
          </p>
          {hasDelta ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                isNeutral
                  ? 'text-muted-foreground'
                  : favourable
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
              )}
              title="vs prior comparable period (partial periods excluded)"
            >
              <span aria-hidden>{isNeutral ? '–' : deltaPct! > 0 ? '▲' : '▼'}</span>
              {formatDeltaPct(deltaPct!)}
            </span>
          ) : null}
        </div>
        {sparklineData && sparklineData.length >= 2 && size !== 'compact' ? (
          <Sparkline data={sparklineData} positive={favourable} />
        ) : null}
        {footnote ? <p className="text-[11px] leading-4 text-muted-foreground">{footnote}</p> : null}
      </CardContent>
    </Card>
  )
}
