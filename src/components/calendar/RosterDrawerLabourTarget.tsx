"use client"

// The day's rostered labour cost against its 10%-of-sales target, the same
// reading the weekly roster page gives. Payroll and revenue, so it renders
// nothing unless the API agrees the viewer is one of the named people — the
// 403 is the access control, this is just tidiness.

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, TrendingUp } from 'lucide-react'

interface UncostedShift {
  id: string
  staffName: string
  reason: 'no-pay-rate' | 'no-times'
}

interface LabourDay {
  date: string
  cost: number
  hours: number
  shiftCount: number
  salesExGst: number | null
  target: number | null
  variance: number | null
  tone: 'green' | 'amber' | 'red' | null
  uncosted: UncostedShift[]
}

const money = (value: number) =>
  value.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 })

// Same green/amber/red reading the weekly panel uses.
const toneClass = (tone: LabourDay['tone']) =>
  tone === 'green'
    ? 'text-green-700'
    : tone === 'amber'
      ? 'text-amber-600'
      : tone === 'red'
        ? 'text-red-600'
        : 'text-gray-400'

function varianceLabel(day: LabourDay) {
  if (day.variance === null || day.target === null) return 'No sales yet'
  if (day.variance === 0) return 'On target'
  return day.variance > 0 ? `${money(day.variance)} over` : `${money(Math.abs(day.variance))} under`
}

export function RosterDrawerLabourTarget({
  selectedDate,
  refreshToken = 0,
}: {
  selectedDate: Date
  /** Bumped when a shift is added, so the cost catches up with the grid. */
  refreshToken?: number
}) {
  const [day, setDay] = useState<LabourDay | null>(null)
  const [targetRate, setTargetRate] = useState(0.1)
  const [allowed, setAllowed] = useState(true)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/roster/labour-target/day?date=${dateStr}`, { cache: 'no-store' })
      if (res.status === 401 || res.status === 403) {
        setAllowed(false)
        setDay(null)
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setAllowed(true)
      setTargetRate(data.targetRate ?? 0.1)
      setDay(data.day ?? null)
    } catch {
      // A failed lookup leaves the last good figures rather than flashing zeros.
    }
  }, [dateStr])

  useEffect(() => {
    load()
  }, [load, refreshToken])

  if (!allowed || !day) return null

  const noPayRate = Array.from(
    new Set(day.uncosted.filter((u) => u.reason === 'no-pay-rate').map((u) => u.staffName))
  )
  const untimedCount = day.uncosted.filter((u) => u.reason === 'no-times').length

  return (
    <div className="mb-3 rounded border border-blue-200 bg-blue-50/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
        <TrendingUp className="h-3.5 w-3.5" />
        Rostered labour vs target
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-blue-800/70">Cost</div>
          <div className="text-sm font-semibold tabular-nums text-gray-900">{money(day.cost)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-blue-800/70">Target</div>
          <div className="text-sm font-semibold tabular-nums text-gray-900">
            {day.target === null ? '—' : money(day.target)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-blue-800/70">Difference</div>
          <div className={`text-sm font-semibold tabular-nums ${toneClass(day.tone)}`}>{varianceLabel(day)}</div>
        </div>
      </div>

      <div className="mt-1.5 text-[10px] leading-tight text-blue-900/70">
        {day.hours > 0 ? `${day.hours.toFixed(1)}h across ${day.shiftCount} shift${day.shiftCount === 1 ? '' : 's'}. ` : ''}
        Target is {Math.round(targetRate * 100)}% of{' '}
        {day.salesExGst === null ? 'that day’s sales, ex GST — nothing delivered yet' : `${money(day.salesExGst)} delivered, ex GST`}.
      </div>

      {(noPayRate.length > 0 || untimedCount > 0) && (
        <div className="mt-1.5 flex items-start gap-1 text-[10px] leading-tight text-amber-800">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          <div>
            {noPayRate.length > 0 && (
              <div>No pay rate on file for {noPayRate.join(', ')}, so the cost is understated.</div>
            )}
            {untimedCount > 0 && (
              <div>
                {untimedCount} shift{untimedCount === 1 ? ' has' : 's have'} no start and end time, so no cost could be
                derived.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
