'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ReviewStatus = 'pending' | 'approved' | 'rejected'

interface CompanyMatchReviewRow {
  reviewId: string
  proposedCompanyId: string | null
  existingCompanyId: string | null
  proposedCompanyName: string
  existingCompanyName: string | null
  matchReason: string
  confidenceScore: number
  orderIds: string[]
  status: ReviewStatus
  createdAt: string
  reviewedAt: string | null
  evidence?: {
    email?: string | null
    domain?: string | null
    shippingCompany?: string | null
    billingCompany?: string | null
    shippingAddress?: string | null
    city?: string | null
  }
}

export default function CompanyMatchReviewPage() {
  const [status, setStatus] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rows, setRows] = useState<CompanyMatchReviewRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/company-matches/review?status=${status}`)
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load queue')
      const mapped = (data.reviews || []).map((review: any) => ({
        reviewId: review.reviewId,
        proposedCompanyId: review.proposedCompanyId ?? null,
        existingCompanyId: review.existingCompanyId ?? null,
        proposedCompanyName: review.proposedCompanyName,
        existingCompanyName: review.existingCompanyName,
        matchReason: review.matchReason,
        confidenceScore: review.confidenceScore,
        orderIds: Array.isArray(review.orderIds) ? review.orderIds : [],
        status: review.status as ReviewStatus,
        createdAt: review.createdAt,
        reviewedAt: review.reviewedAt,
        evidence: review.evidence || undefined,
      }))
      setRows(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  const pendingCount = useMemo(() => rows.filter((row) => row.status === 'pending').length, [rows])

  const resolveReview = async (reviewId: string, decision: 'approve' | 'reject' | 'private') => {
    setBusyId(reviewId)
    setError(null)
    try {
      const response = await fetch(`/api/company-matches/review/${reviewId}/${decision}`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.error || `Failed to ${decision}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${decision}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Company Match Review Queue</h1>
          <p className="text-sm text-slate-300 mt-1">
            Review low-confidence company matches before merge or final assignment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={status === 'pending' ? 'default' : 'outline'} onClick={() => setStatus('pending')}>
            Pending only
          </Button>
          <Button variant={status === 'all' ? 'default' : 'outline'} onClick={() => setStatus('all')}>
            All statuses
          </Button>
        </div>
      </div>

      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Queue Overview</CardTitle>
          <CardDescription className="text-slate-300">
            {loading ? 'Loading…' : `${rows.length} items loaded (${pendingCount} pending)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm">{error}</div> : null}
          {!loading && rows.length === 0 ? (
            <div className="rounded border border-slate-700 p-3 text-sm text-slate-300">No review items found.</div>
          ) : null}

          {rows.map((row) => {
            const canResolve = row.status === 'pending' && !busyId
            return (
              <div key={row.reviewId} className="rounded border border-slate-700 bg-slate-900/60 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-100">
                    {row.proposedCompanyName}
                    {row.existingCompanyName ? ` -> ${row.existingCompanyName}` : ''}
                  </div>
                  <div className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-200">
                    {row.status} | {row.confidenceScore}
                  </div>
                </div>
                <p className="text-sm text-slate-300">{row.matchReason}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="rounded border border-slate-700 p-2">
                    <div className="font-semibold text-slate-200 mb-1">Proposed</div>
                    <div>Name: {row.proposedCompanyName}</div>
                    <div>ID: {row.proposedCompanyId || 'new record'}</div>
                  </div>
                  <div className="rounded border border-slate-700 p-2">
                    <div className="font-semibold text-slate-200 mb-1">Existing candidate</div>
                    <div>Name: {row.existingCompanyName || 'none'}</div>
                    <div>ID: {row.existingCompanyId || 'none'}</div>
                  </div>
                </div>
                {row.evidence ? (
                  <div className="rounded border border-slate-700 p-2 text-xs text-slate-300">
                    <div className="font-semibold text-slate-200 mb-1">Why this was suggested</div>
                    <div>Email: {row.evidence.email || 'none'}</div>
                    <div>Domain: {row.evidence.domain || 'none'}</div>
                    <div>Shipping company: {row.evidence.shippingCompany || 'none'}</div>
                    <div>Billing company: {row.evidence.billingCompany || 'none'}</div>
                    <div>
                      Address: {row.evidence.shippingAddress || 'none'}
                      {row.evidence.city ? `, ${row.evidence.city}` : ''}
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-slate-400">
                  Orders: {row.orderIds.length ? row.orderIds.join(', ') : 'none'}
                </p>
                <p className="text-xs text-slate-500">
                  Created {new Date(row.createdAt).toLocaleString()}
                  {row.reviewedAt ? ` | Reviewed ${new Date(row.reviewedAt).toLocaleString()}` : ''}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => resolveReview(row.reviewId, 'approve')} disabled={!canResolve} size="sm">
                    {busyId === row.reviewId ? 'Working…' : 'Approve'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => resolveReview(row.reviewId, 'private')}
                    disabled={!canResolve}
                    size="sm"
                  >
                    Mark Private
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => resolveReview(row.reviewId, 'reject')}
                    disabled={!canResolve}
                    size="sm"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
