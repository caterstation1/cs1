'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'

type Summary = {
  awaitingSecond: number
  strategicFirst: number
  rewardsIssued: number
  rewardsRedeemed: number
  atRisk: number
  vipCount: number
  recentSends: any[]
}

type Suggestion = {
  suggestionId: string
  companyId: string
  companyName: string
  contactId?: string | null
  contactName?: string | null
  contactEmail?: string | null
  firstOrderDate?: string | null
  lastOrderDate?: string | null
  orderCount: number
  totalSpend: number
  daysSinceLastOrder: number
  strategicScore: number
  lifecycleStage: string
  suggestedEmailType: string
  suggestedNextAction: string
  rewardCatalogId?: string | null
  rewardName?: string | null
}

type TemplateSettings = {
  enabled: boolean
  liveMode: boolean
  automationEnabled: boolean
  bulkSendingEnabled: boolean
  requireAdminApproval: boolean
  testRecipientEmail: string | null
}

const EMAIL_TYPES = [
  'FIRST_ORDER_POST_PURCHASE',
  'REPEAT_ORDER_POST_PURCHASE',
  'REVIEW_REQUEST',
  'FEEDBACK_REQUEST',
  'SECOND_ORDER_INCENTIVE',
  'STRATEGIC_SECOND_ORDER_VOUCHER',
  'SPEND_MILESTONE_REWARD',
  'REACTIVATION',
  'VIP',
] as const

