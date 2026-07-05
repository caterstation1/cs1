'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

export function CompanyBehaviourPanel({ data, onRefresh }: { data?: any; onRefresh?: () => Promise<void> | void }) {
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

  if (!data || data.notEnoughData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company behaviour</CardTitle>
        </CardHeader>
        <CardContent>Not enough data yet</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Order frequency distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.frequencyDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="companies" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by company order number</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueByOrderNumber}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company value segmentation</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Avg orders/company</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.valueSegmentation.map((row: any) => (
                <TableRow key={row.bucket}>
                  <TableCell>{row.bucket}</TableCell>
                  <TableCell>{row.companies}</TableCell>
                  <TableCell>{row.revenue}</TableCell>
                  <TableCell>{row.orders}</TableCell>
                  <TableCell>{row.averageOrdersPerCompany}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time between company orders</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">1st to 2nd</p>
            <p className="text-lg font-semibold">{data.timeBetweenOrders.firstToSecond}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">2nd to 3rd</p>
            <p className="text-lg font-semibold">{data.timeBetweenOrders.secondToThird}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">3rd to 4th</p>
            <p className="text-lg font-semibold">{data.timeBetweenOrders.thirdToFourth}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">4th+ average</p>
            <p className="text-lg font-semibold">{data.timeBetweenOrders.fourthPlus}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lapsed companies and suggested approach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          {!data.lapsedCompanies?.length ? (
            <p className="text-sm text-muted-foreground">No lapsed companies in this date range.</p>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.lapsedCompanies.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="companyName" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="lifetimeRevenue" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Lifetime revenue</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Days since last order</TableHead>
                    <TableHead>Suggested approach</TableHead>
                    <TableHead>Estimated recovery value</TableHead>
                    <TableHead>Actions taken</TableHead>
                    <TableHead>Recovered</TableHead>
                    <TableHead>$ Post recovery</TableHead>
                    <TableHead>Action taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lapsedCompanies.map((row: any) => (
                    <TableRow key={row.companyId}>
                      <TableCell>{row.companyName}</TableCell>
                      <TableCell>{row.lifetimeRevenue}</TableCell>
                      <TableCell>{row.lifetimeOrders}</TableCell>
                      <TableCell>{row.daysSinceLastOrder ?? '-'}</TableCell>
                      <TableCell>{row.suggestedApproach}</TableCell>
                      <TableCell>{row.estimatedRecoveryValue}</TableCell>
                      <TableCell>
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {Array.isArray(row.recoveryActions) && row.recoveryActions.length > 0 ? (
                            row.recoveryActions.map((action: any, idx: number) => (
                              <span
                                key={`${row.companyId}-${action.actionLabel}-${idx}`}
                                title={
                                  action.note
                                    ? `${action.actionLabel}: ${action.note}`
                                    : action.actionLabel
                                }
                                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                              >
                                {action.actionLabel}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{row.recovered ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{row.postRecoveryRevenue ?? 0}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openActionModal(row)}>
                          +
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
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
