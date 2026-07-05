'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface DashboardFilterState {
  preset: string
  startDate?: string
  endDate?: string
  region?: string
  city?: string
  companyStatus?: string
  product?: string
  minConfidence?: string
  newVsReturning?: string
  revenueTier?: string
  orderCountTier?: string
  topCustomerLimit?: string
  includePrivateUnmatched?: string
}

export function DashboardFilters({
  value,
  onChange,
  onApply,
}: {
  value: DashboardFilterState
  onChange: (next: DashboardFilterState) => void
  onApply: () => void
}) {
  const set = (patch: Partial<DashboardFilterState>) => onChange({ ...value, ...patch })

  return (
    <div className="rounded-lg border bg-background p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="space-y-1">
          <Label>Date range</Label>
          <Select value={value.preset} onValueChange={(preset) => set({ preset })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="last_3_months">Last 3 months</SelectItem>
              <SelectItem value="last_6_months">Last 6 months</SelectItem>
              <SelectItem value="last_12_months">Last 12 months</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
              <SelectItem value="all_time">All time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Start date</Label>
          <Input type="date" value={value.startDate || ''} onChange={(e) => set({ startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>End date</Label>
          <Input type="date" value={value.endDate || ''} onChange={(e) => set({ endDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Region</Label>
          <Input value={value.region || ''} onChange={(e) => set({ region: e.target.value })} placeholder="AKL / WLG" />
        </div>
        <div className="space-y-1">
          <Label>City</Label>
          <Input value={value.city || ''} onChange={(e) => set({ city: e.target.value })} placeholder="Auckland" />
        </div>
        <div className="space-y-1">
          <Label>Min confidence</Label>
          <Input
            type="number"
            value={value.minConfidence || ''}
            onChange={(e) => set({ minConfidence: e.target.value })}
            placeholder="0-100"
          />
        </div>
        <div className="space-y-1">
          <Label>Company status</Label>
          <Select value={value.companyStatus || 'all'} onValueChange={(companyStatus) => set({ companyStatus: companyStatus === 'all' ? '' : companyStatus })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="at_risk">At risk</SelectItem>
              <SelectItem value="lapsed">Lapsed</SelectItem>
              <SelectItem value="reactivated">Reactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Product</Label>
          <Input value={value.product || ''} onChange={(e) => set({ product: e.target.value })} placeholder="Product filter" />
        </div>
        <div className="space-y-1">
          <Label>New vs returning</Label>
          <Select value={value.newVsReturning || 'all'} onValueChange={(newVsReturning) => set({ newVsReturning: newVsReturning === 'all' ? '' : newVsReturning })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="returning">Returning</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Revenue tier</Label>
          <Select value={value.revenueTier || 'all'} onValueChange={(revenueTier) => set({ revenueTier: revenueTier === 'all' ? '' : revenueTier })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="lt500">&lt;$500</SelectItem>
              <SelectItem value="500_1999">$500-$1,999</SelectItem>
              <SelectItem value="2000_4999">$2,000-$4,999</SelectItem>
              <SelectItem value="5000_9999">$5,000-$9,999</SelectItem>
              <SelectItem value="10000_plus">$10,000+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Order count tier</Label>
          <Select value={value.orderCountTier || 'all'} onValueChange={(orderCountTier) => set({ orderCountTier: orderCountTier === 'all' ? '' : orderCountTier })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2_3">2-3</SelectItem>
              <SelectItem value="4_9">4-9</SelectItem>
              <SelectItem value="10_plus">10+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Top customers view</Label>
          <Select value={value.topCustomerLimit || 'all'} onValueChange={(topCustomerLimit) => set({ topCustomerLimit: topCustomerLimit === 'all' ? '' : topCustomerLimit })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Default</SelectItem>
              <SelectItem value="50">Top 50 customers</SelectItem>
              <SelectItem value="100">Top 100 customers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Include private/unmatched</Label>
          <Select
            value={value.includePrivateUnmatched || 'false'}
            onValueChange={(includePrivateUnmatched) => set({ includePrivateUnmatched })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No (B2B default)</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={onApply}>Apply filters</Button>
      </div>
    </div>
  )
}
