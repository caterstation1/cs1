'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardFilters, DashboardFilterState } from '@/components/dashboard/executive/DashboardFilters'
import { ExecutiveKpiGrid } from '@/components/dashboard/executive/ExecutiveKpiGrid'
import { OperationsSummarySection } from '@/components/dashboard/executive/OperationsSummarySection'
import { RevenueTrendsPanel } from '@/components/dashboard/executive/RevenueTrendsPanel'
import { CompanyBehaviourPanel } from '@/components/dashboard/executive/CompanyBehaviourPanel'
import { CompaniesTable } from '@/components/dashboard/executive/CompaniesTable'
import { GrowthOpportunitiesTable } from '@/components/dashboard/executive/GrowthOpportunitiesTable'
import { CustomerSection } from '@/components/dashboard/executive/CustomerSection'
import { ProductSection } from '@/components/dashboard/executive/ProductSection'
import { DataQualityPanel } from '@/components/dashboard/executive/DataQualityPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const defaultFilters: DashboardFilterState = {
  preset: 'last_12_months',
  includePrivateUnmatched: 'false',
}

function buildQuery(filters: DashboardFilterState): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== '') params.set(key, String(value))
  })
  return params.toString()
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed request: ${url}`)
  return response.json()
}

export default function ExecutiveDashboardPage() {
  const { data: session } = useSession()
  const access = (session as any)?.user?.accessLevel
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters)
  const [query, setQuery] = useState<string>(buildQuery(defaultFilters))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>({})

  const isAdmin = access === 'owner' || access === 'admin'

  const applyFilters = useCallback(async () => {
    setLoading(true)
    setError(null)
    const nextQuery = buildQuery(filters)
    setQuery(nextQuery)
    try {
      const [
        summary,
        revenueTrends,
        companyBehaviour,
        customers,
        products,
        dataQuality,
      ] = await Promise.all([
        fetchJson(`/api/dashboard/summary?${nextQuery}`),
        fetchJson(`/api/dashboard/revenue-trends?${nextQuery}`),
        fetchJson(`/api/dashboard/company-behaviour?${nextQuery}`),
        fetchJson(`/api/dashboard/customers?${nextQuery}`),
        fetchJson(`/api/dashboard/products?${nextQuery}`),
        isAdmin ? fetchJson(`/api/dashboard/data-quality?${nextQuery}`) : Promise.resolve(null),
      ])
      setData({
        summary,
        revenueTrends,
        companyBehaviour,
        customers,
        products,
        dataQuality,
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to load executive dashboard')
    } finally {
      setLoading(false)
    }
  }, [filters, isAdmin])

  useEffect(() => {
    void applyFilters()
  }, [applyFilters])

  const baseQuery = useMemo(() => query, [query])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Executive dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Company-level reporting is the business source of truth. Customer and product views are supporting layers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a href={`/api/dashboard/export?${buildQuery(filters)}`}>Download all datapoints (CSV)</a>
          </Button>
          <Button onClick={applyFilters} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh now'}
          </Button>
        </div>
      </div>

      <DashboardFilters value={filters} onChange={setFilters} onApply={applyFilters} />

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Load error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Executive summary</h2>
        <ExecutiveKpiGrid cards={data.summary?.cards} />
        {Array.isArray(data.summary?.validationChecks) && data.summary.validationChecks.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Validation checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.summary.validationChecks.map((check: any) => (
                <p key={check.id} className={check.level === 'error' ? 'text-red-600' : 'text-amber-600'}>
                  {check.message}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-medium">Operations summary</h2>
          <p className="text-sm text-muted-foreground">
            Delivery-day view: outputs matched against component COGS, staffing, and delivery costs.
          </p>
        </div>
        <OperationsSummarySection />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Revenue trends</h2>
        <RevenueTrendsPanel data={data.revenueTrends} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Company behaviour</h2>
        <CompanyBehaviourPanel data={data.companyBehaviour} onRefresh={applyFilters} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Company table</h2>
        <CompaniesTable baseQuery={baseQuery} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Growth opportunities</h2>
        <GrowthOpportunitiesTable baseQuery={baseQuery} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Customer dashboard (secondary)</h2>
        <CustomerSection data={data.customers} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Product performance</h2>
        <ProductSection data={data.products} />
      </section>

      {isAdmin ? (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Data quality</h2>
          <DataQualityPanel data={data.dataQuality} />
        </section>
      ) : null}
    </div>
  )
}
