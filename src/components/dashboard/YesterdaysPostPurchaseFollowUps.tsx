'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { LIFECYCLE_EMAIL_TYPES, type LifecycleEmailType } from '@/lib/lifecycle/constants'
import {
  customTemplateKey,
  formatEmailTemplateLabel,
  isLifecycleEmailType,
  parseCustomEmailTemplates,
  systemTemplateKey,
  type CustomEmailTemplate,
} from '@/lib/lifecycle/custom-email-templates'
import { parseVoucherTemplates, resolveVoucherExpiryDays, type VoucherTemplate } from '@/lib/lifecycle/voucher-templates'

type FollowupRow = {
  rowId: string
  orderId: string
  orderNumber: number
  orderName: string
  customerName: string
  customerEmail: string
  customerOrderCount: number
  customerLtv: number
  customerL12v: number
  customerLastFiveOrders: Array<{
    orderNumber: number
    orderDate: string | null
    orderValue: number
  }>
  customerLastCorrespondenceType: string | null
  customerLastCorrespondenceStatus: string | null
  customerLastCorrespondenceAt: string | null
  companyId: string | null
  companyName: string
  deliveryDate: string | null
  deliveryTime: string | null
  orderValue: number
  productsSummary: string
  productsList?: string[]
  companyOrderCount: number
  companyLtv: number
  companyL12v: number
  lastFiveOrders: Array<{
    orderId: string
    orderNumber: number
    orderDate: string | null
    orderValue: number
  }>
  lastCorrespondenceType: string | null
  lastCorrespondenceStatus: string | null
  lastCorrespondenceAt: string | null
  isFirstTimeCompany: boolean
  strategicScore: number
  strategicStatus: string
  rewardCatalogId: string | null
  rewardName: string | null
  suggestedEmailType: LifecycleEmailType
  suggestedAction: string
  selectedEmailType: string | null
  selectedRewardCatalogId: string | null
  selectedRewardIssueId: string | null
  selectedVoucherTemplateId: string | null
  postPurchaseStatus: string
  blockedReason: string | null
  contactId: string | null
  fulfillmentStatus: string | null
  lifecycleStage: string | null
  followupUpdatedAt: string | null
}

type RewardCatalogItem = {
  rewardCatalogId: string
  rewardName: string
  enabled: boolean
}

type FollowupHistoryItem = {
  postPurchaseFollowupActionId: string
  actionType: string
  actionStatus: string
  reason: string | null
  actedAt: string | null
  actedBy: string | null
}

const FILTER_OPTIONS = [
  { id: 'needs_review', label: 'Needs review (default)' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'sent', label: 'Sent' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'no_followup', label: 'No follow-up' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: "All yesterday's orders" },
] as const

