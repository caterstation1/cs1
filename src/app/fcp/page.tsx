'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FCP_DASHBOARD_CATEGORIES, FCP_QUICK_ACTIONS } from '@/lib/fcp/fcp-rule-config'
import {
  buildQuizQuestionSet,
  STAFF_QUIZ_QUESTION_COUNT,
  STAFF_QUIZ_VERSION,
  type QuizAttempt,
  type QuizQuestionForAttempt,
} from '@/lib/fcp/staff-quiz'

type StaffOption = {
  id: string
  firstName: string
  lastName: string
  accessLevel?: string | null
  isActive?: boolean
}

type RuleField = {
  key: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  helpText?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  readOnly?: boolean
  showWhen?: {
    key: string
    equals: string | boolean
  }
}

type RuleItem = {
  id: string
  code: string
  name: string
  severity: string
  frequency?: string
  triggerType?: string
  config?: {
    dashboardCategory?: string
    fields?: RuleField[]
  }
}

type TaskItem = {
  id: string
  status: string
  dueAt: string | null
  assetId?: string | null
  asset?: {
    id: string
    name?: string | null
    code?: string | null
    type?: string | null
  } | null
  orderId?: string | null
  incident?: {
    id: string
    status?: string
  } | null
  records?: {
    id: string
    status?: string | null
    recordedAt?: string | null
  }[]
  context?: Record<string, unknown> | null
  rule: RuleItem
}

type TasksTodayResponse = {
  data?: {
    date?: string
    grouped?: Record<string, Record<string, TaskItem[]>>
  }
}

type RulesResponse = {
  data?: RuleItem[]
}

type AssetItem = {
  id: string
  name: string
  code?: string | null
  type: string
  location?: string | null
}

type AssetsResponse = {
  data?: AssetItem[]
}

type SupplierItem = {
  id: string
  name: string
  contactEmail?: string | null
  mpiNumber?: string | null
}

type FcpRecordRow = {
  id: string
  recordedAt: string
  status: string
  recordedById?: string | null
  data?: Record<string, unknown> | null
  rule?: { code: string; name: string } | null
}

type FcpIncidentRow = {
  id: string
  title: string
  description?: string | null
  status: string
  severity: string
  openedAt: string
  rule?: { code: string; name: string } | null
  asset?: { id: string; name?: string | null; code?: string | null; location?: string | null } | null
}

type PeriodicCleaningRow = {
  id: string
  taskName: string
  area: string
  notes?: string | null
  frequency: string
  isActive: boolean
}

type FcpContactRow = {
  id: string
  type: string
  companyName: string
  contactPerson?: string | null
  website?: string | null
  about?: string | null
  phoneNumber?: string | null
  email?: string | null
}

type QuizIncorrectAnswer = {
  questionId: string
  question: string
  selectedAnswer: string
  correctAnswer: string
  explanation: string
  category: string
  fcpReference: string
}

type ActiveFormTarget =
  | { mode: 'task'; title: string; task: TaskItem; rule: RuleItem }
  | { mode: 'quick'; title: string; rule: RuleItem }

const RECORDED_BY_STORAGE_KEY = 'fcp-recorded-by-id'
const FRIDGE_RULE_CODE = 'daily_fridge_temp_check'
const SUPPLIER_DELIVERY_RULE_CODE = 'supplier_delivery_check'
const TRAINING_QUIZ_RULE_CODE = 'staff_training_quiz'
const COOLING_SERIES_RULE_CODES = ['weekly_batch_check', 'weekly_lamb_batch_check', 'weekly_pork_batch_check'] as const
const DRAFT_PERSIST_RULE_CODES = [...COOLING_SERIES_RULE_CODES, 'chicken_liver_pate_check'] as const

const FORM_TEMPLATE_OVERRIDES: Record<string, RuleField[]> = {
  incident_creation: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'details', label: 'Details', type: 'textarea', required: true },
    { key: 'whatHasBeenDone', label: 'What has been done about it', type: 'textarea', required: true },
    { key: 'followUpRequired', label: 'Follow-up required?', type: 'boolean', required: true },
    {
      key: 'followUpExplanation',
      label: 'Follow-up explanation',
      type: 'textarea',
      required: false,
      showWhen: { key: 'followUpRequired', equals: true },
    },
    { key: 'foodSafetyIssue', label: 'Was there a food safety issue?', type: 'boolean', required: true },
    { key: 'resolution', label: 'How was it resolved?', type: 'textarea', required: true },
  ],
  acid_control_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'product', label: 'Product', type: 'text', required: true, placeholder: 'e.g. Red onions' },
    {
      key: 'phLevel',
      label: 'pH level',
      type: 'number',
      required: true,
      min: 0,
      max: 4.2,
      step: 0.1,
      helpText: 'Max pH 4.2. Red onions target less than 3.5 pH. Add more white vinegar if required.',
    },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  weekly_batch_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'productCook', label: 'Product / cook', type: 'text', required: true },
    { key: 'outOfOvenTempC', label: 'Out of oven temp (°C)', type: 'number', required: true, step: 0.1 },
    {
      key: 'tempAfter1_5hC',
      label: 'After 1.5 hrs temp (must be below 21°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Must be below 21°C.',
    },
    {
      key: 'tempAfter5hC',
      label: 'After 5 hrs temp (must be below 5°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Must be below 5°C.',
    },
    {
      key: 'passed',
      label: 'Pass?',
      type: 'boolean',
      required: true,
    },
    {
      key: 'correctiveActionIfFailed',
      label: 'Corrective action if failed',
      type: 'textarea',
      required: false,
      placeholder: 'Required if any cooling threshold fails.',
    },
  ],
  prove_cooking_method: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'outOfOvenTempC', label: 'Out of oven temp (°C)', type: 'number', required: true, step: 0.1 },
    {
      key: 'tempAfter30mC',
      label: 'After 30 mins temp (must be below 60°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Must be below 60°C.',
    },
    {
      key: 'tempAfter1_5hC',
      label: 'After 1.5 hrs temp (must be below 21°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Must be below 21°C.',
    },
    {
      key: 'tempAfter5hC',
      label: 'After 5 hrs temp (must be below 5°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Must be below 5°C.',
    },
    {
      key: 'correctiveActionIfFailed',
      label: 'Corrective action if failed',
      type: 'textarea',
      required: false,
      placeholder: 'Required if any cooling threshold fails.',
    },
  ],
  weekly_lamb_batch_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'outOfOvenTempC', label: 'Out of oven temp (°C)', type: 'number', required: true, step: 0.1 },
    {
      key: 'tempAfter1_5hC',
      label: 'After 1.5 hrs temp (must be below 21°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Enter this later when available. Draft is auto-saved until final submit.',
    },
    {
      key: 'tempAfter5hC',
      label: 'After 5 hrs temp (must be below 5°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Enter this later when available. Draft is auto-saved until final submit.',
    },
    { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
    {
      key: 'correctiveActionIfFailed',
      label: 'Corrective action if failed',
      type: 'textarea',
      required: false,
      placeholder: 'Required if failed.',
    },
  ],
  weekly_pork_batch_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'outOfOvenTempC', label: 'Out of oven temp (°C)', type: 'number', required: true, step: 0.1 },
    {
      key: 'tempAfter1_5hC',
      label: 'After 1.5 hrs temp (must be below 21°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Enter this later when available. Draft is auto-saved until final submit.',
    },
    {
      key: 'tempAfter5hC',
      label: 'After 5 hrs temp (must be below 5°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Enter this later when available. Draft is auto-saved until final submit.',
    },
    { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
    {
      key: 'correctiveActionIfFailed',
      label: 'Corrective action if failed',
      type: 'textarea',
      required: false,
      placeholder: 'Required if failed.',
    },
  ],
  weekly_chicken_batch_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'internalTempC', label: 'Largest piece temperature (°C)', type: 'number', required: true, step: 0.1 },
    { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  chicken_liver_pate_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    {
      key: 'hotBlendTempC',
      label: 'Hot blend temp (must be >= 75°C for 30s)',
      type: 'number',
      required: true,
      step: 0.1,
    },
    {
      key: 'tempAfter1hC',
      label: 'After 1 hour fan cool temp (must be below 19°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Draft auto-saves while you wait.',
    },
    {
      key: 'tempAfter5hC',
      label: 'After 5 hours refrigerated temp (must be below 5°C)',
      type: 'number',
      required: true,
      step: 0.1,
      helpText: 'Draft auto-saves while you wait.',
    },
    { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
    { key: 'correctiveActionIfFailed', label: 'Corrective action if failed', type: 'textarea', required: false },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  six_month_ph_tester_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'readingPh', label: 'Reference pH reading', type: 'number', required: true, step: 0.1 },
    { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  supplier_delivery_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'deliveryAccepted', label: 'Delivery accepted?', type: 'boolean', required: true },
    {
      key: 'tempCheckOkay',
      label: 'Temp check okay?',
      type: 'select',
      required: true,
      options: ['yes', 'no', 'not_applicable'],
    },
    { key: 'notes', label: 'General notes', type: 'textarea', required: false },
    {
      key: 'somethingWentWrong',
      label: 'Something went wrong with this supplier delivery?',
      type: 'boolean',
      required: true,
    },
    {
      key: 'issueDetails',
      label: 'Issue details',
      type: 'textarea',
      required: false,
      showWhen: { key: 'somethingWentWrong', equals: true },
    },
    {
      key: 'actionTaken',
      label: 'Action taken',
      type: 'textarea',
      required: false,
      showWhen: { key: 'somethingWentWrong', equals: true },
    },
    {
      key: 'affectedItems',
      label: 'Affected products/items',
      type: 'textarea',
      required: false,
      showWhen: { key: 'somethingWentWrong', equals: true },
    },
    {
      key: 'rejectedDelivery',
      label: 'Rejected delivery?',
      type: 'boolean',
      required: false,
      showWhen: { key: 'somethingWentWrong', equals: true },
    },
    {
      key: 'supplierEmailRequired',
      label: 'Supplier email required?',
      type: 'boolean',
      required: false,
      showWhen: { key: 'somethingWentWrong', equals: true },
    },
  ],
  daily_fridge_temp_check: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    {
      key: 'temperatureC',
      label: 'Temperature °C',
      type: 'number',
      required: true,
      step: 0.1,
      showWhen: { key: '__singleFridgeMode', equals: true },
    },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  daily_cleaning_tasks: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'allDishesWashed', label: 'All dishes washed and cleared', type: 'boolean', required: true },
    { key: 'allSurfacesSanitized', label: 'All surfaces cleaned and sanitized', type: 'boolean', required: true },
    { key: 'allBinsEmptied', label: 'All bins emptied', type: 'boolean', required: true },
    { key: 'floorsSweptMopped', label: 'Floors swept and mopped', type: 'boolean', required: true },
    { key: 'bathroomCleaned', label: 'Bathroom cleaned', type: 'boolean', required: true },
    { key: 'cardboardCleared', label: 'Cardboard cleared', type: 'boolean', required: true },
    { key: 'noPestOrDamage', label: 'No signs of pest or mechanical damage', type: 'boolean', required: true },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  customer_complaint: [
    { key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true },
    { key: 'customerOrderReference', label: 'Customer/order reference', type: 'text', required: false },
    { key: 'customerName', label: 'Customer name', type: 'text', required: false },
    { key: 'complaintDetails', label: 'Complaint details', type: 'textarea', required: true },
    { key: 'foodSafetyIssue', label: 'Food safety issue?', type: 'boolean', required: true },
    { key: 'actionTaken', label: 'Action taken', type: 'textarea', required: true },
    { key: 'followUpRequired', label: 'Follow-up required?', type: 'boolean', required: true },
    {
      key: 'followUpNotes',
      label: 'Follow-up notes',
      type: 'textarea',
      required: false,
      showWhen: { key: 'followUpRequired', equals: true },
    },
    { key: 'resolved', label: 'Resolved?', type: 'boolean', required: true },
  ],
  staff_training_quiz: [{ key: 'staffName', label: 'Name / Staff', type: 'readonlyText', required: true, readOnly: true }],
}

