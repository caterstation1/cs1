'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function CustomerSection({ data }: { data?: any }) {
  if (!data || data.notEnoughData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer dashboard (secondary)</CardTitle>
        </CardHeader>
        <CardContent>Not enough data yet</CardContent>
      </Card>
    )
  }

  const m = data.metrics
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Customer metrics (secondary to company metrics)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Total customers" value={m.totalCustomers} />
          <Metric label="New customers" value={m.newCustomers} />
          <Metric label="Returning customers" value={m.returningCustomers} />
          <Metric label="Avg orders/customer (all time)" value={m.averageOrdersPerCustomerAllTime} />
          <Metric label="Avg orders/customer (12m)" value={m.averageOrdersPerCustomer12m} />
          <Metric label="Average customer LTV" value={m.averageCustomerLifetimeValue} />
          <Metric label="Median customer LTV" value={m.medianCustomerLifetimeValue} />
          <Metric label="Repeat purchase rate %" value={m.customerRepeatPurchaseRate} />
          <Metric label="Revenue from returning" value={m.revenueFromReturningCustomers} />
          <Metric label="Avg days between orders" value={m.averageDaysBetweenCustomerOrders} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>New vs returning customer revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.newVsReturningRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="newRevenue" stackId="a" fill="#16a34a" />
                <Bar dataKey="returningRevenue" stackId="a" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by customer order number</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.revenueByOrderNumber}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="segment" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Customer order frequency distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.orderFrequencyDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top customers by revenue (top {data.topCustomerLimit || 25})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>AOV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.charts.topCustomers.map((row: any) => (
                  <TableRow key={row.customerId}>
                    <TableCell>{row.customerId}</TableCell>
                    <TableCell>{row.revenue}</TableCell>
                    <TableCell>{row.orders}</TableCell>
                    <TableCell>{row.averageOrderValue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer LTV distribution + first-to-second order timing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.ltvDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="customers" fill="#9333ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded border p-4">
            <p className="text-sm text-muted-foreground">Average days: 1st to 2nd customer order</p>
            <p className="text-3xl font-semibold mt-2">{data.charts.timeBetweenFirstAndSecondOrder}</p>
          </div>
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
