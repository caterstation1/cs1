"use client"
import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, Bar } from 'recharts'

type Datum = { date: string; hours: number }

export default function HoursChartInner({ data }: { data: Datum[] }) {
  const safe = useMemo(() => Array.isArray(data) ? data : [], [data])
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={safe}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

