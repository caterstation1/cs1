'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatValue(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value ?? '-')
  return n.toLocaleString('en-NZ', { maximumFractionDigits: 2 })
}

export function ExecutiveKpiGrid({ cards }: { cards?: Record<string, unknown> }) {
  if (!cards) return <p className="text-sm text-muted-foreground">Not enough data yet</p>

  const entries: Array<[string, unknown]> = [
    ['Total revenue', cards.totalRevenue],
    ['Total orders', cards.totalOrders],
    ['Average order value', cards.averageOrderValue],
    ['Active companies', cards.activeCompanies],
    ['New companies', cards.newCompanies],
    ['Returning companies', cards.returningCompanies],
    ['Avg orders/company (all time)', cards.averageOrdersPerCompanyAllTime],
    ['Avg orders/company (12m)', cards.averageOrdersPerCompany12m],
    ['Avg revenue/company', cards.averageRevenuePerCompany],
    ['Median revenue/company', cards.medianRevenuePerCompany],
    ['Company lifetime value', cards.companyLifetimeValue],
    ['Revenue from returning', cards.revenueFromReturningCompanies],
    ['Repeat company revenue %', cards.repeatCompanyRevenuePct],
    ['Avg days between orders', cards.averageDaysBetweenCompanyOrders],
    ['At-risk companies', cards.atRiskCompanies],
    ['Lapsed companies', cards.lapsedCompanies],
    ['Top 10 revenue %', cards.revenueFromTop10CompaniesPct],
    ['Top 25 revenue %', cards.revenueFromTop25CompaniesPct],
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {entries.map(([label, value]) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatValue(value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
