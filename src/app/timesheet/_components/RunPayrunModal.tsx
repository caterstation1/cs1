"use client"

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, AlertTriangle } from 'lucide-react'

type StaffRow = {
  staffId: string
  name: string
  xeroEmployeeId: string | null
  payMode: string | null
  fixedWeeklyHours: number | null
  hours: number
  mileageKm: number
  mileageDollars: number
  reimbursements: number
  warnings: string[]
}

type PreviewResult = {
  payPeriodStart: string
  payPeriodEnd: string
  staff: StaffRow[]
  defaultMileageRate: number
}

export default function RunPayrunModal({
  open,
  onOpenChange,
  weekStart: initialWeekStart,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  weekStart?: string
  onSuccess?: () => void
}) {
  const { toast } = useToast()
  const today = getTodayLocal()
  const lastMon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 7)
  const defaultWeek = initialWeekStart ?? formatLocalDate(lastMon)

  const [weekStart, setWeekStart] = useState(defaultWeek)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [overrides, setOverrides] = useState<Record<string, { hours?: number; mileageKm?: number; mileageDollars?: number; reimbursements?: number }>>({})
  const [draftResult, setDraftResult] = useState<{ payrollRunId: string; xeroPayrunId: string } | null>(null)
  const [action, setAction] = useState<'idle' | 'preview' | 'approve' | 'link' | 'draft' | 'post'>('idle')

  useEffect(() => {
    if (!open) return
    if (initialWeekStart) {
      setWeekStart(initialWeekStart)
    }
    // Reset transient state each time the modal opens.
    setDraftResult(null)
    setOverrides({})
  }, [open, initialWeekStart])

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setAction('preview')
    try {
      const res = await fetch('/api/payroll/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, staffOverrides: overrides }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Preview failed')
      }
      const data = await res.json()
      setPreview(data)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Preview failed', variant: 'destructive' })
    } finally {
      setLoading(false)
      setAction('idle')
    }
  }, [weekStart, overrides, toast])

  useEffect(() => {
    if (open && weekStart) loadPreview()
  }, [open, weekStart, loadPreview])

  const createDraft = async () => {
    setLoading(true)
    setAction('draft')
    try {
      const res = await fetch('/api/payroll/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, staffOverrides: overrides, dryRun: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detailText =
          typeof data?.details === 'string'
            ? data.details
            : data?.details
              ? JSON.stringify(data.details)
              : ''
        const message = [data?.error || 'Create draft failed', detailText].filter(Boolean).join(' - ')
        throw new Error(message)
      }
      setDraftResult({ payrollRunId: data.payrollRunId, xeroPayrunId: data.xeroPayrunId })
      toast({ title: 'Success', description: 'Draft payrun created in Xero' })
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Create draft failed', variant: 'destructive' })
    } finally {
      setLoading(false)
      setAction('idle')
    }
  }

  const approveAllShiftsForWeek = async () => {
    setLoading(true)
    setAction('approve')
    try {
      const res = await fetch('/api/timesheet/admin/approve-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Approve all failed')
      toast({ title: 'Shifts approved', description: `${data.approvedCount ?? 0} shifts approved for payroll` })
      await loadPreview()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Approve all failed', variant: 'destructive' })
    } finally {
      setLoading(false)
      setAction('idle')
    }
  }

  const linkStaffByEmail = async () => {
    setLoading(true)
    setAction('link')
    try {
      const res = await fetch('/api/xero/link-staff-by-email', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 400 && data?.diagnostics?.connectionCount === 0) {
          throw new Error('No active Xero connection found. Click "Connect Xero" first, then retry linking.')
        }
        const diag = data?.diagnostics ? ` (${JSON.stringify(data.diagnostics)})` : ''
        throw new Error((data.error || 'Linking staff failed') + diag)
      }
      toast({
        title: 'Xero linking complete',
        description: `${data.linked ?? 0} linked${data.unmatchedCount ? `, ${data.unmatchedCount} unmatched` : ''}${data.ambiguousEmailCount ? `, ${data.ambiguousEmailCount} ambiguous` : ''}`,
      })
      await loadPreview()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Linking staff failed', variant: 'destructive' })
    } finally {
      setLoading(false)
      setAction('idle')
    }
  }

  const connectXero = () => {
    if (typeof window !== 'undefined') {
      window.open('/api/xero/auth', '_blank', 'noopener,noreferrer')
    }
  }

  const postAndDownload = async () => {
    if (!draftResult) {
      toast({ title: 'Error', description: 'Create draft first', variant: 'destructive' })
      return
    }
    setLoading(true)
    setAction('post')
    try {
      const postRes = await fetch('/api/payroll/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollRunId: draftResult.payrollRunId }),
      })
      const postData = await postRes.json()
      if (!postRes.ok) {
        throw new Error(postData.error || 'Post failed. Post the payrun in Xero first, then retry.')
      }
      const fileRes = await fetch(`/api/payroll/bank-file?payrollRunId=${draftResult.payrollRunId}`)
      if (fileRes.ok) {
        const blob = await fileRes.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `payroll_${weekStart}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
      toast({ title: 'Success', description: 'Payrun posted and bank file downloaded' })
      onSuccess?.()
      onOpenChange(false)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Post failed', variant: 'destructive' })
    } finally {
      setLoading(false)
      setAction('idle')
    }
  }

  const updateOverride = (staffId: string, field: 'hours' | 'mileageKm' | 'mileageDollars' | 'reimbursements', value: number) => {
    setOverrides((p) => ({
      ...p,
      [staffId]: { ...p[staffId], [field]: value },
    }))
  }

  const staffWithData = (preview?.staff ?? []).filter(
    (s) => s.hours > 0 || s.mileageKm > 0 || s.mileageDollars > 0 || s.reimbursements > 0 || (s.payMode === 'FIXED_WEEKLY_HOURS' && (s.fixedWeeklyHours ?? 0) > 0)
  )
  const displayRows = staffWithData

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="run-payrun-desc">
        <DialogHeader>
          <DialogTitle>Run Payrun</DialogTitle>
          <DialogDescription id="run-payrun-desc">
            Approve the week, adjust payroll inputs, then create and post the payrun.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-sm">Week (Mon–Sun)</Label>
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-40"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadPreview} disabled={loading}>
              {loading && action === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={approveAllShiftsForWeek} disabled={loading}>
              {loading && action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve All Week Shifts'}
            </Button>
            <Button variant="outline" size="sm" onClick={linkStaffByEmail} disabled={loading}>
              {loading && action === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Staff to Xero by Email'}
            </Button>
            <Button variant="outline" size="sm" onClick={connectXero} disabled={loading}>
              Connect Xero
            </Button>
          </div>

          {preview && (
            <>
              <div className="text-sm text-gray-600">
                {preview.payPeriodStart} → {preview.payPeriodEnd} • Mileage rate: ${preview.defaultMileageRate}/km
              </div>
              <div className="overflow-x-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Mileage (km)</TableHead>
                      <TableHead className="text-right">Mileage $</TableHead>
                      <TableHead className="text-right">Reimbursements</TableHead>
                      <TableHead>Warnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.map((s) => (
                      <TableRow key={s.staffId}>
                        <TableCell className="font-medium">
                          {s.name}
                          {!s.xeroEmployeeId && (
                            <Badge variant="destructive" className="ml-2">No Xero</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.25"
                            className="w-20 text-right"
                            value={overrides[s.staffId]?.hours ?? s.hours}
                            onChange={(e) => updateOverride(s.staffId, 'hours', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="1"
                            className="w-20 text-right"
                            value={overrides[s.staffId]?.mileageKm ?? s.mileageKm}
                            onChange={(e) => updateOverride(s.staffId, 'mileageKm', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          ${(overrides[s.staffId]?.mileageDollars ?? s.mileageDollars).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24 text-right"
                            value={overrides[s.staffId]?.reimbursements ?? s.reimbursements}
                            onChange={(e) => updateOverride(s.staffId, 'reimbursements', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          {s.warnings.length > 0 ? (
                            <div className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                              {s.warnings.join(', ')}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {staffWithData.length === 0 && (
                <p className="text-sm text-gray-500">No approved shift data for this week yet. Click "Approve All Week Shifts", then Refresh.</p>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={loadPreview} disabled={loading} variant="outline">
                  Preview
                </Button>
                <Button
                  onClick={createDraft}
                  disabled={loading || staffWithData.length === 0 || staffWithData.some((s) => !s.xeroEmployeeId)}
                >
                  {loading && action === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Draft Payrun'}
                </Button>
                <Button
                  onClick={postAndDownload}
                  disabled={loading || !draftResult}
                  variant="secondary"
                >
                  {loading && action === 'post' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post + Download Bank File'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Post the payrun in Xero first, then click &quot;Post + Download Bank File&quot; to sync and get the bank payment CSV.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