function labelize(value: string | null | undefined): string {
  if (!value) return '-'
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactEmailType(type: LifecycleEmailType): string {
  return type
    .replace('_POST_PURCHASE', '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function statusBadgeVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'sent' || normalized === 'completed') return 'default'
  if (normalized === 'blocked' || normalized.includes('failed')) return 'destructive'
  if (normalized.includes('skipped') || normalized.includes('no_followup')) return 'secondary'
  if (normalized === 'test_sent' || normalized === 'previewed') return 'secondary'
  return 'outline'
}

function formatMoney(value: number | null | undefined): string {
  return `$${Number(value || 0).toFixed(2)}`
}

function ordinalLabel(value: number): string {
  const n = Math.max(1, Math.floor(Number(value || 1)))
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const mod10 = n % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}

export default function YesterdaysPostPurchaseFollowUps() {
  const [rows, setRows] = useState<FollowupRow[]>([])
  const [rewardCatalog, setRewardCatalog] = useState<RewardCatalogItem[]>([])
  const [customEmailTemplates, setCustomEmailTemplates] = useState<CustomEmailTemplate[]>([])
  const [voucherTemplates, setVoucherTemplates] = useState<VoucherTemplate[]>([])
  const [historyByRow, setHistoryByRow] = useState<Record<string, FollowupHistoryItem[]>>({})
  const [historyOpenByRow, setHistoryOpenByRow] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]['id']>('needs_review')
  const [offset, setOffset] = useState(0)
  const [limit] = useState(20)
  const [totalRows, setTotalRows] = useState(0)
  const [emailOverrideByRow, setEmailOverrideByRow] = useState<Record<string, string>>({})
  const [rewardByRow, setRewardByRow] = useState<Record<string, string>>({})
  const [voucherByRow, setVoucherByRow] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [followupsRes, catalogRes, settingsRes] = await Promise.all([
        fetch(
          `/api/admin/post-purchase-queue?filter=${encodeURIComponent(filter)}&limit=${limit}&offset=${offset}`
        ),
        fetch('/api/admin/customer-lifecycle/rewards/catalog'),
        fetch('/api/admin/customer-lifecycle/templates'),
      ])
      const [followupsJson, catalogJson, settingsJson] = await Promise.all([
        followupsRes.json(),
        catalogRes.json(),
        settingsRes.json(),
      ])
      setRows(Array.isArray(followupsJson?.rows) ? followupsJson.rows : [])
      setTotalRows(Number(followupsJson?.pagination?.total || 0))
      setRewardCatalog(Array.isArray(catalogJson?.rows) ? catalogJson.rows.filter((r: any) => r.enabled) : [])
      setCustomEmailTemplates(
        parseCustomEmailTemplates(settingsJson?.settings?.rewardRuleConfig?.customTemplates).filter((row) => row.enabled)
      )
      setVoucherTemplates(parseVoucherTemplates(settingsJson?.settings?.rewardRuleConfig?.voucherTemplates).filter((row) => row.enabled))
    } finally {
      setLoading(false)
    }
  }, [filter, limit, offset])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setOffset(0)
  }, [filter])

  const selectedTemplateKey = useCallback(
    (row: FollowupRow): string => {
      const override = emailOverrideByRow[row.rowId]
      if (override) return override
      const stored = row.selectedEmailType
      if (stored) {
        if (stored.startsWith('custom:') || stored.startsWith('system:')) return stored
        if (isLifecycleEmailType(stored)) return systemTemplateKey(stored)
        return stored
      }
      return systemTemplateKey(row.suggestedEmailType)
    },
    [emailOverrideByRow]
  )

  const selectedRewardId = useCallback(
    (row: FollowupRow): string => rewardByRow[row.rowId] || row.selectedRewardCatalogId || row.rewardCatalogId || '',
    [rewardByRow]
  )

  const selectedVoucherId = useCallback(
    (row: FollowupRow): string => voucherByRow[row.rowId] || row.selectedVoucherTemplateId || '',
    [voucherByRow]
  )

  const callQueueAction = async (
    row: FollowupRow,
    action: string,
    extra?: Record<string, any>
  ) => {
    const res = await fetch(`/api/admin/post-purchase-queue/${encodeURIComponent(row.rowId)}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        emailType: selectedTemplateKey(row),
        rewardCatalogId: selectedRewardId(row) || null,
        voucherTemplateId: selectedVoucherId(row) || null,
        ...extra,
      }),
    })
    const json = await res.json().catch(() => ({}))
    return { res, json }
  }

  const openPreview = async (row: FollowupRow) => {
    if (!row.companyId) return
    setBusyKey(`preview:${row.rowId}`)
    try {
      const { res, json } = await callQueueAction(row, 'preview')
      if (!res.ok) {
        setMessage(`Preview state update failed: ${json?.error || 'Unknown error'}`)
      }
      const templateKey = selectedTemplateKey(row)
      const params = new URLSearchParams({
        companyId: row.companyId,
        emailType: row.suggestedEmailType,
        orderId: row.orderId,
        templateKey,
        ...(row.contactId ? { contactId: row.contactId } : {}),
        ...(json?.rewardIssueId ? { rewardIssueId: String(json.rewardIssueId) } : {}),
      })
      window.open(`/api/admin/customer-lifecycle/preview?${params.toString()}`, '_blank', 'noopener,noreferrer')
      await loadData()
    } finally {
      setBusyKey(null)
    }
  }

  const sendLive = async (row: FollowupRow) => {
    if (!row.companyId) return
    setBusyKey(`send:${row.rowId}`)
    try {
      const { res, json } = await callQueueAction(row, 'send')
      setMessage(
        res.ok
          ? 'Email sent to the customer on file.'
          : `Send failed: ${json?.error || json?.result?.results?.[0]?.reason || 'Unknown error'}`
      )
      await loadData()
    } finally {
      setBusyKey(null)
    }
  }

  const markStrategic = async (row: FollowupRow) => {
    if (!row.companyId) return
    setBusyKey(`strategic:${row.rowId}`)
    try {
      const { res, json } = await callQueueAction(row, 'mark_strategic')
      setMessage(res.ok ? 'Marked as strategic.' : `Could not mark strategic: ${json?.error || 'Unknown error'}`)
      await loadData()
    } finally {
      setBusyKey(null)
    }
  }

  const issueReward = async (row: FollowupRow) => {
    if (!row.companyId) return
    const rewardCatalogId = selectedRewardId(row)
    if (!rewardCatalogId) return
    setBusyKey(`reward:${row.rowId}`)
    try {
      const { res, json } = await callQueueAction(row, 'issue_reward', { rewardCatalogId })
      setMessage(res.ok ? 'Reward issued.' : `Reward issue failed: ${json?.error || 'Unknown error'}`)
      await loadData()
    } finally {
      setBusyKey(null)
    }
  }

  const logAction = async (row: FollowupRow, status: 'skipped_manual' | 'no_follow_up_needed') => {
    if (!row.companyId) return
    setBusyKey(`${status}:${row.rowId}`)
    try {
      const { res, json } = await callQueueAction(row, status === 'skipped_manual' ? 'skip' : 'no_followup', {
        reason: status === 'skipped_manual' ? 'Skipped for now from queue' : 'No follow-up needed',
      })
      if (!res.ok) {
        setMessage(`Could not update status: ${json?.error || 'Unknown error'}`)
      }
      setMessage(status === 'skipped_manual' ? 'Marked skipped for now.' : 'Marked no follow-up needed.')
      await loadData()
    } finally {
      setBusyKey(null)
    }
  }

  const markFulfilled = async (row: FollowupRow) => {
    setBusyKey(`fulfilled:${row.rowId}`)
    try {
      const { res, json } = await callQueueAction(row, 'mark_fulfilled')
      setMessage(res.ok ? 'Order marked fulfilled.' : `Could not mark fulfilled: ${json?.error || 'Unknown error'}`)
      await loadData()
    } finally {
      setBusyKey(null)
    }
  }

  const loadHistory = async (row: FollowupRow) => {
    setBusyKey(`history:${row.rowId}`)
    try {
      const nextOpen = !historyOpenByRow[row.rowId]
      setHistoryOpenByRow((prev) => ({ ...prev, [row.rowId]: nextOpen }))
      if (!nextOpen) return
      if (historyByRow[row.rowId]?.length) return
      const res = await fetch(`/api/admin/post-purchase-queue/${encodeURIComponent(row.rowId)}/history`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(`Could not load history: ${json?.error || 'Unknown error'}`)
        return
      }
      const actions = (Array.isArray(json.actions) ? json.actions : []) as FollowupHistoryItem[]
      setHistoryByRow((prev) => ({ ...prev, [row.rowId]: actions }))
    } finally {
      setBusyKey(null)
    }
  }

  const orderedRows = useMemo(
    () => [...rows].sort((a, b) => Number(b.orderNumber || 0) - Number(a.orderNumber || 0)),
    [rows]
  )

  const kpis = useMemo(() => {
    const blocked = orderedRows.filter((row) => Boolean(row.blockedReason)).length
    const sent = orderedRows.filter((row) => row.postPurchaseStatus === 'sent').length
    const skipped = orderedRows.filter((row) => ['skipped', 'no_followup'].includes(String(row.postPurchaseStatus || ''))).length
    const actionable = orderedRows.filter((row) =>
      ['pending_review', 'previewed', 'test_sent'].includes(String(row.postPurchaseStatus || ''))
    ).length
    return { blocked, sent, skipped, actionable }
  }, [orderedRows])

  const pageStart = totalRows === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + rows.length, totalRows)

  return (
    <Card className="dashboard-card xl:col-span-2">
      <CardHeader className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="space-y-1">
          <CardTitle>Post-Purchase Queue</CardTitle>
            <p className="text-xs text-muted-foreground">
              Order-level daily workflow for yesterday&apos;s delivered orders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/customer-lifecycle/templates">Edit Templates</Link>
            </Button>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              disabled={loading || offset === 0}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset((prev) => prev + limit)}
              disabled={loading || offset + limit >= totalRows}
            >
              Next
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Total: {totalRows}</Badge>
          <Badge variant="outline">
            Showing: {pageStart}-{pageEnd} of {totalRows}
          </Badge>
          <Badge variant="secondary">Actionable: {kpis.actionable}</Badge>
          <Badge variant="outline">Blocked: {kpis.blocked}</Badge>
          <Badge variant="outline">Sent: {kpis.sent}</Badge>
          <Badge variant="outline">Skipped: {kpis.skipped}</Badge>
        </div>
        {message ? <div className="text-xs text-muted-foreground">{message}</div> : null}
      </CardHeader>
      <CardContent className="overflow-auto">
        <div className="space-y-3">
          {orderedRows.map((row) => {
            const blocked = Boolean(row.blockedReason)
            const templateKey = selectedTemplateKey(row)
            const rowBusy = busyKey?.endsWith(`:${row.rowId}`)
            const productItems = Array.isArray(row.productsList)
              ? row.productsList
              : String(row.productsSummary || '')
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
            return (
              <div key={row.rowId} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-2">
                  <div>
                    <div className="text-sm font-semibold">{row.orderName} • {row.customerName || '-'}</div>
                    <div className="text-xs text-muted-foreground">{row.customerEmail || '-'}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{row.isFirstTimeCompany ? 'First-time company' : 'Repeat company'}</Badge>
                      <Badge variant="outline">
                        {row.customerOrderCount <= 1
                          ? '1st-time customer'
                          : `${ordinalLabel(row.customerOrderCount)} order customer`}
                      </Badge>
                      <Badge variant={row.strategicStatus === 'standard' ? 'secondary' : 'default'}>
                        {row.strategicStatus === 'manual_strategic' ? 'Manual strategic' : row.strategicStatus === 'strategic_candidate' ? 'Strategic candidate' : 'Standard'}
                      </Badge>
                      <Badge variant="outline">Score {row.strategicScore}</Badge>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div>{row.deliveryDate ? new Date(`${row.deliveryDate}T00:00:00`).toLocaleDateString() : '-'}</div>
                    <div className="text-muted-foreground">{row.deliveryTime || '-'}</div>
                    <div className="mt-1 font-semibold">${Number(row.orderValue || 0).toFixed(2)}</div>
                    <div className="mt-1">
                      <Badge variant={String(row.fulfillmentStatus || '').toLowerCase() === 'fulfilled' ? 'default' : 'secondary'}>
                        Fulfilment: {row.fulfillmentStatus || 'unfulfilled'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="space-y-1 text-xs">
                    <div className="font-medium">Company</div>
                    <div>{row.companyName}</div>
                    <div className="text-muted-foreground">{row.companyOrderCount} company orders</div>
                    <div className="text-muted-foreground">LTV: {formatMoney(row.companyLtv)}</div>
                    <div className="text-muted-foreground">L12V: {formatMoney(row.companyL12v)}</div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-medium">Last 5 orders</div>
                    {row.lastFiveOrders?.length ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {row.lastFiveOrders.map((orderRow, idx) => (
                          <li key={`${row.rowId}-o-${idx}`} className="line-clamp-1">
                            #{orderRow.orderNumber || orderRow.orderId} • {orderRow.orderDate || '-'} • {formatMoney(orderRow.orderValue)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground">-</div>
                    )}
                    <div className="pt-1">
                      <div className="font-medium">Last correspondence (company queue)</div>
                      {row.lastCorrespondenceType ? (
                        <div className="text-muted-foreground">
                          {labelize(row.lastCorrespondenceType)}
                          {row.lastCorrespondenceAt ? ` • ${new Date(row.lastCorrespondenceAt).toLocaleString()}` : ''}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Nil</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="font-medium">Customer analytics</div>
                    <div className="text-muted-foreground">Orders: {row.customerOrderCount || 0}</div>
                    <div className="text-muted-foreground">LTV: {formatMoney(row.customerLtv)}</div>
                    <div className="text-muted-foreground">L12V: {formatMoney(row.customerL12v)}</div>
                    <div className="font-medium pt-1">Last 5 customer orders</div>
                    {row.customerLastFiveOrders?.length ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {row.customerLastFiveOrders.map((orderRow, idx) => (
                          <li key={`${row.rowId}-co-${idx}`} className="line-clamp-1">
                            #{orderRow.orderNumber || '-'} • {orderRow.orderDate || '-'} • {formatMoney(orderRow.orderValue)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground">-</div>
                    )}
                    <div className="font-medium pt-1">Last correspondence (customer lifecycle)</div>
                    {row.customerLastCorrespondenceType ? (
                      <div className="space-y-1">
                        <div>{labelize(row.customerLastCorrespondenceType)}</div>
                        <div className="text-muted-foreground">
                          {row.customerLastCorrespondenceAt ? new Date(row.customerLastCorrespondenceAt).toLocaleString() : '-'}
                          {row.customerLastCorrespondenceStatus ? ` • ${labelize(row.customerLastCorrespondenceStatus)}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Nil</div>
                    )}
                    <div className="font-medium">Suggested Action</div>
                    <div>{row.suggestedAction}</div>
                    <div className="text-muted-foreground">Lifecycle stage: {row.lifecycleStage || '-'}</div>
                    <Select
                      value={templateKey}
                      onValueChange={(value) => {
                        setEmailOverrideByRow((prev) => ({ ...prev, [row.rowId]: value }))
                        void callQueueAction(row, 'select_email_template', { emailType: value })
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <span className="truncate text-left">
                          {formatEmailTemplateLabel(templateKey, customEmailTemplates)}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {LIFECYCLE_EMAIL_TYPES.map((type) => (
                          <SelectItem key={systemTemplateKey(type)} value={systemTemplateKey(type)}>
                            {compactEmailType(type)} (System)
                          </SelectItem>
                        ))}
                        {customEmailTemplates.map((template) => (
                          <SelectItem key={customTemplateKey(template.templateId)} value={customTemplateKey(template.templateId)}>
                            {template.templateName} (Custom)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {voucherTemplates.length ? (
                      <Select
                        value={selectedVoucherId(row) || undefined}
                        onValueChange={(value) => {
                          setVoucherByRow((prev) => ({ ...prev, [row.rowId]: value }))
                          void callQueueAction(row, 'select_voucher', { voucherTemplateId: value })
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select voucher (optional)" />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          {voucherTemplates.map((voucher) => (
                            <SelectItem key={voucher.voucherTemplateId} value={voucher.voucherTemplateId}>
                              {voucher.label} ({resolveVoucherExpiryDays(voucher)}d)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {productItems.length ? (
                      <div className="pt-1">
                        <div className="font-medium">Products</div>
                        <ul className="list-disc space-y-0.5 pl-4">
                          {productItems.slice(0, 4).map((product, idx) => (
                            <li key={`${row.rowId}-p-${idx}`} className="line-clamp-1">
                              {product}
                            </li>
                          ))}
                          {productItems.length > 4 ? <li className="text-muted-foreground">+{productItems.length - 4} more</li> : null}
                        </ul>
                      </div>
                    ) : null}
                    {row.rewardName ? (
                      <div className="pt-1">
                        <Badge variant="outline">Reward: {row.rewardName}</Badge>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Post-purchase status:</span>
                    {row.postPurchaseStatus ? <Badge variant={statusBadgeVariant(row.postPurchaseStatus)}>{labelize(row.postPurchaseStatus)}</Badge> : <Badge variant="outline">Pending</Badge>}
                    {row.blockedReason ? <Badge variant="destructive">{labelize(row.blockedReason)}</Badge> : null}
                    {row.selectedRewardIssueId ? <Badge variant="outline">Reward issue linked</Badge> : null}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openPreview(row)} disabled={!row.companyId || rowBusy}>
                      Preview
                    </Button>
                    <Button size="sm" onClick={() => sendLive(row)} disabled={!row.companyId || blocked || rowBusy}>
                      Send
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markStrategic(row)} disabled={!row.companyId || rowBusy}>
                      Strategic
                    </Button>
                    <Select
                      value={selectedRewardId(row)}
                      onValueChange={(value) => {
                        setRewardByRow((prev) => ({ ...prev, [row.rowId]: value }))
                        void callQueueAction(row, 'select_reward', { rewardCatalogId: value })
                      }}
                    >
                      <SelectTrigger className="h-8 w-[190px]">
                        <SelectValue placeholder="Select reward" />
                      </SelectTrigger>
                      <SelectContent>
                        {rewardCatalog.map((reward) => (
                          <SelectItem key={reward.rewardCatalogId} value={reward.rewardCatalogId}>
                            {reward.rewardName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => issueReward(row)} disabled={!row.companyId || !selectedRewardId(row) || rowBusy}>
                      Issue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markFulfilled(row)}
                      disabled={String(row.fulfillmentStatus || '').toLowerCase() === 'fulfilled' || rowBusy}
                    >
                      Mark fulfilled
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => logAction(row, 'skipped_manual')} disabled={!row.companyId || rowBusy}>
                      Skip
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => logAction(row, 'no_follow_up_needed')} disabled={!row.companyId || rowBusy}>
                      No follow-up
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        setBusyKey(`complete:${row.rowId}`)
                        try {
                          const { res, json } = await callQueueAction(row, 'mark_completed')
                          setMessage(
                            res.ok
                              ? 'Marked completed.'
                              : `Could not mark completed: ${json?.error || 'Unknown error'}`
                          )
                          await loadData()
                        } finally {
                          setBusyKey(null)
                        }
                      }}
                      disabled={!['sent', 'skipped', 'no_followup'].includes(row.postPurchaseStatus) || rowBusy}
                    >
                      Complete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => loadHistory(row)} disabled={rowBusy}>
                      {historyOpenByRow[row.rowId] ? 'Hide history' : 'History'}
                    </Button>
                    {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  </div>
                </div>
                {historyOpenByRow[row.rowId] ? (
                  <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-2 text-xs">
                    <div className="mb-1 font-medium">Action history</div>
                    {(historyByRow[row.rowId] || []).length ? (
                      <div className="space-y-1">
                        {(historyByRow[row.rowId] || []).slice(0, 15).map((item) => (
                          <div key={item.postPurchaseFollowupActionId} className="flex flex-wrap gap-x-2">
                            <span className="text-muted-foreground">
                              {item.actedAt ? new Date(item.actedAt).toLocaleString() : '-'}
                            </span>
                            <span>{labelize(item.actionType)}</span>
                            <span className="text-muted-foreground">({labelize(item.actionStatus)})</span>
                            {item.reason ? <span> - {item.reason}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">No history yet.</div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
          {!orderedRows.length && !loading ? <div className="py-6 text-sm text-muted-foreground">No follow-up rows found for yesterday.</div> : null}
        </div>
      </CardContent>
    </Card>
  )
}
