"use client"
import dynamic from 'next/dynamic'
type Datum = { date: string; hours: number }
const HoursChartInner = dynamic(() => import('./HoursChartInner'), { ssr: false })
export default function HoursChart({ data }: { data: Datum[] }) {
  return <HoursChartInner data={data} />
}

