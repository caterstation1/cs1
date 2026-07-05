'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function toDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-NZ')
}

export function GrowthOpportunitiesTable({ baseQuery }: { baseQuery: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [state, setState] = useState<any>({ rows: [], pagination: null, loading: false })

  const query = useMemo(() => {
    const params = new URLSearchParams(baseQuery)
    params.set('page', String(page))
    params.set('pageSize', '25')
    params.set('sortBy', 'estimatedRevenueUpside')
    params.set('sortDir', 'desc')
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [baseQuery, page, search])

  useEffect(() => {
    let cancelled = false
    setState((prev: any) => ({ ...prev, loading: true }))
    fetch(`/api/dashboard/growth-opportunities?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setState({ ...data, loading: false })
      })
      .catch(() => {
        if (!cancelled) setState({ rows: [], pagination: null, loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Growth opportunities</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Search opportunities..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button asChild variant="outline">
            <a href={`/api/dashboard/growth-opportunities?${new URLSearchParams(`${baseQuery}&format=csv`).toString()}`}>Export CSV</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
        {!state.loading && (!state.rows || state.rows.length === 0) ? (
          <p className="text-sm text-muted-foreground">Not enough data yet</p>
        ) : null}
        {state.rows?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Lifetime revenue</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>AOV</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Days since</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opportunity type</TableHead>
                <TableHead>Estimated upside</TableHead>
                <TableHead>Recommended action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.rows.map((row: any) => (
                <TableRow key={`${row.companyId}-${row.opportunityType}`}>
                  <TableCell>
                    <a href={`/admin/companies/${row.companyId}`} className="underline underline-offset-2">
                      {row.companyName}
                    </a>
                  </TableCell>
                  <TableCell>{row.lifetimeRevenue}</TableCell>
                  <TableCell>{row.lifetimeOrders}</TableCell>
                  <TableCell>{row.averageOrderValue}</TableCell>
                  <TableCell>{row.contacts}</TableCell>
                  <TableCell>{toDate(row.lastOrderDate)}</TableCell>
                  <TableCell>{row.daysSinceLastOrder ?? '-'}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.opportunityType}</TableCell>
                  <TableCell>{row.estimatedRevenueUpside}</TableCell>
                  <TableCell>{row.recommendedAction}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {state.pagination ? (
          <div className="flex justify-end items-center gap-2">
            <Button variant="outline" disabled={state.pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {state.pagination.page} / {state.pagination.totalPages}
            </span>
            <Button
              variant="outline"
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
