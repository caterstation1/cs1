"use client"
import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import HoursChart from './HoursChart'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ByDay = { date: string; hours: number; shiftsCount: number; mileage: number; reimbursements: number; notesCount: number; shiftIds: string[] }

export default function StaffDetailSheet({
  staffId,
  open,
  onOpenChange,
  startDate,
  endDate,
}: {
  staffId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  startDate: string
  endDate: string
}) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!open || !staffId) return
      setLoading(true)
      try {
        const params = new URLSearchParams({ startDate, endDate })
        const res = await fetch(`/api/timesheet/admin/staff/${staffId}?${params.toString()}`, { cache: 'no-store' })
        const json = res.ok ? await res.json() : null
        setData(json)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, staffId, startDate, endDate])

  const chartData = useMemo<ByDay[]>(() => data?.byDay || [], [data])

  const exportCsv = () => {
    if (!data) return
    const header = ['Date', 'Hours', 'Shifts', 'Mileage', 'Reimbursed', 'Notes']
    const rows = (data.byDay as ByDay[]).map(d => [d.date, d.hours, d.shiftsCount, d.mileage, d.reimbursements, d.notesCount])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet_${data?.staff?.name || staffId}_${startDate}_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data?.staff?.name || 'Staff'} — {startDate} to {endDate}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="p-4">Loading…</div>
        ) : !data ? (
          <div className="p-4 text-sm text-gray-600">No data</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded border">
                <div className="text-xs text-gray-500">Hours</div>
                <div className="text-xl font-semibold">{data?.totals?.hours?.toFixed?.(2) ?? '0.00'}h</div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-xs text-gray-500">Shifts</div>
                <div className="text-xl font-semibold">{data?.totals?.shifts ?? 0}</div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-xs text-gray-500">Mileage</div>
                <div className="text-xl font-semibold">{data?.totals?.mileage?.toFixed?.(0) ?? 0}km</div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-xs text-gray-500">Reimbursed</div>
                <div className="text-xl font-semibold">${data?.totals?.reimbursements?.toFixed?.(2) ?? '0.00'}</div>
              </div>
            </div>

            <HoursChart data={chartData.map((d: ByDay) => ({ date: d.date, hours: d.hours }))} />

            <div className="flex justify-end">
              <Button onClick={exportCsv} className="bg-blue-600 hover:bg-blue-700">Export CSV</Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Shifts</TableHead>
                    <TableHead className="text-right">Mileage</TableHead>
                    <TableHead className="text-right">Reimbursed</TableHead>
                    <TableHead className="text-right">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>{d.date}</TableCell>
                      <TableCell className="text-right">{d.hours.toFixed(2)}h</TableCell>
                      <TableCell className="text-right">{d.shiftsCount}</TableCell>
                      <TableCell className="text-right">{d.mileage.toFixed(0)}km</TableCell>
                      <TableCell className="text-right">${d.reimbursements.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{d.notesCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

