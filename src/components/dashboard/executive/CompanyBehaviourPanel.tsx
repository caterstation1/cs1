'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatValue } from '@/lib/format'
import { ChartCard, FormattedTooltip, axisTick } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { KpiCard } from './primitives/KpiCard'
import { DataTable } from './primitives/DataTable'
import { CohortHeatmap } from './CohortHeatmap'
import { RetentionFunnel } from './RetentionFunnel'

export function CompanyBehaviourPanel({ data, onRefresh }: { data?: any; onRefresh?: () => Promise<void> | void }) {
  const palette = useChartColors()
  const [recoveryOptions, setRecoveryOptions] = useState<string[]>([])
  const [selectedAction, setSelectedAction] = useState('')
  const [customAction, setCustomAction] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [activeCompany, setActiveCompany] = useState<any | null>(null)
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const lapsedCompanyIds = useMemo(
    () => (Array.isArray(data?.lapsedCompanies) ? data.lapsedCompanies.map((row: any) => row.companyId) : []),
    [data?.lapsedCompanies]
  )

  useEffect(() => {
    let cancelled = false
    const loadOptions = async () => {
      try {
        const response = await fetch('/api/admin/recovery-actions', { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (cancelled) return
        const options = Array.isArray(payload.options) ? payload.options : []
        setRecoveryOptions(options)
      } catch {
        if (cancelled) return
      }
    }
    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [lapsedCompanyIds.join('|')])

  const openActionModal = (company: any) => {
    setActiveCompany(company)
    setSelectedAction('')
    setCustomAction('')
    setActionNote('')
    setActionError(null)
  }

  const closeActionModal = () => {
    if (busyCompanyId) return
    setActiveCompany(null)
  }

  const logRecoveryAction = async (companyId: string) => {
    const selected = selectedAction.trim()
    const custom = customAction.trim()
    const actionToLog = custom || selected
    if (!actionToLog) return
    setBusyCompanyId(companyId)
    setActionError(null)
    try {
      const response = await fetch('/api/admin/recovery-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          actionLabel: selected,
          customAction: custom,
          note: actionNote.trim() || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to log recovery action')
      }
      if (custom && !recoveryOptions.includes(custom)) {
        setRecoveryOptions((prev) => [...prev, custom].sort((a, b) => a.localeCompare(b)))
      }
      setCustomAction('')
      setSelectedAction(actionToLog)
      if (onRefresh) {
        await onRefresh()
      }
      setActiveCompany(null)
    } catch (error: any) {
      setActionError(error?.message || 'Failed to save action')
    } finally {
      setBusyCompanyId(null)
    }
  }

  const lapsedChartData = useMemo(() => {
    const lapsed: any[] = Array.isArray(data?.lapsedCompanies) ? data.lapsedCompanies : []
    const top = lapsed.slice(0, 10).map((row) => ({
      name: row.companyName,
      lifetimeRevenue: Number(row.lifetimeRevenue || 0),
    }))
    const rest = lapsed.slice(10)
    if (rest.length) {
      top.push({
        name: `Other (${rest.length})`,
        lifetimeRevenue: rest.reduce((sum, row) => sum + Number(row.lifetimeRevenue || 0), 0),
      })
    }
    return top
  }, [data?.lapsedCompanies])

  if (!data || data.notEnoughData) return null

  const orderNumberColumns = [
    { key: 'bucket', label: 'Order number' },
    { key: 'revenue', label: 'Revenue', format: 'currency' as const },
    { key: 'orders', label: 'Orders', format: 'count' as const },
    { key: 'averageOrderValue', label: 'AOV', format: 'currency' as const },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RetentionFunnel buckets={data.frequencyDistribution} />

        <ChartCard
          title="Revenue by company order number"
          subtitle="Period revenue split by whether it came from a company's 1st, 2nd, 3rd or later order"
          data={data.revenueByOrderNumber || []}
          columns={orderNumberColumns}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.revenueByOrderNumber}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} />
              <XAxis dataKey="bucket" tick={axisTick(palette.ink.axis)} />
              <YAxis
                tick={axisTick(palette.ink.axis)}
                tickFormatter={(v) => formatValue(v, 'currencyCompact')}
                width={56}
              />
              <Tooltip content={<FormattedTooltip columns={orderNumberColumns} />} />
              <Bar dataKey="revenue" name="Revenue" fill={palette.semantic.revenue} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <CohortHeatmap data={data.cohortRetention} />

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold">Company value segmentation</CardTitle>
          <p className="text-xs text-muted-foreground">
            Buckets are based on lifetime revenue; the Revenue and Orders columns cover the selected period only.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <DataTable
            columns={[
              { key: 'bucket', label: 'Lifetime revenue bucket', sortable: false },
              { key: 'companies', label: 'Companies', format: 'count' },
              { key: 'revenue', label: 'Revenue (selected period)', format: 'currency' },
              { key: 'orders', label: 'Orders (selected period)', format: 'count' },
              { key: 'averageOrdersPerCompany', label: 'Avg orders / company (period)', format: 'count' },
            ]}
            rows={data.valueSegmentation || []}
            rowKey={(row: any) => row.bucket}
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Time between company orders
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="1st to 2nd" value={data.timeBetweenOrders.firstToSecond} format="days" size="compact" />
          <KpiCard label="2nd to 3rd" value={data.timeBetweenOrders.secondToThird} format="days" size="compact" />
          <KpiCard label="3rd to 4th" value={data.timeBetweenOrders.thirdToFourth} format="days" size="compact" />
          <KpiCard label="4th+ average" value={data.timeBetweenOrders.fourthPlus} format="days" size="compact" />
        </div>
      </div>

      <div className="space-y-4">
        {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
        {!data.lapsedCompanies?.length ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">No lapsed companies in this date range.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ChartCard
              title="Lapsed companies by lifetime revenue"
              subtitle="Top 10 highest-value lapsed companies (of the top 25 shown below)"
              data={lapsedChartData}
              columns={[
                { key: 'name', label: 'Company' },
                { key: 'lifetimeRevenue', label: 'Lifetime revenue', format: 'currency' },
              ]}
              height={Math.max(240, lapsedChartData.length * 32 + 40)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lapsedChartData} layout="vertical" margin={{ left: 8, right: 64 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.ink.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={axisTick(palette.ink.axis)}
                    tickFormatter={(v) => formatValue(v, 'currencyCompact')}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    tick={{ ...axisTick(palette.ink.axis), fontSize: 11 }}
                  />
                  <Tooltip
                    content={
                      <FormattedTooltip
                        columns={[{ key: 'lifetimeRevenue', label: 'Lifetime revenue', format: 'currency' }]}
                      />
                    }
                  />
                  <Bar dataKey="lifetimeRevenue" name="Lifetime revenue" fill={palette.categorical[0]}>
                    <LabelList
                      dataKey="lifetimeRevenue"
                      position="right"
                      formatter={(value: number) => formatValue(value, 'currencyCompact')}
                      style={{ fontSize: 11, fill: palette.ink.axis }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Lapsed companies and suggested approach</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
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
                    { key: 'daysSinceLastOrder', label: 'Days since last order', format: 'count' },
                    { key: 'suggestedApproach', label: 'Suggested approach', sortable: false },
                    { key: 'estimatedRecoveryValue', label: 'Est. recovery value', format: 'currency' },
                    {
                      key: 'recoveryActions',
                      label: 'Actions taken',
                      sortable: false,
                      render: (row: any) => (
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {Array.isArray(row.recoveryActions) && row.recoveryActions.length > 0 ? (
                            row.recoveryActions.map((action: any, idx: number) => (
                              <span
                                key={`${row.companyId}-${action.actionLabel}-${idx}`}
                                title={action.note ? `${action.actionLabel}: ${action.note}` : action.actionLabel}
                                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                              >
                                {action.actionLabel}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: 'recovered',
                      label: 'Recovered',
                      render: (row: any) => (row.recovered ? 'Yes' : 'No'),
                    },
                    { key: 'postRecoveryRevenue', label: '$ post recovery', format: 'currency' },
                    {
                      key: 'actions',
                      label: 'Log action',
                      sortable: false,
                      render: (row: any) => (
                        <Button size="sm" variant="outline" onClick={() => openActionModal(row)}>
                          +
                        </Button>
                      ),
                    },
                  ]}
                  rows={data.lapsedCompanies}
                  rowKey={(row: any) => row.companyId}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={!!activeCompany} onOpenChange={(open) => (!open ? closeActionModal() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log recovery action</DialogTitle>
            <DialogDescription>
              {activeCompany?.companyName || 'Selected company'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Action</label>
              <select
                className="h-10 w-full rounded border bg-background px-2 text-sm"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                <option value="">Select action</option>
                {recoveryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Custom action (optional)</label>
              <Input
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
                placeholder="Unique action (saved for future dropdowns)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">What was done (optional note)</label>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="e.g. called office manager, sent founder note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeActionModal} disabled={!!busyCompanyId}>
              Cancel
            </Button>
            <Button
              onClick={() => (activeCompany ? void logRecoveryAction(activeCompany.companyId) : undefined)}
              disabled={!activeCompany || !!busyCompanyId}
            >
              {busyCompanyId ? 'Saving...' : 'Save action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
