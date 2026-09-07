'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { AsyncSection } from '@/components/dashboard/executive/primitives/AsyncSection'
import { ThemeToggle } from '@/components/dashboard/executive/primitives/ThemeToggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatValue } from '@/lib/format'

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

function SectionHeader({
  title,
  subtitle,
  insight,
  csvHref,
}: {
  title: string
  subtitle?: string
  insight?: string | null
  csvHref?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-xl font-medium">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        {insight ? <p className="text-sm font-medium text-foreground/80">{insight}</p> : null}
      </div>
      {csvHref ? (
        <Button asChild variant="outline" size="sm">
          <a href={csvHref}>Download CSV (all)</a>
        </Button>
      ) : null}
    </div>
  )
}

interface SectionDef {
  id: string
  label: string
}

function SectionNav({ sections, activeId }: { sections: SectionDef[]; activeId: string | null }) {
  return (
    <nav aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={activeId === section.id ? 'true' : undefined}
          className={cn(
            'whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            activeId === section.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {section.label}
        </a>
      ))}
    </nav>
  )
}

export default function ExecutiveDashboardPage() {
  const { data: session } = useSession()
  const access = (session as any)?.user?.accessLevel
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters)
  const [query, setQuery] = useState<string>(buildQuery(defaultFilters))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>({})
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const firstLoadRef = useRef(true)

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

  // Auto-apply with a debounce so typing in filter inputs doesn't spam requests.
  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      void applyFilters()
      return
    }
    const timer = setTimeout(() => {
      void applyFilters()
    }, 400)
    return () => clearTimeout(timer)
  }, [applyFilters])

  const baseQuery = useMemo(() => query, [query])

  const sections = useMemo<SectionDef[]>(
    () =>
      [
        { id: 'summary', label: 'Summary' },
        { id: 'operations', label: 'Operations' },
        { id: 'trends', label: 'Revenue trends' },
        { id: 'behaviour', label: 'Company behaviour' },
        { id: 'companies', label: 'Companies' },
        { id: 'growth', label: 'Growth' },
        { id: 'customers', label: 'Customers' },
        { id: 'products', label: 'Products' },
        ...(isAdmin ? [{ id: 'data-quality', label: 'Data quality' }] : []),
      ],
    [isAdmin]
  )

  // Scroll-spy for the sticky section nav.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-140px 0px -60% 0px' }
    )
    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  // Section headline insights (A5), computed from completed periods only.
  const trendInsight = useMemo(() => {
    const rows: any[] = data.revenueTrends?.monthlyRevenue || []
    const complete = rows.filter((row) => !row.isPartial)
    if (complete.length < 2) return null
    const last = complete[complete.length - 1]
    const prev = complete[complete.length - 2]
    if (!prev.revenue) return null
    const delta = ((last.revenue - prev.revenue) / prev.revenue) * 100
    return `${last.month}: ${formatValue(last.revenue, 'currencyCompact')} revenue (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs ${prev.month})`
  }, [data.revenueTrends])

  const behaviourInsight = useMemo(() => {
    const buckets: any[] = data.companyBehaviour?.frequencyDistribution || []
    if (!buckets.length) return null
    const count = (label: string) => buckets.find((b) => b.bucket === label)?.companies || 0
    const total = buckets.reduce((sum, b) => sum + (b.companies || 0), 0)
    const repeat = total - count('1 order')
    if (!total) return null
    return `${formatValue((repeat / total) * 100, 'percent')} of companies place a 2nd order`
  }, [data.companyBehaviour])

  const productInsight = useMemo(() => {
    const metrics: any[] = data.products?.productMetrics || []
    if (!metrics.length) return null
    const top = metrics[0]
    return `Top product "${top.product}" = ${formatValue(top.revenueSharePct, 'percent')} of product revenue`
  }, [data.products])

  const customerInsight = useMemo(() => {
    const rate = data.customers?.metrics?.customerRepeatPurchaseRate
    if (rate == null) return null
    return `${formatValue(rate, 'percent')} of customers order more than once`
  }, [data.customers])

  const hasSummary = !!data.summary?.cards
  const sectionClass = 'space-y-3 scroll-mt-36'

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
          <ThemeToggle />
          <Button asChild variant="outline">
            <a href={`/api/dashboard/export?${buildQuery(filters)}`}>Download all datapoints (CSV)</a>
          </Button>
          <Button onClick={applyFilters} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh now'}
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-30 -mx-1 space-y-2 bg-background/95 px-1 py-2 backdrop-blur">
        <SectionNav sections={sections} activeId={activeSection} />
        <DashboardFilters value={filters} onChange={setFilters} onApply={applyFilters} />
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">Load error</p>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      ) : null}

      <section id="summary" className={sectionClass}>
        <SectionHeader title="Executive summary" csvHref={`/api/dashboard/summary?${baseQuery}&format=csv`} />
        <AsyncSection
          loading={loading}
          isEmpty={!hasSummary || !!data.summary?.notEnoughData}
          emptyMessage="No orders in the selected period."
          skeletonHeight={320}
        >
          <ExecutiveKpiGrid summary={data.summary} />
        </AsyncSection>
      </section>

      <section id="operations" className={sectionClass}>
        <SectionHeader
          title="Operations summary"
          subtitle="Delivery-day view: outputs matched against component COGS, staffing, and delivery costs."
        />
        <OperationsSummarySection />
      </section>

      <section id="trends" className={sectionClass}>
        <SectionHeader
          title="Revenue trends"
          insight={trendInsight}
          csvHref={`/api/dashboard/revenue-trends?${baseQuery}&format=csv`}
        />
        <AsyncSection
          loading={loading}
          isEmpty={!data.revenueTrends || !!data.revenueTrends?.notEnoughData}
          emptyMessage="No revenue in the selected period."
          skeletonHeight={320}
        >
          <RevenueTrendsPanel data={data.revenueTrends} />
        </AsyncSection>
      </section>

      <section id="behaviour" className={sectionClass}>
        <SectionHeader
          title="Company behaviour"
          insight={behaviourInsight}
          csvHref={`/api/dashboard/company-behaviour?${baseQuery}&format=csv`}
        />
        <AsyncSection
          loading={loading}
          isEmpty={!data.companyBehaviour || !!data.companyBehaviour?.notEnoughData}
          emptyMessage="No company activity in the selected period."
          skeletonHeight={320}
        >
          <CompanyBehaviourPanel data={data.companyBehaviour} onRefresh={applyFilters} />
        </AsyncSection>
      </section>

      <section id="companies" className={sectionClass}>
        <h2 className="text-xl font-medium">Company table</h2>
        <CompaniesTable baseQuery={baseQuery} />
      </section>

      <section id="growth" className={sectionClass}>
        <h2 className="text-xl font-medium">Growth opportunities</h2>
        <GrowthOpportunitiesTable baseQuery={baseQuery} />
      </section>

      <section id="customers" className={sectionClass}>
        <SectionHeader
          title="Customer dashboard (secondary)"
          insight={customerInsight}
          csvHref={`/api/dashboard/customers?${baseQuery}&format=csv`}
        />
        <AsyncSection
          loading={loading}
          isEmpty={!data.customers || !!data.customers?.notEnoughData}
          emptyMessage="No customer activity in the selected period."
          skeletonHeight={320}
        >
          <CustomerSection data={data.customers} />
        </AsyncSection>
      </section>

      <section id="products" className={sectionClass}>
        <SectionHeader
          title="Product performance"
          insight={productInsight}
          csvHref={`/api/dashboard/products?${baseQuery}&format=csv`}
        />
        <AsyncSection
          loading={loading}
          isEmpty={!data.products || !!data.products?.notEnoughData}
          emptyMessage="No product sales in the selected period."
          skeletonHeight={320}
        >
          <ProductSection data={data.products} />
        </AsyncSection>
      </section>

      {isAdmin ? (
        <section id="data-quality" className={sectionClass}>
          <SectionHeader title="Data quality" csvHref={`/api/dashboard/data-quality?${baseQuery}&format=csv`} />
          <AsyncSection loading={loading} isEmpty={!data.dataQuality} emptyMessage="No data quality metrics available.">
            <DataQualityPanel data={data.dataQuality} />
          </AsyncSection>
        </section>
      ) : null}
    </div>
  )
}
