'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CompanySearchSelect } from '@/components/dashboard/executive/CompanySearchSelect'

type DetailData = {
  summary: any
  contacts: any[]
  orders: any[]
  auditTrail: any[]
  recoveryActions?: Array<{
    recoveryActionId: string
    actionLabel: string
    note: string | null
    createdBy: string | null
    createdAt: string
  }>
}

async function postJson(url: string, payload: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Request failed: ${url}`)
  return data
}

export default function AdminCompanyDetailPage() {
  const params = useParams<{ companyId: string }>()
  const companyId = String(params?.companyId || '')
  const [state, setState] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<{ companyId?: string; companyName?: string; domain?: string | null }>({})
  const [renameValue, setRenameValue] = useState('')
  const [genericDomain, setGenericDomain] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load company')
      setState(data)
      setRenameValue(data?.summary?.canonicalCompanyName || '')
      setGenericDomain(data?.summary?.primaryDomain || '')
    } catch (err: any) {
      setError(err?.message || 'Failed to load company')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
  }, [load])

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const selectedCount = selectedOrderIds.size
  const selectedOrders = useMemo(() => Array.from(selectedOrderIds), [selectedOrderIds])

  const runAction = async (name: string, fn: () => Promise<void>) => {
    setBusyAction(name)
    setError(null)
    try {
      await fn()
      await load()
      setSelectedOrderIds(new Set())
    } catch (err: any) {
      setError(err?.message || `${name} failed`)
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading company...</div>
  if (error && !state) return <div className="p-6 text-sm text-red-600">{error}</div>
  if (!state) return null

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{state.summary.canonicalCompanyName}</h1>
          <p className="text-sm text-muted-foreground">
            {state.summary.primaryDomain || 'No primary domain'} | {state.summary.status}
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/dashboard/executive">Back to dashboard</a>
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Company summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Metric label="Lifetime revenue" value={state.summary.lifetimeRevenue} />
          <Metric label="Lifetime orders" value={state.summary.lifetimeOrders} />
          <Metric label="AOV" value={state.summary.averageOrderValue} />
          <Metric label="Contacts" value={state.summary.contactsCount} />
          <Metric label="First order" value={state.summary.firstOrderDate ? new Date(state.summary.firstOrderDate).toLocaleDateString('en-NZ') : '-'} />
          <Metric label="Last order" value={state.summary.lastOrderDate ? new Date(state.summary.lastOrderDate).toLocaleDateString('en-NZ') : '-'} />
          <Metric label="Days since last order" value={state.summary.daysSinceLastOrder ?? '-'} />
          <Metric label="Unique addresses" value={state.summary.uniqueAddresses} />
          <Metric label="Match confidence" value={state.summary.matchConfidence} />
          <Metric label="Primary domain" value={state.summary.primaryDomain || '-'} />
          <Metric label="Alternate domains" value={(state.summary.alternateDomains || []).join(', ') || '-'} />
          <Metric label="Status" value={state.summary.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company editing actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rename company</Label>
              <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
              <Button
                onClick={() =>
                  runAction('rename', async () => {
                    await postJson('/api/admin/companies/rename', {
                      companyId,
                      newCanonicalName: renameValue,
                    })
                  })
                }
                disabled={busyAction !== null || !renameValue.trim()}
              >
                {busyAction === 'rename' ? 'Saving...' : 'Rename company'}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Mark domain as generic/private</Label>
              <Input value={genericDomain} onChange={(e) => setGenericDomain(e.target.value)} />
              <Button
                variant="secondary"
                onClick={() =>
                  runAction('mark-domain-generic', async () => {
                    await postJson('/api/admin/companies/mark-domain-generic', {
                      domain: genericDomain,
                      reason: `Marked from company detail page (${companyId})`,
                    })
                  })
                }
                disabled={busyAction !== null || !genericDomain.trim()}
              >
                {busyAction === 'mark-domain-generic' ? 'Updating...' : 'Mark domain generic/private'}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Target company selector (for reassignment, merge, split)</Label>
            <CompanySearchSelect
              value={selection.companyName}
              onChange={(next) => setSelection(next)}
              allowCreate
              createLabel="Create company"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                runAction('merge-company', async () => {
                  if (!selection.companyId) throw new Error('Select target company first')
                  await postJson('/api/admin/companies/merge', {
                    sourceCompanyId: companyId,
                    targetCompanyId: selection.companyId,
                    reason: 'Merged from company detail workflow',
                  })
                })
              }
              disabled={busyAction !== null}
            >
              Merge into selected company
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                runAction('split-company', async () => {
                  if (!selection.companyId && !selection.companyName) {
                    throw new Error('Select or create a target company for split')
                  }
                  await postJson('/api/admin/companies/split', {
                    sourceCompanyId: companyId,
                    targetCompanyId: selection.companyId,
                    targetCompanyName: selection.companyName,
                    targetDomain: selection.domain || null,
                    shopifyOrderIds: selectedOrders,
                    reason: 'Split from company detail workflow',
                  })
                })
              }
              disabled={busyAction !== null || selectedCount === 0}
            >
              Split selected orders to target
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction('reassign-orders', async () => {
                  if (!selection.companyId && !selection.companyName) {
                    throw new Error('Select or create a target company')
                  }
                  await postJson('/api/admin/companies/reassign-orders', {
                    shopifyOrderIds: selectedOrders,
                    targetCompanyId: selection.companyId,
                    targetCompanyName: selection.companyName,
                    targetDomain: selection.domain || null,
                    reason: 'Manual selected-order reassignment',
                  })
                })
              }
              disabled={busyAction !== null || selectedCount === 0}
            >
              Reassign selected orders
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.contacts.map((contact) => (
            <div key={contact.contactId} className="rounded border p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{contact.contactName}</p>
                  <p className="text-xs text-muted-foreground">
                    {contact.email || 'No email'} | {contact.shopifyCustomerId || 'No Shopify customer id'}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  ${contact.totalRevenue.toLocaleString('en-NZ')} | {contact.totalOrders} orders
                </div>
              </div>
              <p className="text-xs">
                Match: {contact.matchMethod} ({contact.matchConfidence}) - {contact.matchReason || 'No reason'}
              </p>
              <p className="text-xs text-muted-foreground">
                Source: domain={contact.sourceFields?.emailDomain || '-'} | billing company={contact.sourceFields?.billingCompany || '-'} | shipping company={contact.sourceFields?.shippingCompany || '-'}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    runAction(`reassign-contact-${contact.contactId}`, async () => {
                      if (!selection.companyId && !selection.companyName) {
                        throw new Error('Select or create target company first')
                      }
                      await postJson('/api/admin/companies/reassign-contact', {
                        contactId: contact.contactId,
                        targetCompanyId: selection.companyId,
                        targetCompanyName: selection.companyName,
                        targetDomain: selection.domain || null,
                        moveAllOrders: true,
                        reason: 'Manual contact reassignment from company detail',
                      })
                    })
                  }
                  disabled={busyAction !== null}
                >
                  Reassign contact
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    runAction(`mark-private-${contact.contactId}`, async () => {
                      await postJson('/api/admin/companies/reassign-contact', {
                        contactId: contact.contactId,
                        targetCompanyName: `Private Customer (${contact.email || contact.contactId})`,
                        moveAllOrders: true,
                        reason: 'Marked private from company detail',
                      })
                    })
                  }
                  disabled={busyAction !== null}
                >
                  Mark as private
                </Button>
              </div>
            </div>
          ))}
          {state.contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">{selectedCount} order(s) selected</p>
          {state.orders.map((order) => (
            <label key={order.shopifyOrderId} className="block rounded border p-3 text-sm cursor-pointer">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.has(order.shopifyOrderId)}
                    onChange={() => toggleOrder(order.shopifyOrderId)}
                  />
                  <div>
                    <p className="font-medium">
                      {order.orderNumber || order.shopifyOrderId} - ${order.orderTotal.toLocaleString('en-NZ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.orderDate).toLocaleDateString('en-NZ')} | {order.customerContact} | {order.email || '-'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {order.matchMethod} ({order.matchConfidence})
                </div>
              </div>
              <p className="text-xs mt-1">
                Billing company: {order.billingCompany || '-'} | Shipping company: {order.shippingCompany || '-'}
              </p>
            </label>
          ))}
          {state.orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recovery actions on account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.recoveryActions?.length ? (
            state.recoveryActions.map((action) => (
              <div key={action.recoveryActionId} className="rounded border p-3 text-xs space-y-1">
                <p className="font-medium">{action.actionLabel}</p>
                <p>
                  {new Date(action.createdAt).toLocaleString('en-NZ')} | by {action.createdBy || '-'}
                </p>
                {action.note ? <p>Note: {action.note}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No recovery actions logged yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match audit trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.auditTrail.map((audit) => (
            <div key={audit.auditId} className="rounded border p-3 text-xs space-y-1">
              <p className="font-medium">
                {audit.actionType} - {new Date(audit.createdAt).toLocaleString('en-NZ')}
              </p>
              <p>
                old={audit.oldCompanyId || '-'} new={audit.newCompanyId || '-'} customer=
                {audit.shopifyCustomerId || '-'} order={audit.shopifyOrderId || '-'}
              </p>
              <p>reason: {audit.reason || '-'}</p>
              <p>created by: {audit.createdBy || '-'}</p>
            </div>
          ))}
          {state.auditTrail.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{String(value ?? '-')}</p>
    </div>
  )
}
