'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

const PRESET_LABELS: Record<string, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  last_6_months: 'Last 6 months',
  last_12_months: 'Last 12 months',
  ytd: 'Year to date',
  all_time: 'All time',
  custom: 'Custom',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  active: 'Active',
  at_risk: 'At risk',
  lapsed: 'Lapsed',
  reactivated: 'Reactivated',
}

const TIER_LABELS: Record<string, string> = {
  lt500: '<$500',
  '500_1999': '$500-$1,999',
  '2000_4999': '$2,000-$4,999',
  '5000_9999': '$5,000-$9,999',
  '10000_plus': '$10,000+',
}

/** Filters shown as dismissible chips when they differ from their defaults. */
const CHIP_DEFS: Array<{ key: keyof DashboardFilterState; label: string; display?: (value: string) => string }> = [
  { key: 'startDate', label: 'From' },
  { key: 'endDate', label: 'To' },
  { key: 'region', label: 'Region' },
  { key: 'city', label: 'City' },
  { key: 'companyStatus', label: 'Status', display: (v) => STATUS_LABELS[v] || v },
  { key: 'product', label: 'Product' },
  { key: 'minConfidence', label: 'Min confidence' },
  { key: 'newVsReturning', label: 'Companies', display: (v) => (v === 'new' ? 'New only' : 'Returning only') },
  { key: 'revenueTier', label: 'Revenue tier', display: (v) => TIER_LABELS[v] || v },
  { key: 'orderCountTier', label: 'Order count', display: (v) => v.replace('_', '-').replace('plus', '+') },
  { key: 'topCustomerLimit', label: 'Top customers', display: (v) => `Top ${v}` },
  { key: 'includePrivateUnmatched', label: 'Private/unmatched', display: (v) => (v === 'true' ? 'Included' : 'Excluded') },
]

const MORE_FILTER_KEYS: Array<keyof DashboardFilterState> = [
  'city',
  'product',
  'minConfidence',
  'newVsReturning',
  'revenueTier',
  'orderCountTier',
  'topCustomerLimit',
  'includePrivateUnmatched',
]

function isNonDefault(key: keyof DashboardFilterState, value: string | undefined): boolean {
  if (key === 'includePrivateUnmatched') return value === 'true'
  return value != null && String(value).trim() !== ''
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

  const activeChips = useMemo(
    () =>
      CHIP_DEFS.filter((def) => isNonDefault(def.key, value[def.key])).map((def) => ({
        ...def,
        value: String(value[def.key]),
      })),
    [value]
  )
  const moreCount = MORE_FILTER_KEYS.filter((key) => isNonDefault(key, value[key])).length

  const clearChip = (key: keyof DashboardFilterState) => {
    set({ [key]: key === 'includePrivateUnmatched' ? 'false' : '' } as Partial<DashboardFilterState>)
  }

  return (
    <div className="space-y-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value.preset} onValueChange={(preset) => set({ preset })}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue>{PRESET_LABELS[value.preset] || value.preset}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESET_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value.preset === 'custom' ? (
          <>
            <Input
              type="date"
              value={value.startDate || ''}
              onChange={(e) => set({ startDate: e.target.value })}
              className="h-8 w-36"
              aria-label="Start date"
            />
            <Input
              type="date"
              value={value.endDate || ''}
              onChange={(e) => set({ endDate: e.target.value })}
              className="h-8 w-36"
              aria-label="End date"
            />
          </>
        ) : null}

        <Select
          value={value.region || 'all'}
          onValueChange={(region) => set({ region: region === 'all' ? '' : region })}
        >
          <SelectTrigger className="h-8 w-36" aria-label="Region">
            <SelectValue>{value.region || 'All regions'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {/* Region values as stored on Company records. */}
            <SelectItem value="Auckland">Auckland</SelectItem>
            <SelectItem value="Wellington">Wellington</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={value.companyStatus || 'all'}
          onValueChange={(companyStatus) => set({ companyStatus: companyStatus === 'all' ? '' : companyStatus })}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Company status">
              {value.companyStatus ? STATUS_LABELS[value.companyStatus] || value.companyStatus : 'All statuses'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              More filters
              {moreCount > 0 ? (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {moreCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3 max-h-[70vh] overflow-auto">
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input
                value={value.city || ''}
                onChange={(e) => set({ city: e.target.value })}
                placeholder="Auckland"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Product</Label>
              <Input
                value={value.product || ''}
                onChange={(e) => set({ product: e.target.value })}
                placeholder="Product filter"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min match confidence (0-100)</Label>
              <Input
                type="number"
                value={value.minConfidence || ''}
                onChange={(e) => set({ minConfidence: e.target.value })}
                placeholder="0-100"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">New vs returning</Label>
              <Select
                value={value.newVsReturning || 'all'}
                onValueChange={(v) => set({ newVsReturning: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-8">
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
              <Label className="text-xs">Revenue tier</Label>
              <Select
                value={value.revenueTier || 'all'}
                onValueChange={(v) => set({ revenueTier: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(TIER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Order count tier</Label>
              <Select
                value={value.orderCountTier || 'all'}
                onValueChange={(v) => set({ orderCountTier: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-8">
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
              <Label className="text-xs">Top customers view</Label>
              <Select
                value={value.topCustomerLimit || 'all'}
                onValueChange={(v) => set({ topCustomerLimit: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Default (25)</SelectItem>
                  <SelectItem value="50">Top 50 customers</SelectItem>
                  <SelectItem value="100">Top 100 customers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Include private/unmatched</Label>
              <Select
                value={value.includePrivateUnmatched || 'false'}
                onValueChange={(includePrivateUnmatched) => set({ includePrivateUnmatched })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No (B2B default)</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Filters apply automatically</span>
          <Button size="sm" className="h-8" onClick={onApply}>
            Apply
          </Button>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 font-normal">
              <span className="text-muted-foreground">{chip.label}:</span>
              {chip.display ? chip.display(chip.value) : chip.value}
              <button
                type="button"
                aria-label={`Clear ${chip.label} filter`}
                className="ml-0.5 rounded-full px-1 hover:bg-muted-foreground/20"
                onClick={() => clearChip(chip.key)}
              >
                ×
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() =>
              onChange({ preset: value.preset, includePrivateUnmatched: 'false' })
            }
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  )
}