const AUDIT_TOPICS: Array<{ id: string; label: string; ruleCodes?: string[] }> = [
  { id: 'all', label: 'All checks' },
  { id: 'fridges', label: 'Fridges', ruleCodes: ['daily_fridge_temp_check'] },
  { id: 'chicken', label: 'Chicken', ruleCodes: ['per_batch_fried_chicken_check', 'weekly_chicken_batch_check'] },
  { id: 'pate', label: 'Pate', ruleCodes: ['chicken_liver_pate_check'] },
  { id: 'beef', label: 'Beef / lamb', ruleCodes: ['weekly_batch_check', 'weekly_lamb_batch_check'] },
  { id: 'pork', label: 'Pork', ruleCodes: ['prove_cooking_method', 'weekly_pork_batch_check'] },
  { id: 'wellness', label: 'Staff wellness', ruleCodes: ['staff_wellness_check'] },
  { id: 'cleaning', label: 'Cleaning', ruleCodes: ['daily_cleaning_tasks', 'periodic_cleaning_task'] },
  { id: 'suppliers', label: 'Supplier delivery', ruleCodes: ['supplier_delivery_check'] },
  { id: 'training', label: 'Training quiz', ruleCodes: ['staff_training_quiz'] },
]

function getRuleFields(rule?: RuleItem): RuleField[] {
  const override = rule?.code ? FORM_TEMPLATE_OVERRIDES[rule.code] : undefined
  if (override) return override
  const fields = rule?.config?.fields
  if (!Array.isArray(fields)) return []
  return fields.filter((field) => Boolean(field?.key && field?.label))
}

function shouldShowField(field: RuleField, formData: Record<string, unknown>): boolean {
  if (!field.showWhen) return true
  return formData[field.showWhen.key] === field.showWhen.equals
}

function getTaskCategory(task: TaskItem): string {
  if (task.rule?.code === 'prove_cooking_method') return 'Pork'
  return task.rule?.config?.dashboardCategory || 'Today'
}

function getTaskTitle(task: TaskItem): string {
  if (task.context && typeof task.context.taskTitle === 'string' && task.context.taskTitle.trim()) {
    return task.context.taskTitle
  }
  return task.rule?.name || 'Untitled task'
}

function getAssetDisplayName(asset?: { name?: string | null; code?: string | null } | null): string | null {
  if (!asset) return null
  return asset.name || asset.code || null
}

function formatDueTime(value: string | null): string {
  if (!value) return 'No due time'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'No due time'
  return parsed.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })
}

function toInputValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

function isActiveListTask(task: TaskItem): boolean {
  return task.status === 'OPEN' || task.status === 'IN_PROGRESS'
}

function getDraftStorageKey(target: ActiveFormTarget | null): string | null {
  if (!target) return null
  const code = target.rule.code
  if (!(DRAFT_PERSIST_RULE_CODES as readonly string[]).includes(code)) return null
  if (target.mode === 'task') return `fcp-draft:${code}:${target.task.id}`
  return `fcp-draft:${code}:quick`
}

function getTaskTileTone(task: TaskItem, now: Date): 'green' | 'red' | 'amber' {
  if (task.status === 'COMPLETED') return 'green'
  if (isActiveListTask(task) && task.dueAt && new Date(task.dueAt) < now) return 'red'
  return 'amber'
}

function getTaskPeriodLabel(task: TaskItem): string {
  const frequency = String(task.rule?.frequency || '').toUpperCase()
  if (frequency === 'WEEKLY') return 'Weekly'
  if (frequency === 'DAILY') return 'Daily'
  if (frequency === 'CLOSING') return 'Daily close'
  if (frequency === 'SIX_MONTHLY') return 'Six-monthly'
  return 'Scheduled'
}

