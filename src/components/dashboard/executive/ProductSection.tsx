'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function ProductTable({ title, rows, limit = 10 }: { title: string; rows: any[]; limit?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>AOV when included</TableHead>
              <TableHead>Repeat %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, limit).map((row) => (
              <TableRow key={row.product}>
                <TableCell>{row.product}</TableCell>
                <TableCell>{row.revenue}</TableCell>
                <TableCell>{row.orders}</TableCell>
                <TableCell>{row.averageOrderValueWhenIncluded}</TableCell>
                <TableCell>{row.repeatPurchaseRate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function ProductSection({ data }: { data?: any }) {
  if (!data || data.notEnoughData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product performance</CardTitle>
        </CardHeader>
        <CardContent>Not enough data yet</CardContent>
      </Card>
    )
  }
  const repeatRateRanking = Array.isArray(data.repeatRateRanking) ? data.repeatRateRanking : []
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Product performance overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Products tracked" value={data.summary.totalProducts} />
          <Metric label="Revenue" value={data.summary.totalRevenue} />
          <Metric label="Orders" value={data.summary.totalOrders} />
          <Metric label="Overall AOV" value={data.summary.averageOrderValueOverall} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trend over time</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.productRevenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top products by revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.productMetrics.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProductTable title="Hero products" rows={data.heroProducts} />
        <ProductTable title="Fastest growing products" rows={data.fastestGrowingProducts} />
        <ProductTable title="Products increasing AOV" rows={data.productsIncreasingAov} />
        <ProductTable title="Underperforming products" rows={data.underperformingProducts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Full menu repeat rate (best to worst)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={repeatRateRanking.slice(0, 25)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="repeatPurchaseRate" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <ProductTable title="Full menu repeat ranking" rows={repeatRateRanking} limit={repeatRateRanking.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products commonly bought together</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product A</TableHead>
                <TableHead>Product B</TableHead>
                <TableHead>Co-buy count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.commonlyBoughtTogether.slice(0, 20).map((row: any) => (
                <TableRow key={`${row.left}-${row.right}`}>
                  <TableCell>{row.left}</TableCell>
                  <TableCell>{row.right}</TableCell>
                  <TableCell>{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
