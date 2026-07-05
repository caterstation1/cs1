'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function DataQualityPanel({ data }: { data?: any }) {
  if (!data || data.notEnoughData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data quality</CardTitle>
        </CardHeader>
        <CardContent>Not enough data yet</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data quality (admin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Total companies" value={data.totalCompanies} />
          <Metric label="Orders assigned" value={data.ordersAssignedToCompanies} />
          <Metric label="Orders without match" value={data.ordersWithoutCompanyMatch} />
          <Metric label="Avg match confidence" value={data.averageMatchConfidence} />
          <Metric label="Pending reviews" value={data.matchesPendingReview} />
          <Metric label="Generic email orders" value={data.genericEmailOrders} />
          <Metric label="Duplicate candidates" value={data.duplicateCompanyCandidates} />
        </div>

        <div className="rounded border p-3">
          <p className="font-medium mb-2">Matches by method</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            {data.matchesByMethod.map((row: any) => (
              <div key={row.method} className="rounded bg-muted px-2 py-1 flex justify-between">
                <span>{row.method}</span>
                <span>{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button asChild variant="outline">
            <a href="/admin/company-matches">Open company match review queue</a>
          </Button>
        </div>

        {data.reconciliation?.topMismatchDomains?.length ? (
          <div className="rounded border p-3 space-y-2">
            <p className="font-medium">Top mismatch domains</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Customer revenue</TableHead>
                  <TableHead>Company revenue</TableHead>
                  <TableHead>Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reconciliation.topMismatchDomains.map((row: any) => (
                  <TableRow key={row.domain}>
                    <TableCell>{row.domain}</TableCell>
                    <TableCell>{row.customerRevenueByDomain}</TableCell>
                    <TableCell>{row.companyRevenueForDomain}</TableCell>
                    <TableCell>{row.difference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {data.orphanedBusinessDomainCustomers?.length ? (
          <div className="rounded border p-3 space-y-2">
            <p className="font-medium">Orphaned business-domain customers</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orphanedBusinessDomainCustomers.map((row: any, idx: number) => (
                  <TableRow key={`${row.email}-${idx}`}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.domain}</TableCell>
                    <TableCell>{row.orders}</TableCell>
                    <TableCell>{row.revenue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {data.topCompaniesByRevenue?.length ? (
          <div className="rounded border p-3 space-y-2">
            <p className="font-medium">Top companies by revenue (diagnostic)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Top contact emails</TableHead>
                  <TableHead>First order</TableHead>
                  <TableHead>Last order</TableHead>
                  <TableHead>Match method</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCompaniesByRevenue.map((row: any, idx: number) => (
                  <TableRow key={`${row.domain}-${idx}`}>
                    <TableCell>{row.company}</TableCell>
                    <TableCell>{row.domain}</TableCell>
                    <TableCell>{row.lifetimeCompanyRevenue}</TableCell>
                    <TableCell>{row.lifetimeCompanyOrders}</TableCell>
                    <TableCell>{row.contacts}</TableCell>
                    <TableCell>{(row.topContactEmails || []).join(', ') || '-'}</TableCell>
                    <TableCell>{row.firstOrder ? new Date(row.firstOrder).toLocaleDateString('en-NZ') : '-'}</TableCell>
                    <TableCell>{row.lastOrder ? new Date(row.lastOrder).toLocaleDateString('en-NZ') : '-'}</TableCell>
                    <TableCell>{row.matchMethod}</TableCell>
                    <TableCell>{row.confidence}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {data.companyQualityFlags?.length ? (
          <div className="rounded border p-3 space-y-2">
            <p className="font-medium">Company quality flags</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.companyQualityFlags.map((row: any) => (
                  <TableRow key={row.companyId}>
                    <TableCell>{row.companyName}</TableCell>
                    <TableCell>{(row.qualityFlags || []).join(', ')}</TableCell>
                    <TableCell>
                      <a className="underline underline-offset-2" href={`/admin/companies/${row.companyId}`}>
                        Inspect
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{String(value ?? '-')}</p>
    </div>
  )
}