export default function FcpPage() {
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [recordedById, setRecordedById] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Today')
  const [selectedAuditTopic, setSelectedAuditTopic] = useState<string>('all')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [rules, setRules] = useState<RuleItem[]>([])
  const [fridgeAssets, setFridgeAssets] = useState<AssetItem[]>([])
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [records, setRecords] = useState<FcpRecordRow[]>([])
  const [incidents, setIncidents] = useState<FcpIncidentRow[]>([])
  const [periodicCleaningItems, setPeriodicCleaningItems] = useState<PeriodicCleaningRow[]>([])
  const [contacts, setContacts] = useState<FcpContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'warning'; message: string } | null>(null)
  const [formTarget, setFormTarget] = useState<ActiveFormTarget | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionForAttempt[]>([])
  const [quizResult, setQuizResult] = useState<(QuizAttempt & { incorrectAnswers: QuizIncorrectAnswer[] }) | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [lastSubmissionDebug, setLastSubmissionDebug] = useState<Record<string, unknown> | null>(null)
  const [supplierEmailDialogOpen, setSupplierEmailDialogOpen] = useState(false)
  const [supplierEmailDraft, setSupplierEmailDraft] = useState({ subject: '', body: '' })
  const [supplierEmailSending, setSupplierEmailSending] = useState(false)
  const [supplierEmailStatus, setSupplierEmailStatus] = useState<{ sentAt: string; to: string } | null>(null)
  const [recordDetail, setRecordDetail] = useState<FcpRecordRow | null>(null)
  const [incidentDetail, setIncidentDetail] = useState<FcpIncidentRow | null>(null)
  const [dismissingIncidentId, setDismissingIncidentId] = useState<string | null>(null)
  const [newPeriodicTask, setNewPeriodicTask] = useState({
    taskName: '',
    area: '',
    frequency: 'WEEKLY',
    notes: '',
    isActive: true,
  })
  const [newContact, setNewContact] = useState({
    type: 'OTHER',
    companyName: '',
    contactPerson: '',
    website: '',
    about: '',
    phoneNumber: '',
    email: '',
  })

  const handleStaffChange = useCallback((nextId: string) => {
    setRecordedById(nextId)
    if (nextId) {
      localStorage.setItem(RECORDED_BY_STORAGE_KEY, nextId)
    } else {
      localStorage.removeItem(RECORDED_BY_STORAGE_KEY)
    }
  }, [])

  const fetchStaff = useCallback(async () => {
    const response = await fetch('/api/staff', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load staff')
    const list = (await response.json()) as StaffOption[]
    const activeStaff = Array.isArray(list)
      ? list.filter(
          (s) =>
            s.isActive !== false &&
            !['wlg_team', 'wlg_admin'].includes(String(s.accessLevel || '').toLowerCase())
        )
      : []
    setStaff(activeStaff)

    const storedId = typeof window !== 'undefined' ? localStorage.getItem(RECORDED_BY_STORAGE_KEY) : ''
    if (storedId && activeStaff.some((s) => s.id === storedId)) {
      setRecordedById(storedId)
      return
    }
  }, [recordedById])

  const fetchRules = useCallback(async () => {
    const response = await fetch('/api/fcp/rules', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load FCP rules')
    const payload = (await response.json()) as RulesResponse
    setRules(Array.isArray(payload.data) ? payload.data : [])
  }, [])

  const fetchTasks = useCallback(async (allowGenerate = true) => {
    if (allowGenerate) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
      await fetch(`/api/fcp/tasks/generate?date=${today}`, {
        method: 'POST',
      })
    }
    const response = await fetch('/api/fcp/tasks/today', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load FCP tasks')
    const payload = (await response.json()) as TasksTodayResponse
    const grouped = payload.data?.grouped || {}
    const allTasks = Object.values(grouped)
      .flatMap((byStatus) => Object.values(byStatus || {}).flat())
      .filter(Boolean)

    setTasks(allTasks)
  }, [])

  const fetchFridgeAssets = useCallback(async () => {
    const response = await fetch('/api/fcp/assets?type=FRIDGE', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load fridge assets')
    const payload = (await response.json()) as AssetsResponse
    setFridgeAssets(Array.isArray(payload.data) ? payload.data : [])
  }, [])

  const fetchSuppliers = useCallback(async () => {
    const response = await fetch('/api/suppliers', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load suppliers')
    const payload = (await response.json()) as SupplierItem[]
    const normalized = Array.isArray(payload)
      ? payload
          .filter((supplier) => Boolean(supplier?.id && supplier?.name))
          .map((supplier) => ({
            id: supplier.id,
            name: supplier.name,
            contactEmail: supplier.contactEmail || null,
            mpiNumber: supplier.mpiNumber || null,
          }))
      : []
    setSuppliers(normalized)
  }, [])

  const fetchRecords = useCallback(async () => {
    const response = await fetch('/api/fcp/records', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load FCP records')
    const payload = (await response.json()) as { data?: FcpRecordRow[] }
    setRecords(Array.isArray(payload.data) ? payload.data : [])
  }, [])

  const fetchIncidents = useCallback(async () => {
    const response = await fetch('/api/fcp/incidents?status=OPEN', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load FCP incidents')
    const payload = (await response.json()) as { data?: FcpIncidentRow[] }
    setIncidents(Array.isArray(payload.data) ? payload.data : [])
  }, [])

  const fetchPeriodicCleaning = useCallback(async () => {
    const response = await fetch('/api/fcp/periodic-cleaning', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load periodic cleaning tasks')
    const payload = (await response.json()) as { data?: PeriodicCleaningRow[] }
    setPeriodicCleaningItems(Array.isArray(payload.data) ? payload.data : [])
  }, [])

  const fetchContacts = useCallback(async () => {
    const response = await fetch('/api/fcp/contacts', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load FCP contacts')
    const payload = (await response.json()) as { data?: FcpContactRow[] }
    setContacts(Array.isArray(payload.data) ? payload.data : [])
  }, [])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      await Promise.all([
        fetchStaff(),
        fetchRules(),
        fetchTasks(),
        fetchFridgeAssets(),
        fetchSuppliers(),
        fetchRecords(),
        fetchIncidents(),
        fetchPeriodicCleaning(),
        fetchContacts(),
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load FCP dashboard'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [
    fetchContacts,
    fetchFridgeAssets,
    fetchIncidents,
    fetchPeriodicCleaning,
    fetchRecords,
    fetchRules,
    fetchStaff,
    fetchSuppliers,
    fetchTasks,
  ])

  const selectedStaffName = useMemo(() => {
    const match = staff.find((member) => member.id === recordedById)
    if (!match) return ''
    return `${match.firstName} ${match.lastName}`.trim()
  }, [recordedById, staff])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!formTarget) return
    setFormData((prev) => {
      if (!selectedStaffName || prev.staffName === selectedStaffName) return prev
      return { ...prev, staffName: selectedStaffName }
    })
  }, [formTarget, selectedStaffName])

  useEffect(() => {
    if (!formTarget || formTarget.rule.code !== SUPPLIER_DELIVERY_RULE_CODE) return
    if (!selectedSupplierId) return
    const selected = suppliers.find((supplier) => supplier.id === selectedSupplierId)
    if (!selected) return
    setFormData((prev) => ({
      ...prev,
      supplierId: selected.id,
      supplierName: selected.name,
      supplierEmail: selected.contactEmail || '',
    }))
  }, [formTarget, selectedSupplierId, suppliers])

  useEffect(() => {
    if (selectedCategory !== 'Audit') setSelectedAuditTopic('all')
  }, [selectedCategory])

  useEffect(() => {
    if (formTarget) return
    setQuizQuestions([])
    setQuizResult(null)
  }, [formTarget])

  useEffect(() => {
    const draftKey = getDraftStorageKey(formTarget)
    if (!draftKey || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, unknown>
      setFormData((prev) => ({
        ...parsed,
        ...prev,
        staffName: selectedStaffName || String(parsed.staffName || ''),
      }))
      setNotice({ type: 'success', message: 'Loaded saved draft for this batch check.' })
    } catch {
      // ignore invalid draft payloads
    }
  }, [formTarget, selectedStaffName])

  useEffect(() => {
    const draftKey = getDraftStorageKey(formTarget)
    if (!draftKey || typeof window === 'undefined' || !Object.keys(formData).length) return
    try {
      localStorage.setItem(draftKey, JSON.stringify(formData))
    } catch {
      // ignore storage quota issues
    }
  }, [formData, formTarget])

  const ruleByCode = useMemo(() => {
    return new Map(rules.map((rule) => [rule.code, rule]))
  }, [rules])

  const filteredTasks = useMemo(() => {
    if (selectedCategory === 'Today') return tasks
    return tasks.filter((task) => getTaskCategory(task) === selectedCategory)
  }, [selectedCategory, tasks])

  const visibleQuickActions = useMemo(() => {
    if (selectedCategory === 'Today') return FCP_QUICK_ACTIONS
    if (selectedCategory === 'Audit' || selectedCategory === 'Settings') return []
    return FCP_QUICK_ACTIONS.filter((action) => action.category === selectedCategory)
  }, [selectedCategory])

  const sectionTitle = useMemo(() => {
    if (selectedCategory === 'Today') return 'Today dashboard tiles'
    if (selectedCategory === 'Audit') return 'Audit and historical records'
    if (selectedCategory === 'Settings') return 'FCP settings and reference lists'
    return `${selectedCategory} dashboard tiles`
  }, [selectedCategory])

  const now = useMemo(() => new Date(), [tasks])

  const taskStats = useMemo(() => {
    const open = filteredTasks.filter((task) => task.status === 'OPEN')
    const completedToday = filteredTasks.filter((task) => task.status === 'COMPLETED')
    const overdue = open.filter((task) => task.dueAt && new Date(task.dueAt) < now)
    const soonWindow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const dueSoon = open.filter((task) => {
      if (!task.dueAt) return false
      const due = new Date(task.dueAt)
      return due >= now && due <= soonWindow
    })
    const progressPct =
      filteredTasks.length > 0 ? Math.round((completedToday.length / filteredTasks.length) * 100) : 0

    return {
      open,
      dueSoon,
      overdue,
      completedToday,
      progressPct,
    }
  }, [filteredTasks, now])

  const summaryStats = useMemo(() => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((task) => task.status === 'COMPLETED').length
    const openTasks = tasks.filter((task) => isActiveListTask(task)).length
    const overdueTasks = tasks.filter((task) => {
      if (!isActiveListTask(task) || !task.dueAt) return false
      return new Date(task.dueAt) < now
    }).length

    const openIncidentIds = new Set(
      tasks
        .filter((task) => task.incident && !['RESOLVED', 'CLOSED'].includes(task.incident.status || ''))
        .map((task) => task.incident?.id)
        .filter(Boolean) as string[]
    )
    const openIncidents = openIncidentIds.size
    const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const tone =
      openIncidents > 0
        ? 'danger'
        : totalTasks > 0 && completedTasks === totalTasks && overdueTasks === 0
          ? 'good'
          : 'warn'

    return {
      totalTasks,
      completedTasks,
      openTasks,
      overdueTasks,
      openIncidents,
      completionPct,
      tone,
    }
  }, [now, tasks])

  const groupedByCategory = useMemo(() => {
    const grouped: Record<string, TaskItem[]> = {}
    for (const category of FCP_DASHBOARD_CATEGORIES) grouped[category] = []
    for (const task of filteredTasks.filter(isActiveListTask)) {
      const category = getTaskCategory(task)
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(task)
    }
    return grouped
  }, [filteredTasks])

  const taskTiles = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const aActive = isActiveListTask(a) ? 0 : 1
      const bActive = isActiveListTask(b) ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      return aDue - bDue
    })
  }, [filteredTasks])

  const auditTopicRuleCodes = useMemo(() => {
    const topic = AUDIT_TOPICS.find((entry) => entry.id === selectedAuditTopic)
    return topic?.ruleCodes || []
  }, [selectedAuditTopic])

  const filteredAuditRecords = useMemo(() => {
    if (selectedAuditTopic === 'all') return records
    return records.filter((record) => {
      const code = record.rule?.code || ''
      return auditTopicRuleCodes.includes(code)
    })
  }, [auditTopicRuleCodes, records, selectedAuditTopic])

  const opsSummary = useMemo(() => {
    const activeRules = rules.filter((rule) => rule.code !== 'periodic_cleaning_task')
    const dailyChecks = activeRules.filter((rule) => {
      const frequency = String(rule.frequency || '').toUpperCase()
      return frequency === 'DAILY' || frequency === 'CLOSING'
    })
    const weeklyChecks = activeRules.filter((rule) => String(rule.frequency || '').toUpperCase() === 'WEEKLY')
    const periodicChecks = activeRules.filter((rule) =>
      ['FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'SIX_MONTHLY'].includes(
        String(rule.frequency || '').toUpperCase()
      )
    )
    return {
      dailyChecks,
      weeklyChecks,
      periodicChecks,
    }
  }, [rules])

  const auditSummary = useMemo(() => {
    const base = selectedCategory === 'Today' ? tasks : filteredTasks
    const active = base.filter(isActiveListTask)
    const overdue = active.filter((task) => task.dueAt && new Date(task.dueAt) < now)
    const completed = base.filter((task) => task.status === 'COMPLETED')
    const openIncidentIds = new Set(
      base
        .filter((task) => task.incident && !['RESOLVED', 'CLOSED'].includes(task.incident.status || ''))
        .map((task) => task.incident?.id)
        .filter(Boolean) as string[]
    )
    const failedChecks = base
      .flatMap((task) =>
        (task.records || [])
          .filter((record) => record.status === 'FAIL')
          .map((record) => ({
            id: record.id,
            taskId: task.id,
            taskTitle: getTaskTitle(task),
            category: getTaskCategory(task),
            recordedAt: record.recordedAt || null,
          }))
      )
      .sort((a, b) => {
        const aTime = a.recordedAt ? new Date(a.recordedAt).getTime() : 0
        const bTime = b.recordedAt ? new Date(b.recordedAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 5)

    return {
      completed: completed.length,
      open: active.length,
      overdue: overdue.length,
      openIncidents: openIncidentIds.size,
      failedChecks,
    }
  }, [filteredTasks, now, selectedCategory, tasks])

  const startTaskEntry = (task: TaskItem) => {
    setNotice(null)
    setQuizResult(null)
    if (task.rule.code === TRAINING_QUIZ_RULE_CODE) {
      setQuizQuestions(buildQuizQuestionSet(STAFF_QUIZ_QUESTION_COUNT))
    } else {
      setQuizQuestions([])
    }
    setFormData(
      selectedStaffName
        ? { staffName: selectedStaffName, __singleFridgeMode: task.rule.code === FRIDGE_RULE_CODE }
        : { __singleFridgeMode: task.rule.code === FRIDGE_RULE_CODE }
    )
    setSelectedSupplierId('')
    setSupplierEmailStatus(null)
    setFormTarget({
      mode: 'task',
      title: task.rule.name,
      task,
      rule: task.rule,
    })
  }

  const startQuickAction = (ruleCode: string, label: string) => {
    let rule = ruleByCode.get(ruleCode)
    if (!rule && ruleCode === TRAINING_QUIZ_RULE_CODE) {
      rule = {
        id: 'virtual_staff_training_quiz',
        code: TRAINING_QUIZ_RULE_CODE,
        name: 'Training / staff competency quiz',
        severity: 'MEDIUM',
        config: { dashboardCategory: 'Audit', fields: FORM_TEMPLATE_OVERRIDES.staff_training_quiz },
      }
    }
    if (!rule && ruleCode === 'periodic_cleaning_task') {
      rule = {
        id: 'virtual_periodic_cleaning_task',
        code: 'periodic_cleaning_task',
        name: 'Periodic cleaning / inspection task',
        severity: 'MEDIUM',
        config: { dashboardCategory: 'Cleaning', fields: [] },
      }
    }
    if (!rule && ruleCode === 'chicken_liver_pate_check') {
      rule = {
        id: 'virtual_chicken_liver_pate_check',
        code: 'chicken_liver_pate_check',
        name: 'Chicken liver pate check',
        severity: 'HIGH',
        config: { dashboardCategory: 'Chicken', fields: FORM_TEMPLATE_OVERRIDES.chicken_liver_pate_check },
      }
    }
    if (!rule && ruleCode === 'weekly_lamb_batch_check') {
      rule = {
        id: 'virtual_weekly_lamb_batch_check',
        code: 'weekly_lamb_batch_check',
        name: 'Weekly lamb batch verification',
        severity: 'HIGH',
        config: { dashboardCategory: 'Lamb', fields: FORM_TEMPLATE_OVERRIDES.weekly_lamb_batch_check },
      }
    }
    if (!rule && ruleCode === 'weekly_pork_batch_check') {
      rule = {
        id: 'virtual_weekly_pork_batch_check',
        code: 'weekly_pork_batch_check',
        name: 'Weekly pork batch verification',
        severity: 'HIGH',
        config: { dashboardCategory: 'Pork', fields: FORM_TEMPLATE_OVERRIDES.weekly_pork_batch_check },
      }
    }
    if (!rule && ruleCode === 'weekly_chicken_batch_check') {
      rule = {
        id: 'virtual_weekly_chicken_batch_check',
        code: 'weekly_chicken_batch_check',
        name: 'Weekly fried chicken check',
        severity: 'HIGH',
        config: { dashboardCategory: 'Chicken', fields: FORM_TEMPLATE_OVERRIDES.weekly_chicken_batch_check },
      }
    }
    if (!rule && ruleCode === 'six_month_ph_tester_check') {
      rule = {
        id: 'virtual_six_month_ph_tester_check',
        code: 'six_month_ph_tester_check',
        name: '6-month pH tester check',
        severity: 'HIGH',
        config: { dashboardCategory: 'Thermometers', fields: FORM_TEMPLATE_OVERRIDES.six_month_ph_tester_check },
      }
    }
    if (!rule) {
      setNotice({ type: 'warning', message: `Rule not found for quick action: ${label}` })
      return
    }
    setNotice(null)
    setQuizResult(null)
    if (ruleCode === TRAINING_QUIZ_RULE_CODE) {
      setQuizQuestions(buildQuizQuestionSet(STAFF_QUIZ_QUESTION_COUNT))
    } else {
      setQuizQuestions([])
    }
    setFormData(
      selectedStaffName
        ? { staffName: selectedStaffName, __singleFridgeMode: false }
        : { __singleFridgeMode: false }
    )
    setSelectedSupplierId('')
    setSupplierEmailStatus(null)
    setFormTarget({
      mode: 'quick',
      title: label,
      rule,
    })
  }

  const submitRecord = async () => {
    if (!formTarget) return
    if (!recordedById) {
      setNotice({ type: 'warning', message: 'Please select who is entering this first.' })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const ruleCode = formTarget.rule.code
      const dataWithStaff: Record<string, unknown> = selectedStaffName
        ? { ...formData, staffName: selectedStaffName }
        : { ...formData }
      delete dataWithStaff.__singleFridgeMode

      if (ruleCode === SUPPLIER_DELIVERY_RULE_CODE) {
        const supplierName = selectedSupplier?.name || String(dataWithStaff.supplierName || '').trim()
        const supplierEmail = selectedSupplier?.contactEmail || String(dataWithStaff.supplierEmail || '').trim()
        if (selectedSupplier?.id) {
          dataWithStaff.supplierId = selectedSupplier.id
        }
        dataWithStaff.supplierName = supplierName
        dataWithStaff.supplierEmail = supplierEmail
        if (!['yes', 'no', 'not_applicable'].includes(String(dataWithStaff.tempCheckOkay || ''))) {
          throw new Error('Please choose Temp check okay?')
        }
        if (dataWithStaff.supplierEmailRequired === true) {
          if (!supplierEmailDraft.subject.trim() || !supplierEmailDraft.body.trim()) {
            throw new Error('Supplier email subject/body is required when supplier email is required.')
          }
          dataWithStaff.supplierEmailSubject = supplierEmailDraft.subject
          dataWithStaff.supplierEmailBody = supplierEmailDraft.body
          dataWithStaff.supplierEmailIntent = supplierEmailStatus ? 'sent' : 'pending'
          if (supplierEmailStatus?.sentAt) dataWithStaff.supplierEmailSentAt = supplierEmailStatus.sentAt
        }
      }

      if (ruleCode === 'customer_complaint') {
        if (!String(dataWithStaff.complaintDetails || '').trim()) {
          throw new Error('Complaint details are required.')
        }
        if (!String(dataWithStaff.actionTaken || '').trim()) {
          throw new Error('Action taken is required.')
        }
      }

      if (ruleCode === TRAINING_QUIZ_RULE_CODE) {
        const attemptQuestions = quizQuestions.length
          ? quizQuestions
          : buildQuizQuestionSet(STAFF_QUIZ_QUESTION_COUNT)
        const answers = attemptQuestions.map((question) => {
          const selected = String(dataWithStaff[`quiz_${question.id}`] || '')
          if (!selected) {
            throw new Error('Please complete every quiz question before submitting.')
          }
          const isCorrect = selected === question.correctAnswer
          return {
            questionId: question.id,
            selected,
            correctAnswer: question.correctAnswer,
            isCorrect,
            explanation: question.explanation,
            category: question.category,
            fcpReference: question.fcpReference,
            question: question.question,
          }
        })
        const score = answers.filter((answer) => answer.isCorrect).length
        const totalQuestions = attemptQuestions.length
        const percentage = Math.round((score / totalQuestions) * 100)
        const result: 'PASS' | 'FAIL' = percentage >= 80 ? 'PASS' : 'FAIL'
        const incorrectAnswers: QuizIncorrectAnswer[] = answers
          .filter((answer) => !answer.isCorrect)
          .map((answer) => ({
            questionId: answer.questionId,
            question: answer.question,
            selectedAnswer: answer.selected,
            correctAnswer: answer.correctAnswer,
            explanation: answer.explanation,
            category: answer.category,
            fcpReference: answer.fcpReference,
          }))

        dataWithStaff.quizVersion = STAFF_QUIZ_VERSION
        dataWithStaff.staffId = recordedById
        dataWithStaff.staffName = selectedStaffName
        dataWithStaff.answers = answers.map((answer) => ({
          questionId: answer.questionId,
          selectedAnswer: answer.selected,
          correctAnswer: answer.correctAnswer,
          isCorrect: answer.isCorrect,
        }))
        dataWithStaff.incorrectAnswers = incorrectAnswers
        dataWithStaff.score = score
        dataWithStaff.totalQuestions = totalQuestions
        dataWithStaff.percentage = percentage
        dataWithStaff.result = result
        dataWithStaff.passed = result === 'PASS'
        dataWithStaff.completedAt = new Date().toISOString()
      }

      if (ruleCode === 'acid_control_check') {
        const ph = Number(dataWithStaff.phLevel)
        if (Number.isNaN(ph)) throw new Error('Please enter a valid pH level.')
        if (ph > 4.2) throw new Error('pH level must be 4.2 or lower.')
      }

      if (ruleCode === 'incident_creation') {
        if (dataWithStaff.followUpRequired === true && !String(dataWithStaff.followUpExplanation || '').trim()) {
          throw new Error('Please provide a follow-up explanation.')
        }
        if (dataWithStaff.foodSafetyIssue === true && !String(dataWithStaff.resolution || '').trim()) {
          throw new Error('Please include how the food safety issue was resolved.')
        }
      }

      if (
        (COOLING_SERIES_RULE_CODES as readonly string[]).includes(ruleCode) ||
        ruleCode === 'prove_cooking_method'
      ) {
        const after1_5 = Number(dataWithStaff.tempAfter1_5hC)
        const after5 = Number(dataWithStaff.tempAfter5hC)
        const after30 = Number(dataWithStaff.tempAfter30mC)
        const passedRaw = dataWithStaff.passed
        if (passedRaw !== true && passedRaw !== false) {
          throw new Error('Please mark pass or fail.')
        }
        const thresholdFail =
          (ruleCode === 'prove_cooking_method' && !Number.isNaN(after30) && after30 >= 60) ||
          (!Number.isNaN(after1_5) && after1_5 >= 21) ||
          (!Number.isNaN(after5) && after5 >= 5) ||
          passedRaw === false
        if (thresholdFail && !String(dataWithStaff.correctiveActionIfFailed || '').trim()) {
          throw new Error('Corrective action is required when a cooling threshold fails.')
        }
      }

      if (ruleCode === 'weekly_chicken_batch_check') {
        const internalTemp = Number(dataWithStaff.internalTempC)
        if (Number.isNaN(internalTemp)) throw new Error('Please enter the chicken temperature.')
        if (dataWithStaff.passed !== true && dataWithStaff.passed !== false) {
          throw new Error('Please mark pass or fail.')
        }
      }

      if (ruleCode === 'chicken_liver_pate_check') {
        const hotBlend = Number(dataWithStaff.hotBlendTempC)
        const after1h = Number(dataWithStaff.tempAfter1hC)
        const after5h = Number(dataWithStaff.tempAfter5hC)
        if (Number.isNaN(hotBlend) || Number.isNaN(after1h) || Number.isNaN(after5h)) {
          throw new Error('Please complete all liver pate temperatures.')
        }
        if (dataWithStaff.passed !== true && dataWithStaff.passed !== false) {
          throw new Error('Please mark pass or fail.')
        }
        const thresholdFail = hotBlend < 75 || after1h >= 19 || after5h >= 5 || dataWithStaff.passed === false
        if (thresholdFail && !String(dataWithStaff.correctiveActionIfFailed || '').trim()) {
          throw new Error('Corrective action is required when liver pate thresholds fail.')
        }
      }

      if (ruleCode === SUPPLIER_DELIVERY_RULE_CODE && dataWithStaff.somethingWentWrong === true) {
        if (!String(dataWithStaff.issueDetails || '').trim()) {
          throw new Error('Please add issue details for supplier delivery problems.')
        }
        if (!String(dataWithStaff.actionTaken || '').trim()) {
          throw new Error('Please add action taken for supplier delivery problems.')
        }
      }

      if (ruleCode === SUPPLIER_DELIVERY_RULE_CODE && dataWithStaff.tempCheckOkay === 'no') {
        dataWithStaff.somethingWentWrong = true
      }

      if (ruleCode === FRIDGE_RULE_CODE && formTarget.mode === 'quick') {
        const entries = fridgeAssets
          .map((asset) => ({
            asset,
            raw: dataWithStaff[`fridgeTemp_${asset.id}`],
          }))
          .filter((entry) => entry.raw !== '' && entry.raw !== undefined && entry.raw !== null)
        if (entries.length === 0) {
          throw new Error('Enter at least one fridge temperature.')
        }

        const results: unknown[] = []
        for (const entry of entries) {
          const temperatureC = Number(entry.raw)
          if (Number.isNaN(temperatureC)) {
            throw new Error(`Invalid temperature for ${entry.asset.name}.`)
          }
          const body = {
            ruleCode,
            recordedById,
            relatedAssetId: entry.asset.id,
            data: {
              staffName: selectedStaffName,
              temperatureC,
              fridgeName: entry.asset.name,
              notes: dataWithStaff.notes || '',
            },
          }
          const response = await fetch('/api/fcp/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const payload = await response.json()
          if (!response.ok) {
            throw new Error(payload?.error || `Failed to submit fridge record for ${entry.asset.name}`)
          }
          results.push(payload?.data || payload)
        }
        if (process.env.NODE_ENV !== 'production') {
          setLastSubmissionDebug({
            submittedAt: new Date().toISOString(),
            request: { ruleCode, mode: 'quick-bulk-fridge', entries: entries.map((e) => e.asset.name) },
            response: results,
          })
        }
        setNotice({ type: 'success', message: `Submitted ${entries.length} fridge check${entries.length === 1 ? '' : 's'}.` })
      } else {
        const body: Record<string, unknown> = {
          ruleCode,
          recordedById,
          data: dataWithStaff,
        }

        if (formTarget.mode === 'task') {
          body.taskId = formTarget.task.id
          if (formTarget.task.assetId) body.relatedAssetId = formTarget.task.assetId
          if (formTarget.task.orderId) body.relatedOrderId = formTarget.task.orderId
        }

        const response = await fetch('/api/fcp/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to submit FCP record')
        }

        if (process.env.NODE_ENV !== 'production') {
          setLastSubmissionDebug({
            submittedAt: new Date().toISOString(),
            request: body,
            response: payload?.data || null,
          })
        }

        if (payload?.data?.incident) {
          setNotice({
            type: 'warning',
            message: `Record saved and incident opened: ${payload.data.incident.title || payload.data.incident.id}`,
          })
        } else if (ruleCode === TRAINING_QUIZ_RULE_CODE) {
          const score = Number(dataWithStaff.score || 0)
          const total = Number(dataWithStaff.totalQuestions || STAFF_QUIZ_QUESTION_COUNT)
          const percentage = Number(dataWithStaff.percentage || 0)
          const result = String(dataWithStaff.result || 'FAIL') as 'PASS' | 'FAIL'
          const incorrectAnswers = Array.isArray(dataWithStaff.incorrectAnswers)
            ? (dataWithStaff.incorrectAnswers as QuizIncorrectAnswer[])
            : []
          setQuizResult({
            id: String((payload?.data?.record as { id?: string } | undefined)?.id || crypto.randomUUID()),
            staffId: recordedById,
            staffName: selectedStaffName,
            quizVersion: String(dataWithStaff.quizVersion || STAFF_QUIZ_VERSION),
            answers: Array.isArray(dataWithStaff.answers)
              ? (dataWithStaff.answers as QuizAttempt['answers'])
              : [],
            score,
            totalQuestions: total,
            percentage,
            result,
            completedAt: String(dataWithStaff.completedAt || new Date().toISOString()),
            incorrectAnswers,
          })
          setNotice({
            type: result === 'PASS' ? 'success' : 'warning',
            message:
              result === 'PASS'
                ? `Training quiz submitted: ${score}/${total} (${percentage}%) PASS`
                : 'Please review the incorrect answers and retake the questionnaire.',
          })
        } else {
          setNotice({ type: 'success', message: 'Record submitted successfully.' })
        }

      }

      const draftKey = getDraftStorageKey(formTarget)
      if (draftKey && typeof window !== 'undefined') {
        localStorage.removeItem(draftKey)
      }
      if (ruleCode !== TRAINING_QUIZ_RULE_CODE) {
        setFormTarget(null)
      }
      setSelectedSupplierId('')
      await fetchTasks()
      await Promise.all([fetchRecords(), fetchIncidents()])
    } catch (error) {
      setNotice({
        type: 'warning',
        message: error instanceof Error ? error.message : 'Failed to submit record',
      })
    } finally {
      setSaving(false)
    }
  }

  const renderFieldInput = (field: RuleField) => {
    const value = formData[field.key]
    const required = Boolean(field.required)

    if (field.type === 'readonlyText' || field.readOnly) {
      return <Input value={toInputValue(value)} className="h-12 text-base bg-muted" readOnly />
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          value={toInputValue(value)}
          onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
          placeholder={field.placeholder || field.label}
          className="min-h-24 text-base"
          required={required}
        />
      )
    }

    if (field.type === 'boolean') {
      return (
        <select
          value={toInputValue(value)}
          onChange={(e) => {
            const raw = e.target.value
            setFormData((prev) => ({
              ...prev,
              [field.key]: raw === '' ? '' : raw === 'true',
            }))
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-3 text-base"
          required={required}
        >
          <option value="">Select...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )
    }

    if (field.type === 'select' && Array.isArray(field.options)) {
      return (
        <select
          value={toInputValue(value)}
          onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-3 text-base"
          required={required}
        >
          <option value="">Select...</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }

    const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
    return (
      <Input
        type={inputType}
        value={toInputValue(value)}
        onChange={(e) => {
          const next =
            field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value
          setFormData((prev) => ({ ...prev, [field.key]: next }))
        }}
        className="h-12 text-base"
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        step={field.step}
        required={required}
      />
    )
  }

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) || null,
    [selectedSupplierId, suppliers]
  )

  const getRecordStaffName = useCallback((record: FcpRecordRow): string => {
    const fromData = typeof record.data?.staffName === 'string' ? record.data.staffName : ''
    if (fromData.trim()) return fromData.trim()
    if (record.recordedById) {
      const match = staff.find((member) => member.id === record.recordedById)
      if (match) return `${match.firstName} ${match.lastName}`.trim()
    }
    return 'Unknown staff'
  }, [staff])

  const downloadFridgeAuditCsv = useCallback(() => {
    const fridgeRecords = filteredAuditRecords.filter(
      (record) => (record.rule?.code || '') === FRIDGE_RULE_CODE
    )
    if (fridgeRecords.length === 0) return

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
    const formatRecordedAt = (value: string) =>
      new Date(value).toLocaleString('en-NZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })

    const headers = [
      'Recorded at',
      'Status',
      'Staff',
      'Fridge',
      'Temperature C',
      'Notes',
    ]

    const rows = fridgeRecords.map((record) => {
      const data = record.data || {}
      const fridgeName =
        typeof data.fridgeName === 'string'
          ? data.fridgeName
          : typeof data.assetName === 'string'
            ? data.assetName
            : ''
      const temperature =
        typeof data.temperatureC === 'number'
          ? data.temperatureC.toFixed(1)
          : typeof data.temperatureC === 'string'
            ? data.temperatureC
            : ''
      const notes = typeof data.notes === 'string' ? data.notes : ''

      return [
        formatRecordedAt(record.recordedAt),
        record.status || '',
        getRecordStaffName(record),
        fridgeName,
        temperature,
        notes,
      ]
    })

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map((value) => escapeCsv(String(value || ''))).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fcp-fridge-audit-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredAuditRecords, getRecordStaffName])

  const downloadTrainingRecord = useCallback((record: FcpRecordRow) => {
    if (typeof window === 'undefined') return
    const payload = {
      id: record.id,
      staffId: record.recordedById || null,
      staffName: getRecordStaffName(record),
      quizVersion: String(record.data?.quizVersion || STAFF_QUIZ_VERSION),
      score: Number(record.data?.score || 0),
      totalQuestions: Number(record.data?.totalQuestions || STAFF_QUIZ_QUESTION_COUNT),
      percentage: Number(record.data?.percentage || 0),
      result: String(record.data?.result || 'FAIL'),
      answers: record.data?.answers || [],
      incorrectAnswers: record.data?.incorrectAnswers || [],
      completedAt: String(record.data?.completedAt || record.recordedAt),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `training-record-${payload.staffName.replace(/\s+/g, '-').toLowerCase()}-${payload.completedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [getRecordStaffName])

  const dismissIncident = useCallback(
    async (incidentId: string) => {
      setDismissingIncidentId(incidentId)
      try {
        const response = await fetch(`/api/fcp/incidents/${incidentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'RESOLVED' }),
        })
        if (!response.ok) throw new Error('Failed to dismiss incident')
        await fetchIncidents()
        setNotice({ type: 'success', message: 'Incident dismissed (resolved).' })
      } catch (error) {
        setNotice({
          type: 'warning',
          message: error instanceof Error ? error.message : 'Failed to dismiss incident.',
        })
      } finally {
        setDismissingIncidentId(null)
      }
    },
    [fetchIncidents]
  )

  const supplierEmailRequired = formData.supplierEmailRequired === true

  const openSupplierEmailPreview = () => {
    if (!selectedSupplier?.contactEmail && !String(formData.supplierEmail || '').trim()) {
      setNotice({ type: 'warning', message: 'Select a supplier with an email, or provide a supplier email.' })
      return
    }
    const toName = selectedSupplier?.name || String(formData.supplierName || 'Supplier')
    const issueDetails = String(formData.issueDetails || '').trim()
    const actionTaken = String(formData.actionTaken || '').trim()
    const affectedItems = String(formData.affectedItems || '').trim()
    const subject = `Supplier delivery issue - ${toName}`
    const body = `Hi ${toName},\n\nWe identified an issue with today’s delivery.\n\nIssue details:\n${issueDetails || '-'}\n\nAction taken:\n${actionTaken || '-'}\n\nAffected items:\n${affectedItems || '-'}\n\nPlease confirm next steps.\n\nThanks,\n${selectedStaffName || 'CaterStation team'}`
    setSupplierEmailDraft({ subject, body })
    setSupplierEmailDialogOpen(true)
  }

  const sendSupplierEmail = async () => {
    const to = selectedSupplier?.contactEmail || String(formData.supplierEmail || '').trim()
    if (!to) {
      setNotice({ type: 'warning', message: 'Supplier email address is required.' })
      return
    }
    setSupplierEmailSending(true)
    try {
      const response = await fetch('/api/fcp/suppliers/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          supplierId: selectedSupplier?.id || null,
          supplierName: selectedSupplier?.name || formData.supplierName || null,
          subject: supplierEmailDraft.subject,
          body: supplierEmailDraft.body,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to send supplier email')
      }
      const sentAt = new Date().toISOString()
      setSupplierEmailStatus({ sentAt, to })
      setFormData((prev) => ({
        ...prev,
        supplierEmail: to,
        supplierEmailSubject: supplierEmailDraft.subject,
        supplierEmailBody: supplierEmailDraft.body,
        supplierEmailSent: true,
        supplierEmailSentAt: sentAt,
      }))
      setSupplierEmailDialogOpen(false)
      setNotice({ type: 'success', message: `Supplier email sent to ${to}.` })
    } catch (error) {
      setNotice({ type: 'warning', message: error instanceof Error ? error.message : 'Failed to send supplier email' })
    } finally {
      setSupplierEmailSending(false)
    }
  }

  const createPeriodicCleaningTask = async () => {
    try {
      const response = await fetch('/api/fcp/periodic-cleaning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPeriodicTask),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create periodic cleaning task')
      }
      setNotice({ type: 'success', message: 'Periodic cleaning task created.' })
      setNewPeriodicTask({
        taskName: '',
        area: '',
        frequency: 'WEEKLY',
        notes: '',
        isActive: true,
      })
      await fetchPeriodicCleaning()
    } catch (error) {
      setNotice({ type: 'warning', message: error instanceof Error ? error.message : 'Failed to create periodic task' })
    }
  }

  const createContact = async () => {
    try {
      const response = await fetch('/api/fcp/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create contact')
      }
      setNotice({ type: 'success', message: 'Contact added.' })
      setNewContact({
        type: 'OTHER',
        companyName: '',
        contactPerson: '',
        website: '',
        about: '',
        phoneNumber: '',
        email: '',
      })
      await fetchContacts()
    } catch (error) {
      setNotice({ type: 'warning', message: error instanceof Error ? error.message : 'Failed to create contact' })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] gap-4 p-4 md:p-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {FCP_DASHBOARD_CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                className="h-12 w-full justify-start text-base"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </CardContent>
        </Card>
      </aside>

      <main className="min-w-0 flex-1 space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">FCP Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedCategory === 'Today'
                    ? 'Fast food safety task entry for today'
                    : `Focused view: ${selectedCategory}`}
                </p>
              </div>
              <Button variant="outline" className="h-12 px-5 text-base" onClick={() => void refreshAll()}>
                Refresh
              </Button>
            </div>

            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                summaryStats.tone === 'danger'
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : summaryStats.tone === 'good'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              <div className="font-medium">
                Today: {summaryStats.completedTasks}/{summaryStats.totalTasks} checks complete
                {' · '}
                {summaryStats.overdueTasks} overdue
                {' · '}
                {summaryStats.openIncidents} open incidents
              </div>
              <div className="mt-1 text-xs opacity-90">
                {summaryStats.openTasks} open · {summaryStats.completionPct}% complete
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fcp-staff" className="text-sm font-medium">
                Who is entering this?
              </Label>
              <select
                id="fcp-staff"
                value={recordedById}
                onChange={(e) => handleStaffChange(e.target.value)}
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
              >
                <option value="">Select staff member...</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 md:hidden">
              {FCP_DASHBOARD_CATEGORIES.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className="h-11 text-sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {notice && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              notice.type === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === 'warning' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{notice.message}</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Open tasks</div>
              <div className="mt-1 text-2xl font-semibold">{taskStats.open.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Due soon</div>
              <div className="mt-1 text-2xl font-semibold">{taskStats.dueSoon.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Overdue</div>
              <div className="mt-1 text-2xl font-semibold">{taskStats.overdue.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Completed today</div>
              <div className="mt-1 text-2xl font-semibold">{taskStats.completedToday.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Completion progress</span>
              <span>{taskStats.progressPct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${taskStats.progressPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {selectedCategory !== 'Audit' && selectedCategory !== 'Settings' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Quick actions{selectedCategory === 'Today' ? '' : ` · ${selectedCategory}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {visibleQuickActions.map((action) => (
                <Button
                  key={action.ruleCode}
                  variant="outline"
                  className="h-16 justify-start text-left text-base"
                  onClick={() => startQuickAction(action.ruleCode, action.label)}
                >
                  <div className="leading-tight">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.category}</div>
                  </div>
                </Button>
              ))}
              {visibleQuickActions.length === 0 ? (
                <div className="col-span-full rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No quick actions configured for {selectedCategory}.
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading FCP tasks...
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {selectedCategory === 'Audit' ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Audit summary and records</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/20 p-4 text-sm">
                    On this system users are alerted to and can register checks for different food safety controls. We
                    currently track daily checks ({opsSummary.dailyChecks.length}), weekly checks (
                    {opsSummary.weeklyChecks.length}), and periodic checks ({opsSummary.periodicChecks.length}).
                    Records include who completed each check, completion time, and result status for audit review.
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Completed today</div>
                      <div className="text-xl font-semibold">{auditSummary.completed}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Open tasks</div>
                      <div className="text-xl font-semibold">{auditSummary.open}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Overdue tasks</div>
                      <div className="text-xl font-semibold">{auditSummary.overdue}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Open incidents</div>
                      <div className="text-xl font-semibold">{auditSummary.openIncidents}</div>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Verifier export coming later.
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Browse historical inputs</div>
                    <div className="flex flex-wrap gap-2">
                      {AUDIT_TOPICS.map((topic) => (
                        <Button
                          key={topic.id}
                          type="button"
                          variant={selectedAuditTopic === topic.id ? 'default' : 'outline'}
                          className="h-9 text-xs"
                          onClick={() => setSelectedAuditTopic(topic.id)}
                        >
                          {topic.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        Records ({selectedAuditTopic === 'all'
                          ? 'all checks'
                          : AUDIT_TOPICS.find((topic) => topic.id === selectedAuditTopic)?.label || 'selected'})
                      </div>
                      {selectedAuditTopic === 'fridges' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={downloadFridgeAuditCsv}
                          disabled={filteredAuditRecords.length === 0}
                        >
                          Download CSV
                        </Button>
                      ) : null}
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {filteredAuditRecords.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No records found for this audit filter.</div>
                      ) : (
                        filteredAuditRecords.slice(0, 120).map((record) => (
                          <div key={record.id} className="w-full rounded border p-2 text-left text-xs">
                            <div className="font-medium">
                              {record.rule?.code === 'chicken_liver_pate_check'
                                ? 'Pate'
                                : record.rule?.name || record.rule?.code || 'Record'}
                            </div>
                            <div className="text-muted-foreground">
                              {new Date(record.recordedAt).toLocaleString('en-NZ')} · {record.status}
                            </div>
                            <div className="text-muted-foreground">By: {getRecordStaffName(record)}</div>
                            <div className="mt-2 flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setRecordDetail(record)}
                              >
                                View attempt
                              </Button>
                              {record.rule?.code === TRAINING_QUIZ_RULE_CODE ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => downloadTrainingRecord(record)}
                                >
                                  Download training record
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <div className="mb-2 text-sm font-medium">Open incidents</div>
                      <div className="max-h-48 space-y-2 overflow-auto">
                        {incidents.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No open incidents.</div>
                        ) : (
                          incidents.map((incident) => (
                            <div key={incident.id} className="rounded border border-red-200 bg-red-50 p-2 text-xs">
                              <button
                                type="button"
                                onClick={() => setIncidentDetail(incident)}
                                className="w-full text-left"
                              >
                                <div className="font-medium text-red-900">{incident.title}</div>
                                <div className="text-red-800">{incident.severity} · {incident.status}</div>
                              </button>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => setIncidentDetail(incident)}
                                >
                                  View
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  disabled={dismissingIncidentId === incident.id}
                                  onClick={() => void dismissIncident(incident.id)}
                                >
                                  {dismissingIncidentId === incident.id ? 'Dismissing...' : 'Dismiss'}
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="mb-2 text-sm font-medium">Periodic cleaning list</div>
                      <div className="max-h-48 space-y-1 overflow-auto text-xs">
                        {periodicCleaningItems.filter((item) => item.isActive).slice(0, 25).map((item) => (
                          <div key={item.id} className="rounded border p-2">
                            <div>{item.taskName}</div>
                            <div className="text-muted-foreground">{item.area} · {item.frequency}</div>
                            {item.notes ? <div className="text-muted-foreground">About: {item.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {selectedCategory === 'Settings' ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/20 p-4 text-sm">
                    Manage operational reference data for FCP here: supplier contacts, periodic cleaning templates, and
                    FCP contact records. These support daily task execution and audit readiness.
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <div className="mb-2 text-sm font-medium">Supplier list</div>
                      <div className="max-h-44 space-y-1 overflow-auto text-xs">
                        {suppliers.slice(0, 100).map((supplier) => (
                          <div key={supplier.id} className="rounded border p-2">
                            <div>{supplier.name}</div>
                            <div className="text-muted-foreground">
                              {supplier.contactEmail || 'No email'}
                              {supplier.mpiNumber ? ` · MPI #: ${supplier.mpiNumber}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="mb-2 text-sm font-medium">Periodic cleaning list</div>
                      <div className="max-h-44 space-y-1 overflow-auto text-xs">
                        {periodicCleaningItems.filter((item) => item.isActive).slice(0, 100).map((item) => (
                          <div key={item.id} className="rounded border p-2">
                            <div>{item.taskName}</div>
                            <div className="text-muted-foreground">{item.area} · {item.frequency}</div>
                            {item.notes ? <div className="text-muted-foreground">About: {item.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-medium">Add custom periodic cleaning task</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        placeholder="Task name"
                        value={newPeriodicTask.taskName}
                        onChange={(e) => setNewPeriodicTask((prev) => ({ ...prev, taskName: e.target.value }))}
                      />
                      <Input
                        placeholder="Area"
                        value={newPeriodicTask.area}
                        onChange={(e) => setNewPeriodicTask((prev) => ({ ...prev, area: e.target.value }))}
                      />
                      <select
                        value={newPeriodicTask.frequency}
                        onChange={(e) => setNewPeriodicTask((prev) => ({ ...prev, frequency: e.target.value }))}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="FORTNIGHTLY">Fortnightly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                      </select>
                      <Input
                        placeholder="Notes"
                        value={newPeriodicTask.notes}
                        onChange={(e) => setNewPeriodicTask((prev) => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                    <Button className="mt-3 h-10" onClick={() => void createPeriodicCleaningTask()}>
                      Save periodic task
                    </Button>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-medium">Contact list</div>
                    <div className="max-h-48 space-y-1 overflow-auto text-xs">
                      {contacts.slice(0, 150).map((contact) => (
                        <div key={contact.id} className="rounded border p-2">
                          <div>{contact.companyName}</div>
                          <div className="text-muted-foreground">
                            {contact.type} · {contact.contactPerson || 'No person'} · {contact.phoneNumber || 'No phone'}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <select
                        value={newContact.type}
                        onChange={(e) => setNewContact((prev) => ({ ...prev, type: e.target.value }))}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="SUPPLIER">Supplier</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="PEST_CONTROL">Pest control</option>
                        <option value="VERIFIER">Verifier</option>
                        <option value="COUNCIL">Council</option>
                        <option value="MPI">MPI</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <Input
                        placeholder="Company name"
                        value={newContact.companyName}
                        onChange={(e) => setNewContact((prev) => ({ ...prev, companyName: e.target.value }))}
                      />
                      <Input
                        placeholder="Contact person"
                        value={newContact.contactPerson}
                        onChange={(e) => setNewContact((prev) => ({ ...prev, contactPerson: e.target.value }))}
                      />
                      <Input
                        placeholder="Phone"
                        value={newContact.phoneNumber}
                        onChange={(e) => setNewContact((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      />
                      <Input
                        placeholder="Email"
                        value={newContact.email}
                        onChange={(e) => setNewContact((prev) => ({ ...prev, email: e.target.value }))}
                      />
                      <Input
                        placeholder="Website"
                        value={newContact.website}
                        onChange={(e) => setNewContact((prev) => ({ ...prev, website: e.target.value }))}
                      />
                    </div>
                    <Textarea
                      className="mt-2"
                      placeholder="About"
                      value={newContact.about}
                      onChange={(e) => setNewContact((prev) => ({ ...prev, about: e.target.value }))}
                    />
                    <Button className="mt-3 h-10" onClick={() => void createContact()}>
                      Add contact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {selectedCategory !== 'Audit' && selectedCategory !== 'Settings' ? (
              <>
                <div className="text-base font-medium">{sectionTitle}</div>
                {taskTiles.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      No tasks found for this view.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {taskTiles.map((task) => {
                      const tone = getTaskTileTone(task, now)
                      const isDone = task.status === 'COMPLETED'
                      const toneClass =
                        tone === 'green'
                          ? 'border-emerald-300 bg-emerald-50'
                          : tone === 'red'
                            ? 'border-red-300 bg-red-50'
                            : 'border-amber-300 bg-amber-50'
                      const textClass =
                        tone === 'green' ? 'text-emerald-900' : tone === 'red' ? 'text-red-900' : 'text-amber-900'
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`w-full rounded-xl border p-4 text-left transition hover:brightness-95 ${toneClass}`}
                          onClick={() => startTaskEntry(task)}
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className={`text-base font-semibold ${textClass}`}>{getTaskTitle(task)}</div>
                            <Badge variant={isDone ? 'default' : 'outline'}>{isDone ? 'DONE' : task.status}</Badge>
                          </div>
                          <div className={`space-y-1 text-sm ${textClass}`}>
                            <div className="inline-flex items-center gap-1">
                              <Clock3 className="h-4 w-4" />
                              {formatDueTime(task.dueAt)}
                            </div>
                            <div>
                              {getTaskCategory(task)} · {getTaskPeriodLabel(task)}
                            </div>
                            {task.assetId ? (
                              <div>Fridge/asset: {getAssetDisplayName(task.asset) || 'Linked asset'}</div>
                            ) : null}
                            <div>
                              {isDone
                                ? 'Completed and logged'
                                : tone === 'red'
                                  ? 'Missed earlier - complete as priority'
                                  : 'Ready to complete'}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : null}

            {process.env.NODE_ENV !== 'production' ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Developer verification notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Record submissions should persist: <code>recordedById</code>, rule linkage, <code>taskId</code>{' '}
                    (if task mode), <code>relatedAssetId</code> (if asset-linked), JSON <code>data</code>, timestamps (
                    <code>createdAt</code>/<code>recordedAt</code>), and incident linkage on failures.
                  </p>
                  {lastSubmissionDebug ? (
                    <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                      {JSON.stringify(lastSubmissionDebug, null, 2)}
                    </pre>
                  ) : (
                    <p>No submission captured in this session yet.</p>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </main>

      <Dialog open={Boolean(formTarget)} onOpenChange={(open) => !open && setFormTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formTarget?.title || 'FCP Entry'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <div>
                Rule: <span className="font-medium">{formTarget?.rule.name}</span>
              </div>
              {formTarget?.mode === 'task' && formTarget.task.assetId ? (
                <div className="mt-1 text-base font-semibold text-foreground">
                  Fridge: {getAssetDisplayName(formTarget.task.asset) || 'Linked fridge asset'}
                </div>
              ) : null}
              <div>
                Entering as:{' '}
                <span className={recordedById ? 'font-medium' : 'font-medium text-red-600'}>
                  {selectedStaffName || 'Not selected'}
                </span>
              </div>
              {formTarget && (DRAFT_PERSIST_RULE_CODES as readonly string[]).includes(formTarget.rule.code) ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Drafts auto-save locally while you complete staged readings. Final submit logs the official record.
                </div>
              ) : null}
              {formTarget?.rule.code === 'weekly_chicken_batch_check' ? (
                <div className="mt-2 rounded-md border bg-background p-2 text-xs">
                  Cook the chicken for 3 minutes at 190degs. Check temp of the largest chicken piece.
                </div>
              ) : null}
              {formTarget?.rule.code === 'chicken_liver_pate_check' ? (
                <div className="mt-2 rounded-md border bg-background p-2 text-xs">
                  Once the pate has been cooked and blended - whilst hot temp check to ensure the mixture is 75degs
                  for 30 sec. Portion into tins and let cool by fan for 1hr - temp check below 19 degs, Then
                  refrigerate - further temp check after 5hrs - below 5deg.
                </div>
              ) : null}
            </div>

            {formTarget?.mode === 'quick' && formTarget.rule.code === FRIDGE_RULE_CODE ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="text-sm font-medium">Daily fridge temps</div>
                {fridgeAssets.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No active fridge assets found.</div>
                ) : (
                  fridgeAssets.map((asset) => (
                    <div key={asset.id} className="space-y-2">
                      <Label className="text-sm">{asset.name}</Label>
                      <Input
                        type="number"
                        step={0.1}
                        value={toInputValue(formData[`fridgeTemp_${asset.id}`])}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [`fridgeTemp_${asset.id}`]:
                              e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                        placeholder="Temperature °C"
                        className="h-12 text-base"
                      />
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {formTarget?.rule.code === SUPPLIER_DELIVERY_RULE_CODE ? (
              <div className="space-y-3 rounded-md border p-3">
                <Label htmlFor="fcp-supplier-select" className="text-sm font-medium">
                  Supplier
                </Label>
                <select
                  id="fcp-supplier-select"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                {selectedSupplier ? (
                  <div className="text-xs text-muted-foreground">
                    Email: {selectedSupplier.contactEmail || 'No email on file'}
                    {selectedSupplier.mpiNumber ? ` · MPI #: ${selectedSupplier.mpiNumber}` : ''}
                  </div>
                ) : null}
                {!selectedSupplier ? (
                  <div className="space-y-2">
                    <Label className="text-sm">Manual supplier name (fallback)</Label>
                    <Input
                      value={toInputValue(formData.supplierName)}
                      onChange={(e) => setFormData((prev) => ({ ...prev, supplierName: e.target.value }))}
                      placeholder="Supplier name"
                      className="h-12 text-base"
                    />
                  </div>
                ) : null}
                {supplierEmailRequired && !selectedSupplier?.contactEmail ? (
                  <div className="space-y-2">
                    <Label className="text-sm">Supplier email</Label>
                    <Input
                      type="email"
                      value={toInputValue(formData.supplierEmail)}
                      onChange={(e) => setFormData((prev) => ({ ...prev, supplierEmail: e.target.value }))}
                      placeholder="supplier@example.com"
                      className="h-12 text-base"
                    />
                  </div>
                ) : null}
                {supplierEmailRequired ? (
                  <div className="space-y-2 rounded-md bg-muted p-3">
                    <div className="text-sm font-medium">Supplier email workflow</div>
                    <Button type="button" variant="outline" className="h-10" onClick={openSupplierEmailPreview}>
                      Preview / edit supplier email
                    </Button>
                    {supplierEmailStatus ? (
                      <div className="text-xs text-emerald-700">
                        Email sent to {supplierEmailStatus.to} at{' '}
                        {new Date(supplierEmailStatus.sentAt).toLocaleTimeString('en-NZ', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        If sending later, the intent and draft will still be saved in this record.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {formTarget?.rule.code === TRAINING_QUIZ_RULE_CODE ? (
              <div className="space-y-4 rounded-md border p-3">
                <div className="text-sm font-medium">
                  Food safety training questionnaire ({STAFF_QUIZ_QUESTION_COUNT} questions)
                </div>
                {!quizResult ? (
                  quizQuestions.map((question, index) => {
                    const key = `quiz_${question.id}`
                    const selected = toInputValue(formData[key])
                    return (
                      <div key={question.id} className="space-y-2 rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">
                          {index + 1}. {question.category}
                        </div>
                        <div className="text-sm font-medium">{question.question}</div>
                        <div className="grid gap-2">
                          {question.shuffledOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`rounded-md border px-3 py-2 text-left text-sm ${
                                selected === option ? 'border-blue-500 bg-blue-50 text-blue-900' : 'hover:bg-muted'
                              }`}
                              onClick={() => setFormData((prev) => ({ ...prev, [key]: option }))}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="text-base font-semibold">
                      Result: {quizResult.result} ({quizResult.score}/{quizResult.totalQuestions} · {quizResult.percentage}%)
                    </div>
                    {quizResult.result === 'FAIL' ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                        Please review the incorrect answers and retake the questionnaire.
                      </div>
                    ) : null}
                    <div className="text-sm font-medium">Incorrect answers</div>
                    {quizResult.incorrectAnswers.length === 0 ? (
                      <div className="text-sm text-emerald-700">All answers correct.</div>
                    ) : (
                      <div className="space-y-2">
                        {quizResult.incorrectAnswers.map((row) => (
                          <div key={row.questionId} className="rounded-md border p-2 text-sm">
                            <div className="font-medium">{row.question}</div>
                            <div className="text-muted-foreground">Selected: {row.selectedAnswer || 'No answer'}</div>
                            <div className="text-muted-foreground">Correct: {row.correctAnswer}</div>
                            <div className="text-muted-foreground">{row.explanation}</div>
                            <div className="text-xs text-muted-foreground">FCP: {row.fcpReference}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setQuizQuestions(buildQuizQuestionSet(STAFF_QUIZ_QUESTION_COUNT))
                          setQuizResult(null)
                          setFormData(selectedStaffName ? { staffName: selectedStaffName } : {})
                        }}
                      >
                        Retake
                      </Button>
                      <Button type="button" onClick={() => setFormTarget(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-4">
              {getRuleFields(formTarget?.rule).length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No configured fields for this rule. Submit will record an empty payload.
                </div>
              ) : (
                getRuleFields(formTarget?.rule).map((field) => (
                  shouldShowField(field, formData) ? (
                    <div key={field.key} className="space-y-2">
                      <Label className="text-sm">
                        {field.label}
                        {field.required ? <span className="ml-1 text-red-600">*</span> : null}
                      </Label>
                      {renderFieldInput(field)}
                      {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
                    </div>
                  ) : null
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="h-11 px-5" onClick={() => setFormTarget(null)}>
                Cancel
              </Button>
              <Button
                className="h-11 px-5"
                onClick={() => void submitRecord()}
                disabled={saving || (formTarget?.rule.code === TRAINING_QUIZ_RULE_CODE && Boolean(quizResult))}
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Submit record'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={supplierEmailDialogOpen} onOpenChange={setSupplierEmailDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Supplier email preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Subject</Label>
              <Input
                value={supplierEmailDraft.subject}
                onChange={(e) =>
                  setSupplierEmailDraft((prev) => ({
                    ...prev,
                    subject: e.target.value,
                  }))
                }
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Body</Label>
              <Textarea
                value={supplierEmailDraft.body}
                onChange={(e) =>
                  setSupplierEmailDraft((prev) => ({
                    ...prev,
                    body: e.target.value,
                  }))
                }
                className="min-h-40 text-base"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSupplierEmailDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => void sendSupplierEmail()} disabled={supplierEmailSending}>
                {supplierEmailSending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  'Send email'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(recordDetail)} onOpenChange={(open) => !open && setRecordDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record details</DialogTitle>
          </DialogHeader>
          {recordDetail ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Type:</span>{' '}
                {recordDetail.rule?.name || recordDetail.rule?.code || 'Record'}
              </div>
              <div>
                <span className="font-medium">Recorded by:</span> {getRecordStaffName(recordDetail)}
              </div>
              <div>
                <span className="font-medium">Status:</span> {recordDetail.status}
              </div>
              <div>
                <span className="font-medium">Recorded at:</span>{' '}
                {new Date(recordDetail.recordedAt).toLocaleString('en-NZ')}
              </div>
              <div>
                <div className="mb-1 font-medium">Payload</div>
                <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(recordDetail.data ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(incidentDetail)} onOpenChange={(open) => !open && setIncidentDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Incident details</DialogTitle>
          </DialogHeader>
          {incidentDetail ? (
            <div className="space-y-3 text-sm">
              <div className="text-base font-semibold">{incidentDetail.title}</div>
              <div>
                <span className="font-medium">Severity:</span> {incidentDetail.severity}
              </div>
              <div>
                <span className="font-medium">Status:</span> {incidentDetail.status}
              </div>
              <div>
                <span className="font-medium">Opened:</span>{' '}
                {new Date(incidentDetail.openedAt).toLocaleString('en-NZ')}
              </div>
              {incidentDetail.rule ? (
                <div>
                  <span className="font-medium">Rule:</span> {incidentDetail.rule.name} ({incidentDetail.rule.code})
                </div>
              ) : null}
              {incidentDetail.asset ? (
                <div>
                  <span className="font-medium">Asset:</span>{' '}
                  {incidentDetail.asset.name || incidentDetail.asset.code || incidentDetail.asset.id}
                  {incidentDetail.asset.location ? ` · ${incidentDetail.asset.location}` : ''}
                </div>
              ) : null}
              {incidentDetail.description ? (
                <div>
                  <div className="mb-1 font-medium">Description</div>
                  <div className="rounded-md bg-muted p-3 whitespace-pre-wrap">{incidentDetail.description}</div>
                </div>
              ) : null}
              {incidentDetail.status === 'OPEN' ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={dismissingIncidentId === incidentDetail.id}
                    onClick={() => void dismissIncident(incidentDetail.id)}
                  >
                    {dismissingIncidentId === incidentDetail.id ? 'Dismissing...' : 'Dismiss incident'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
