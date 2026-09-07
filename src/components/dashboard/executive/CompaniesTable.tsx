'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatValue } from '@/lib/format'
import { AsyncSection } from './primitives/AsyncSection'
import { DataTable } from './primitives/DataTable'

function toDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-NZ')
}

export function CompaniesTable({ baseQuery }: { baseQuery: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('lifetimeRevenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [state, setState] = useState<any>({ rows: [], pagination: null, loading: true, error: null })

  const query = useMemo(() => {
    const params = new URLSearchParams(baseQuery)
    params.set('page', String(page))
    params.set('pageSize', '25')
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [baseQuery, page, sortBy, sortDir, search])

  useEffect(() => {
    let cancelled = false
    setState((prev: any) => ({ ...prev, loading: true, error: null }))
    fetch(`/api/dashboard/companies?${query}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load companies')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setState({ ...data, loading: false, error: null })
      })
      .catch((error: any) => {
        if (!cancelled)
          setState({ rows: [], pagination: null, loading: false, error: error?.message || 'Failed to load companies' })
      })
    return () => {
      cancelled = true
    }
  }, [query])

  // All rows (server ignores pagination for CSV), respecting current filters/search/sort
  const csvHref = useMemo(() => {
    const params = new URLSearchParams(baseQuery)
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)
    if (search.trim()) params.set('search', search.trim())
    params.set('format', 'csv')
    return `/api/dashboard/companies?${params.toString()}`
  }, [baseQuery, sortBy, sortDir, search])

  const onSortChange = (key: string, dir: 'asc' | 'desc') => {
    setSortBy(key)
    setSortDir(dir)
    setPage(1)
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-semibold">Companies</CardTitle>
        <div className="flex gap-2">
          <Input
            placeholder="Search companies..."
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
          emptyMessage="No companies match the current filters."
          skeletonHeight={360}
        >
          <DataTable
            columns={[
              {
                key: 'companyName',
                label: 'Company',
                render: (row: any) => (
                  <a href={`/admin/companies/${row.companyId}`} className="underline underline-offset-2">
                    {row.companyName}
                  </a>
                ),
              },
              { key: 'lifetimeRevenue', label: 'Lifetime revenue', format: 'currency' },
              { key: 'lifetimeOrders', label: 'Orders', format: 'count' },
              { key: 'averageOrderValue', label: 'AOV', format: 'currency' },
              { key: 'firstOrderDate', label: 'First order', render: (row: any) => toDate(row.firstOrderDate) },
              { key: 'lastOrderDate', label: 'Last order', render: (row: any) => toDate(row.lastOrderDate) },
              { key: 'daysSinceLastOrder', label: 'Days since', format: 'count' },
              { key: 'status', label: 'Status' },
              { key: 'recommendedAction', label: 'Recommended action', sortable: false },
              // Diagnostic columns — hidden by default, available via the Columns picker
              { key: 'contacts', label: 'Contacts', format: 'count', defaultHidden: true },
              { key: 'matchConfidence', label: 'Confidence', format: 'count', defaultHidden: true },
              { key: 'primaryDomain', label: 'Domain', defaultHidden: true },
              { key: 'primaryAddress', label: 'Address', defaultHidden: true },
              { key: 'qualityFlag', label: 'Quality flag', defaultHidden: true },
              { key: 'matchMethodBreakdown', label: 'Match methods', defaultHidden: true, sortable: false },
              { key: 'uniqueAddresses', label: 'Unique addresses', format: 'count', defaultHidden: true },
              {
                key: 'isGenericDomain',
                label: 'Is generic domain',
                defaultHidden: true,
                render: (row: any) => (row.isGenericDomain ? 'Yes' : 'No'),
              },
              {
                key: 'lastManuallyReviewedDate',
                label: 'Last reviewed',
                defaultHidden: true,
                render: (row: any) => toDate(row.lastManuallyReviewedDate),
              },
            ]}
            rows={state.rows || []}
            rowKey={(row: any) => row.companyId}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={onSortChange}
            columnPicker
            renderDetail={(row: any) => (
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 py-1 text-xs">
                {[
                  ['Contacts', formatValue(row.contacts, 'count')],
                  ['Match confidence', formatValue(row.matchConfidence, 'count')],
                  ['Domain', row.primaryDomain || '-'],
                  ['Address', row.primaryAddress || '-'],
                  ['Quality flag', row.qualityFlag || '-'],
                  ['Match methods', row.matchMethodBreakdown || '-'],
                  ['Unique addresses', formatValue(row.uniqueAddresses, 'count')],
                  ['Is generic domain', row.isGenericDomain ? 'Yes' : 'No'],
                  ['Last reviewed', toDate(row.lastManuallyReviewedDate)],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{value as string}</dd>
                  </div>
                ))}
              </dl>
            )}
          />
        </AsyncSection>
        {state.pagination ? (
          <div className="flex justify-end items-center gap-2">
            <Button variant="outline" size="sm" disabled={state.pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {state.pagination.page} / {state.pagination.totalPages} · {formatValue(state.pagination.total, 'count')}{' '}
              companies
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
