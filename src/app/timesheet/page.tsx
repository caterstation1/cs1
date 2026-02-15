"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Clock, Plus, Edit, Car, DollarSign, TrendingUp, Calendar, Users, Activity, CheckCircle, Circle } from 'lucide-react'
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils'

interface ShiftTask {
  id: string
  title: string
  description?: string
  isCompleted: boolean
  completedAt?: Date
}

interface Shift {
  id: string
  clockIn: Date
  clockOut: Date | null
  totalHours: number | null
  date: Date
  mileage: number | null
  notes: string | null
  status: string
  reimbursements: Reimbursement[]
  tasks: ShiftTask[]
}

interface Reimbursement {
  id: string
  amount: number
  description: string
  createdAt: Date
}

import TimesheetsPage from './TimesheetsPage'
export default function TimesheetPage() { return <TimesheetsPage /> }