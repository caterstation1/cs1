"use client"
import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MyTimesheetTab from './_components/MyTimesheetTab'
import AdminTimesheetsTab from './_components/AdminTimesheetsTab'

export default function TimesheetsPage() {
  const [accessLevel, setAccessLevel] = useState<string | null>(null)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/me/access', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setAccessLevel(data?.accessLevel || null)
      } catch {
        setAccessLevel(null)
      }
    }
    load()
  }, [])

  const isAdminOwner = accessLevel === 'admin' || accessLevel === 'owner'

  return (
    <div className="mx-auto w-full max-w-[1400px] px-2 md:px-4 py-4 md:py-6">
      <Tabs defaultValue="my">
        <div className="flex items-center justify-between mb-3">
          <TabsList>
            <TabsTrigger value="my">My Timesheet</TabsTrigger>
            {isAdminOwner && <TabsTrigger value="admin">Admin Timesheets</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="my">
          <MyTimesheetTab />
        </TabsContent>
        {isAdminOwner && (
          <TabsContent value="admin">
            <AdminTimesheetsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

