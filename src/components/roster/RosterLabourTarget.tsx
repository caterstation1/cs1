"use client"

// Rostered labour cost per day against 10% of that day's delivered sales.
// Payroll and revenue, so it renders nothing at all unless the API agrees the
// viewer is allowed it — the 403 is the access control, this is just tidiness.

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import { formatLocalDate } from '@/lib/date-utils'

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
  orderCount: number
  target: number | null
  variance: number | null
  tone: 'green' | 'amber' | 'red' | null
  uncosted: UncostedShift[]
}

interface LabourTotal {
  cost: number
  hours: number
  shiftCount: number
  salesExGst: number | null
  target: number | null
  variance: number | null
  tone: 'green' | 'amber' | 'red' | null
  measuredDayCount: number
  uncostedCount: number
}

interface LabourTargetResponse {
  startDate: string
  endDate: string
  targetRate: number
  days: LabourDay[]
  total: LabourTotal
}

// Cents throughout: the target is 10% of the sales figure and the variance is
// the difference, so a reader must be able to check both by hand.
const money = (value: number) =>
  value.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 })

// Same green/amber/red reading the Products tab uses for margin health.
const toneClass = (tone: LabourDay['tone']) =>
  tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : 'text-gray-400'

function varianceLabel(day: { cost: number; target: number | null; variance: number | null }) {
  if (day.variance === null || day.target === null) return 'No sales yet'
  if (day.variance === 0) return 'On target'
  return day.variance > 0 ? `${money(day.variance)} over` : `${money(Math.abs(day.variance))} under`
}

export function RosterLabourTarget({ weekDates }: { weekDates: Date[] }) {
  const [data, setData] = useState<LabourTargetResponse | null>(null)
  const [allowed, setAllowed] = useState(true)

  const startDate = weekDates.length > 0 ? formatLocalDate(weekDates[0]) : ''
  const endDate = weekDates.length > 0 ? formatLocalDate(weekDates[weekDates.length - 1]) : ''

  const load = useCallback(async () => {
    if (!startDate || !endDate) return
    try {
      const res = await fetch(`/api/roster/labour-target?startDate=${startDate}&endDate=${endDate}`)
      if (res.status === 403 || res.status === 401) {
        setAllowed(false)
        setData(null)
        return
      }
      if (!res.ok) return
      setAllowed(true)
      setData(await res.json())
    } catch {
      // A failed lookup leaves the last good figures rather than flashing zeros.
    }
  }, [startDate, endDate])

  useEffect(() => {
    load()
  }, [load])

  if (!allowed || !data) return null

  const { total } = data
  const uncostedNames = Array.from(
    new Set(data.days.flatMap((d) => d.uncosted.filter((u) => u.reason === 'no-pay-rate').map((u) => u.staffName)))
  )
  const untimedCount = data.days.reduce(
    (sum, d) => sum + d.uncosted.filter((u) => u.reason === 'no-times').length,
    0
  )

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Rostered labour vs target</h2>
            <span className="text-xs text-muted-foreground">
              Target is {Math.round(data.targetRate * 100)}% of sales delivered that day, ex GST
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Week: </span>
            <span className="font-semibold">{money(total.cost)}</span>
            <span className="text-muted-foreground"> vs </span>
            <span className="font-semibold">{total.target === null ? '—' : money(total.target)}</span>
            {total.variance !== null && (
              <span className={`ml-2 font-semibold ${toneClass(total.tone)}`}>({varianceLabel(total)})</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 text-left font-medium">Day</th>
                <th className="py-2 px-3 text-right font-medium">Shifts</th>
                <th className="py-2 px-3 text-right font-medium">Hours</th>
                <th className="py-2 px-3 text-right font-medium">Rostered cost</th>
                <th className="py-2 px-3 text-right font-medium">Sales ex GST</th>
                <th className="py-2 px-3 text-right font-medium">Target</th>
                <th className="py-2 pl-3 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => {
                const label = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-NZ', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })
                return (
                  <tr key={day.date} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {label}
                      {day.uncosted.length > 0 && (
                        <AlertTriangle
                          className="inline h-3.5 w-3.5 ml-1 text-amber-600 align-text-top"
                          aria-label="Some shifts could not be costed"
                        />
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{day.shiftCount || '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {day.hours > 0 ? day.hours.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">{money(day.cost)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {day.salesExGst === null ? 'Not booked yet' : money(day.salesExGst)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {day.target === null ? '—' : money(day.target)}
                    </td>
                    <td className={`py-2 pl-3 text-right tabular-nums font-semibold ${toneClass(day.tone)}`}>
                      {varianceLabel(day)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {(uncostedNames.length > 0 || untimedCount > 0) && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {uncostedNames.length > 0 && (
              <div>
                No pay rate on file for {uncostedNames.join(', ')} — their hours are counted but their cost is not, so
                the rostered cost above is understated.
              </div>
            )}
            {untimedCount > 0 && (
              <div>
                {untimedCount} rostered shift{untimedCount === 1 ? ' has' : 's have'} no start and end time, so no hours
                or cost could be derived.
              </div>
            )}
          </div>
        )}

        {total.measuredDayCount < data.days.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Week target covers the {total.measuredDayCount} day{total.measuredDayCount === 1 ? '' : 's'} that have
            orders. Days shown as not booked yet are future dates with nothing delivered against them, which is not the
            same as a day that sold nothing.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
