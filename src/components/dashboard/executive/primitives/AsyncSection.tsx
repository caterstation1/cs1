'use client'

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface AsyncSectionProps {
  loading: boolean
  error?: string | null
  /** True when the loaded data is genuinely empty (only evaluated when not loading). */
  isEmpty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  /** Approximate skeleton height while the first load is in flight. */
  skeletonHeight?: number
  children: ReactNode
}

function Skeleton({ height }: { height: number }) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardContent className="p-4">
        <div className="animate-pulse space-y-3" style={{ minHeight: height }}>
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-full min-h-24 w-full rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * P4: explicit loading / error / empty / ready states for a dashboard section.
 * The empty state can never render while a request is in flight — during
 * loading we show either a skeleton (first load) or the previous content
 * dimmed (refresh).
 */
export function AsyncSection({
  loading,
  error,
  isEmpty = false,
  emptyMessage = 'No data for the selected filters.',
  onRetry,
  skeletonHeight = 160,
  children,
}: AsyncSectionProps) {
  if (error) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }
  if (loading && isEmpty) return <Skeleton height={skeletonHeight} />
  if (!loading && isEmpty) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className={cn(loading ? 'opacity-60 transition-opacity' : 'transition-opacity')} aria-busy={loading}>
      {children}
    </div>
  )
}
