'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function toDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-NZ')
}

export function CompaniesTable({ baseQuery }: { baseQuery: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('lifetimeRevenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [state, setState] = useState<any>({ rows: [], pagination: null, loading: false })

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
    setState((prev: any) => ({ ...prev, loading: true }))
    fetch(`/api/dashboard/companies?${query}`)
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

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Companies</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button asChild variant="outline">
            <a href={`/api/dashboard/companies?${new URLSearchParams(`${baseQuery}&format=csv`).toString()}`}>Export CSV</a>
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
                <TableHead onClick={() => toggleSort('companyName')} className="cursor-pointer">Company</TableHead>
                <TableHead onClick={() => toggleSort('lifetimeRevenue')} className="cursor-pointer">Lifetime revenue</TableHead>
                <TableHead onClick={() => toggleSort('lifetimeOrders')} className="cursor-pointer">Orders</TableHead>
                <TableHead>AOV</TableHead>
                <TableHead>First order</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Days since</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Quality flag</TableHead>
                <TableHead>Match methods</TableHead>
                <TableHead>Unique addresses</TableHead>
                <TableHead>Is generic domain</TableHead>
                <TableHead>Last reviewed</TableHead>
                <TableHead>Recommended action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.rows.map((row: any) => (
                <TableRow key={row.companyId}>
                  <TableCell>
                    <a href={`/admin/companies/${row.companyId}`} className="underline underline-offset-2">
                      {row.companyName}
                    </a>
                  </TableCell>
                  <TableCell>{row.lifetimeRevenue}</TableCell>
                  <TableCell>{row.lifetimeOrders}</TableCell>
                  <TableCell>{row.averageOrderValue}</TableCell>
                  <TableCell>{toDate(row.firstOrderDate)}</TableCell>
                  <TableCell>{toDate(row.lastOrderDate)}</TableCell>
                  <TableCell>{row.daysSinceLastOrder ?? '-'}</TableCell>
                  <TableCell>{row.contacts}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.matchConfidence}</TableCell>
                  <TableCell>{row.primaryDomain || '-'}</TableCell>
                  <TableCell>{row.primaryAddress || '-'}</TableCell>
                  <TableCell>{row.qualityFlag || '-'}</TableCell>
                  <TableCell>{row.matchMethodBreakdown || '-'}</TableCell>
                  <TableCell>{row.uniqueAddresses ?? '-'}</TableCell>
                  <TableCell>{row.isGenericDomain ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{toDate(row.lastManuallyReviewedDate)}</TableCell>
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
