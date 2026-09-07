'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatValue } from '@/lib/format'
import { AsyncSection } from './primitives/AsyncSection'
import { DataTable } from './primitives/DataTable'

function toDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-NZ')
}

export function GrowthOpportunitiesTable({ baseQuery }: { baseQuery: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [state, setState] = useState<any>({ rows: [], pagination: null, loading: true, error: null })

  const query = useMemo(() => {
    const params = new URLSearchParams(baseQuery)
    params.set('page', String(page))
    params.set('pageSize', '25')
    params.set('sortBy', 'estimatedRevenueUpside')
    params.set('sortDir', 'desc')
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [baseQuery, page, search])

  // All rows (server ignores pagination for CSV), respecting current filters/search
  const csvHref = useMemo(() => {
    const params = new URLSearchParams(baseQuery)
    params.set('sortBy', 'estimatedRevenueUpside')
    params.set('sortDir', 'desc')
    if (search.trim()) params.set('search', search.trim())
    params.set('format', 'csv')
    return `/api/dashboard/growth-opportunities?${params.toString()}`
  }, [baseQuery, search])

  useEffect(() => {
    let cancelled = false
    setState((prev: any) => ({ ...prev, loading: true, error: null }))
    fetch(`/api/dashboard/growth-opportunities?${query}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load growth opportunities')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setState({ ...data, loading: false, error: null })
      })
      .catch((error: any) => {
        if (!cancelled)
          setState({
            rows: [],
            pagination: null,
            loading: false,
            error: error?.message || 'Failed to load growth opportunities',
          })
      })
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-semibold">Growth opportunities</CardTitle>
        <div className="flex gap-2">
          <Input
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="h-8 w-56"
          />
          <Button asChild variant="outline" size="sm">
            <a href={csvHref}>Download CSV (all)</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        <AsyncSection
          loading={state.loading}
          error={state.error}
          isEmpty={!state.rows || state.rows.length === 0}
          emptyMessage="No growth opportunities match the current filters."
          skeletonHeight={320}
        >
          <DataTable
            columns={[
              {
                key: 'companyName',
                label: 'Company',
                sortable: false,
                render: (row: any) => (
                  <a href={`/admin/companies/${row.companyId}`} className="underline underline-offset-2">
                    {row.companyName}
                  </a>
                ),
              },
              { key: 'lifetimeRevenue', label: 'Lifetime revenue', format: 'currency', sortable: false },
              { key: 'lifetimeOrders', label: 'Orders', format: 'count', sortable: false },
              { key: 'averageOrderValue', label: 'AOV', format: 'currency', sortable: false },
              { key: 'contacts', label: 'Contacts', format: 'count', sortable: false },
              {
                key: 'lastOrderDate',
                label: 'Last order',
                sortable: false,
                render: (row: any) => toDate(row.lastOrderDate),
              },
              { key: 'daysSinceLastOrder', label: 'Days since', format: 'count', sortable: false },
              { key: 'status', label: 'Status', sortable: false },
              { key: 'opportunityType', label: 'Opportunity type', sortable: false },
              { key: 'estimatedRevenueUpside', label: 'Estimated upside', format: 'currency', sortable: false },
              { key: 'recommendedAction', label: 'Recommended action', sortable: false },
            ]}
            rows={state.rows || []}
            rowKey={(row: any) => `${row.companyId}-${row.opportunityType}`}
          />
        </AsyncSection>
        {state.pagination ? (
          <div className="flex justify-end items-center gap-2">
            <Button variant="outline" size="sm" disabled={state.pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {state.pagination.page} / {state.pagination.totalPages} · {formatValue(state.pagination.total, 'count')}{' '}
              opportunities
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={state.pagination.page >= state.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