export default function CustomerLifecycleAdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedEmailType, setSelectedEmailType] = useState<string>('SECOND_ORDER_INCENTIVE')
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null)
  const [rewardCatalog, setRewardCatalog] = useState<any[]>([])
  const [rewardIssues, setRewardIssues] = useState<any[]>([])
  const [selectedRewardCatalogId, setSelectedRewardCatalogId] = useState<string>('')
  const [pauseDays, setPauseDays] = useState<string>('30')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryRes, suggestionsRes, templatesRes, rewardCatalogRes, rewardIssueRes] = await Promise.all([
        fetch('/api/admin/customer-lifecycle/summary'),
        fetch('/api/admin/customer-lifecycle/suggestions?limit=400'),
        fetch('/api/admin/customer-lifecycle/templates'),
        fetch('/api/admin/customer-lifecycle/rewards/catalog'),
        fetch('/api/admin/customer-lifecycle/rewards/issue'),
      ])
      const summaryJson = await summaryRes.json()
      const suggestionsJson = await suggestionsRes.json()
      const templatesJson = await templatesRes.json()
      const rewardCatalogJson = await rewardCatalogRes.json()
      const rewardIssueJson = await rewardIssueRes.json()
      if (summaryJson?.success) setSummary(summaryJson.summary)
      if (suggestionsJson?.success) setSuggestions(suggestionsJson.rows || [])
      if (templatesJson?.success) setTemplateSettings(templatesJson.settings)
      if (rewardCatalogJson?.success) setRewardCatalog(rewardCatalogJson.rows || [])
      if (rewardIssueJson?.success) setRewardIssues(rewardIssueJson.rows || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const selectedRows = useMemo(
    () => suggestions.filter((row) => selectedIds.has(row.suggestionId)),
    [suggestions, selectedIds]
  )

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const openSinglePreview = (row: Suggestion) => {
    const params = new URLSearchParams({
      companyId: row.companyId,
      emailType: selectedEmailType || row.suggestedEmailType,
      ...(row.contactId ? { contactId: row.contactId } : {}),
    })
    window.open(`/api/admin/customer-lifecycle/preview?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  const approveAndSendSingle = async (row: Suggestion) => {
    setBusyAction(`send-${row.suggestionId}`)
    try {
      await fetch('/api/admin/customer-lifecycle/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: row.companyId,
          contactId: row.contactId,
          emailType: selectedEmailType || row.suggestedEmailType,
        }),
      })
      await loadAll()
    } finally {
      setBusyAction(null)
    }
  }

  const openBulkPreview = async () => {
    setBusyAction('bulk-preview')
    try {
      const payload = {
        items: selectedRows.map((row) => ({
          companyId: row.companyId,
          contactId: row.contactId,
          emailType: selectedEmailType || row.suggestedEmailType,
        })),
      }
      const res = await fetch('/api/admin/customer-lifecycle/bulk-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json?.summary) {
        alert(
          [
            `Selected: ${json.summary.selectedCount}`,
            `OK to send: ${json.summary.okCount}`,
            `Skipped: ${json.summary.skipCount}`,
            `Email types: ${json.summary.emailTypes?.join(', ') || '-'}`,
            `Recipients: ${json.summary.recipients?.length || 0}`,
            `Companies: ${json.summary.companies?.length || 0}`,
            `Rewards: ${json.summary.rewards?.join(', ') || '-'}`,
          ].join('\n')
        )
      }
    } finally {
      setBusyAction(null)
    }
  }

  const approveAndSendBulk = async () => {
    if (!selectedRows.length) return
    setBusyAction('bulk-send')
    try {
      await fetch('/api/admin/customer-lifecycle/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedRows.map((row) => ({
            companyId: row.companyId,
            contactId: row.contactId,
            emailType: selectedEmailType || row.suggestedEmailType,
          })),
        }),
      })
      setSelectedIds(new Set())
      await loadAll()
    } finally {
      setBusyAction(null)
    }
  }

  const applyCompanyOverride = async (row: Suggestion, patch: Record<string, any>) => {
    setBusyAction(`override-${row.suggestionId}`)
    try {
      await fetch('/api/admin/customer-lifecycle/company-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: row.companyId, ...patch }),
      })
      await loadAll()
    } finally {
      setBusyAction(null)
    }
  }

  const issueRewardManually = async (row: Suggestion) => {
    if (!selectedRewardCatalogId) return
    setBusyAction(`reward-${row.suggestionId}`)
    try {
      await fetch('/api/admin/customer-lifecycle/rewards/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: row.companyId,
          contactId: row.contactId,
          rewardCatalogId: selectedRewardCatalogId,
          sourceType: 'manual',
          status: 'issued',
        }),
      })
      await loadAll()
    } finally {
      setBusyAction(null)
    }
  }

  const toggleAll = (checked: boolean) => {
    if (!checked) return setSelectedIds(new Set())
    setSelectedIds(new Set(suggestions.map((row) => row.suggestionId)))
  }

  return (
    <div className="dashboard-page container mx-auto p-6 space-y-6 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Lifecycle + Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Manual-first lifecycle emails with preview, approvals, and reward tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/customer-lifecycle/templates">Templates</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Safety Status</CardTitle>
          <CardDescription>Lifecycle sends remain controlled by explicit settings.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <div>Enabled: {String(templateSettings?.enabled ?? false)}</div>
          <div>Live mode: {String(templateSettings?.liveMode ?? false)}</div>
          <div>Automation: {String(templateSettings?.automationEnabled ?? false)}</div>
          <div>Bulk sending: {String(templateSettings?.bulkSendingEnabled ?? false)}</div>
          <div>Admin approval: {String(templateSettings?.requireAdminApproval ?? true)}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Metric label="Awaiting second" value={summary?.awaitingSecond ?? 0} />
        <Metric label="Strategic first-time" value={summary?.strategicFirst ?? 0} />
        <Metric label="Rewards issued" value={summary?.rewardsIssued ?? 0} />
        <Metric label="Rewards redeemed" value={summary?.rewardsRedeemed ?? 0} />
        <Metric label="At risk" value={summary?.atRisk ?? 0} />
        <Metric label="VIP" value={summary?.vipCount ?? 0} />
      </div>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Queue Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Email Type Override</Label>
            <Select value={selectedEmailType} onValueChange={setSelectedEmailType}>
              <SelectTrigger className="w-[320px] mt-1 bg-white border-slate-300 text-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reward for manual issue</Label>
            <Select value={selectedRewardCatalogId} onValueChange={setSelectedRewardCatalogId}>
              <SelectTrigger className="w-[320px] mt-1 bg-white border-slate-300 text-slate-900">
                <SelectValue placeholder="Select reward catalog item" />
              </SelectTrigger>
              <SelectContent>
                {rewardCatalog.map((r) => (
                  <SelectItem key={r.rewardCatalogId} value={r.rewardCatalogId}>
                    {r.rewardName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={openBulkPreview} disabled={!selectedRows.length || busyAction === 'bulk-preview'}>
              {busyAction === 'bulk-preview' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Bulk Preview
            </Button>
            <Button onClick={approveAndSendBulk} disabled={!selectedRows.length || busyAction === 'bulk-send'}>
              {busyAction === 'bulk-send' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Approve + Send Bulk
            </Button>
            <Button variant="outline" onClick={loadAll} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Suggested Lifecycle Emails</CardTitle>
          <CardDescription>Preview before sending. Owner/Admin approvals required for sends.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px]">
                  <Checkbox checked={selectedRows.length > 0 && selectedRows.length === suggestions.length} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total spend</TableHead>
                <TableHead>Days since</TableHead>
                <TableHead>Strategic</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Suggested</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead className="min-w-[440px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((row) => {
                const busy =
                  busyAction === `send-${row.suggestionId}` ||
                  busyAction === `override-${row.suggestionId}` ||
                  busyAction === `reward-${row.suggestionId}`
                return (
                  <TableRow key={row.suggestionId}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(row.suggestionId)} onCheckedChange={(v) => toggleRow(row.suggestionId, Boolean(v))} />
                    </TableCell>
                    <TableCell>{row.companyName}</TableCell>
                    <TableCell>{row.contactName || row.contactEmail || '-'}</TableCell>
                    <TableCell>{row.orderCount}</TableCell>
                    <TableCell>${row.totalSpend.toFixed(2)}</TableCell>
                    <TableCell>{row.daysSinceLastOrder}</TableCell>
                    <TableCell>{row.strategicScore}</TableCell>
                    <TableCell>{row.lifecycleStage}</TableCell>
                    <TableCell>{row.suggestedEmailType}</TableCell>
                    <TableCell>{row.rewardName || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openSinglePreview(row)} disabled={busy}>
                          Preview
                        </Button>
                        <Button size="sm" onClick={() => approveAndSendSingle(row)} disabled={busy}>
                          Approve + Send
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyCompanyOverride(row, { isStrategicOverride: true })}
                          disabled={busy}
                        >
                          Mark Strategic
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyCompanyOverride(row, { isStrategicOverride: false })}
                          disabled={busy}
                        >
                          Not Strategic
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyCompanyOverride(row, { isVipOverride: true })}
                          disabled={busy}
                        >
                          Mark VIP
                        </Button>
                        <div className="flex items-center gap-2">
                          <Input
                            value={pauseDays}
                            onChange={(e) => setPauseDays(e.target.value)}
                            className="w-20 bg-white border-slate-300 text-slate-900 h-8"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyCompanyOverride(row, { pauseDays: Number(pauseDays || 0) })}
                            disabled={busy}
                          >
                            Pause
                          </Button>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => issueRewardManually(row)} disabled={busy || !selectedRewardCatalogId}>
                          Issue Reward
                        </Button>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Recent Reward Issues</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewardIssues.slice(0, 30).map((row) => (
                <TableRow key={row.rewardIssueId}>
                  <TableCell>{row.company?.canonicalCompanyName || '-'}</TableCell>
                  <TableCell>{row.rewardCatalog?.rewardName || '-'}</TableCell>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="dashboard-card">
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}
