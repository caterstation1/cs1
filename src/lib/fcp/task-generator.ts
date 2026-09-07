import {
  FcpAssetType,
  FcpFrequency,
  FcpPeriodicFrequency,
  FcpSeverity,
  FcpTriggerType,
  type Prisma,
} from '@/generated/prisma'
import { formatNZYMD, getNZDateRangeForYmd } from '@/lib/date-utils'
import { parseRuleConfig } from '@/lib/fcp/bridge'
import { prisma } from '@/lib/prisma'

type GenerationStats = {
  createdTasks: number
  skippedExisting: number
  placeholders: number
}

type RuleWithCard = Awaited<ReturnType<typeof prisma.fcpRule.findMany>>[number]
type AssetRow = Awaited<ReturnType<typeof prisma.fcpAsset.findMany>>[number]

const REQUIRED_FCP_RULES: Array<{
  code: string
  cardCode: string
  name: string
  description: string
  triggerType: FcpTriggerType
  frequency: FcpFrequency
  severity: FcpSeverity
  config: Prisma.JsonObject
}> = [
  {
    code: 'weekly_lamb_batch_check',
    cardCode: 'proving_method',
    name: 'Weekly lamb batch verification',
    description: 'Weekly lamb cooling verification over 5-hour window.',
    triggerType: 'WEEKLY',
    frequency: 'WEEKLY',
    severity: 'HIGH',
    config: {
      dashboardCategory: 'Lamb',
      taskTitle: 'Weekly lamb batch verification',
      fields: [
        { key: 'staffName', label: 'Name / Staff', type: 'text', required: true },
        { key: 'outOfOvenTempC', label: 'Out of oven temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'tempAfter1_5hC', label: 'After 1.5 hrs temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'tempAfter5hC', label: 'After 5 hrs temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
        { key: 'correctiveActionIfFailed', label: 'Corrective action if failed', type: 'textarea', required: false },
      ],
      failConditionAny: [
        { field: 'passed', equals: false },
        { field: 'tempAfter1_5hC', operator: '>=', value: 21 },
        { field: 'tempAfter5hC', operator: '>=', value: 5 },
      ],
      onFail: ['CREATE_INCIDENT'],
    },
  },
  {
    code: 'weekly_pork_batch_check',
    cardCode: 'proving_method',
    name: 'Weekly pork batch verification',
    description: 'Weekly pork cooling verification over 5-hour window.',
    triggerType: 'WEEKLY',
    frequency: 'WEEKLY',
    severity: 'HIGH',
    config: {
      dashboardCategory: 'Pork',
      taskTitle: 'Weekly pork batch verification',
      fields: [
        { key: 'staffName', label: 'Name / Staff', type: 'text', required: true },
        { key: 'outOfOvenTempC', label: 'Out of oven temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'tempAfter1_5hC', label: 'After 1.5 hrs temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'tempAfter5hC', label: 'After 5 hrs temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
        { key: 'correctiveActionIfFailed', label: 'Corrective action if failed', type: 'textarea', required: false },
      ],
      failConditionAny: [
        { field: 'passed', equals: false },
        { field: 'tempAfter1_5hC', operator: '>=', value: 21 },
        { field: 'tempAfter5hC', operator: '>=', value: 5 },
      ],
      onFail: ['CREATE_INCIDENT'],
    },
  },
  {
    code: 'weekly_chicken_batch_check',
    cardCode: 'cooking_checks',
    name: 'Weekly fried chicken check',
    description: 'Weekly fried chicken check with temperature and pass/fail.',
    triggerType: 'WEEKLY',
    frequency: 'WEEKLY',
    severity: 'HIGH',
    config: {
      dashboardCategory: 'Chicken',
      taskTitle: 'Weekly fried chicken check',
      fields: [
        { key: 'staffName', label: 'Name / Staff', type: 'text', required: true },
        { key: 'internalTempC', label: 'Largest piece temperature (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false },
      ],
      failCondition: { field: 'passed', equals: false },
      onFail: ['CREATE_INCIDENT'],
    },
  },
  {
    code: 'chicken_liver_pate_check',
    cardCode: 'proving_method',
    name: 'Chicken liver pate cooling check',
    description: 'Ad hoc staged cooling check for chicken liver pate.',
    triggerType: 'MANUAL',
    frequency: 'PER_BATCH',
    severity: 'HIGH',
    config: {
      dashboardCategory: 'Chicken',
      taskTitle: 'Chicken liver pate check',
      fields: [
        { key: 'staffName', label: 'Name / Staff', type: 'text', required: true },
        { key: 'hotBlendTempC', label: 'Hot blend temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'tempAfter1hC', label: 'After 1 hour fan cool temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'tempAfter5hC', label: 'After 5 hours refrigerated temp (°C)', type: 'number', required: true, step: 0.1 },
        { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
        { key: 'correctiveActionIfFailed', label: 'Corrective action if failed', type: 'textarea', required: false },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false },
      ],
      failConditionAny: [
        { field: 'passed', equals: false },
        { field: 'hotBlendTempC', operator: '<', value: 75 },
        { field: 'tempAfter1hC', operator: '>=', value: 19 },
        { field: 'tempAfter5hC', operator: '>=', value: 5 },
      ],
      onFail: ['CREATE_INCIDENT'],
    },
  },
  {
    code: 'six_month_ph_tester_check',
    cardCode: 'maintenance',
    name: '6-month pH tester check',
    description: 'Six-monthly pH tester verification/calibration check.',
    triggerType: 'EQUIPMENT_BASED',
    frequency: 'SIX_MONTHLY',
    severity: 'HIGH',
    config: {
      dashboardCategory: 'Thermometers',
      taskTitle: '6-month pH tester check',
      assetTypes: ['EQUIPMENT', 'THERMOMETER'],
      assetNameContainsAny: ['ph', 'pH', 'tester'],
      fields: [
        { key: 'staffName', label: 'Name / Staff', type: 'text', required: true },
        { key: 'readingPh', label: 'Reference pH reading', type: 'number', required: true, step: 0.1 },
        { key: 'passed', label: 'Pass?', type: 'boolean', required: true },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false },
      ],
      failCondition: { field: 'passed', equals: false },
      onFail: ['CREATE_INCIDENT'],
    },
  },
  {
    code: 'equipment_maintenance_check',
    cardCode: 'maintenance',
    name: 'Equipment maintenance check',
    description: 'Record equipment or facility maintenance issues (6-month cycle).',
    triggerType: 'EQUIPMENT_BASED',
    frequency: 'SIX_MONTHLY',
    severity: 'MEDIUM',
    config: {
      dashboardCategory: 'Cleaning',
      taskTitle: 'Equipment maintenance check',
      fields: [
        { key: 'assetName', label: 'Equipment', type: 'text', required: true },
        { key: 'conditionOk', label: 'Working correctly?', type: 'boolean', required: true },
        { key: 'actionTaken', label: 'Action taken', type: 'textarea', required: false },
      ],
      failCondition: { field: 'conditionOk', equals: false },
      onFail: ['CREATE_INCIDENT'],
    },
  },
]

async function ensureRequiredRules(activePlanId: string) {
  const cards = await prisma.fcpCard.findMany({
    where: { planId: activePlanId },
    select: { id: true, code: true },
  })
  const cardByCode = new Map(cards.map((card) => [card.code, card.id]))

  for (const rule of REQUIRED_FCP_RULES) {
    const cardId = cardByCode.get(rule.cardCode)
    if (!cardId) continue
    await prisma.fcpRule.upsert({
      where: { code: rule.code },
      update: {
        cardId,
        name: rule.name,
        description: rule.description,
        triggerType: rule.triggerType,
        frequency: rule.frequency,
        severity: rule.severity,
        isActive: true,
        config: rule.config,
      },
      create: {
        code: rule.code,
        cardId,
        name: rule.name,
        description: rule.description,
        triggerType: rule.triggerType,
        frequency: rule.frequency,
        severity: rule.severity,
        isActive: true,
        config: rule.config,
      },
    })
  }
}

function getNzWeekStartYmd(date: Date): string {
  const nzYmd = formatNZYMD(date)
  const { start } = getNZDateRangeForYmd(nzYmd)
  const day = start.getUTCDay() // 0=Sun,1=Mon,... in absolute time but anchored to NZ local midnight
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(start.getTime() + diffToMonday * 24 * 60 * 60 * 1000)
  return formatNZYMD(monday)
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

function getAssetLastCheckedAt(asset: AssetRow): Date {
  const metadata = asset.metadata
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const raw = (metadata as Record<string, unknown>).lastCheckedAt
    if (typeof raw === 'string') {
      const parsed = new Date(raw)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  }
  return asset.createdAt
}

function getRuleAssetTypes(rule: RuleWithCard): FcpAssetType[] {
  const config = parseRuleConfig(rule.config)
  const raw = (config as unknown as { assetTypes?: unknown }).assetTypes
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is FcpAssetType =>
    Object.values(FcpAssetType).includes(value as FcpAssetType)
  )
}

function getRuleAssetNameContains(rule: RuleWithCard): string[] {
  const config = parseRuleConfig(rule.config) as unknown as { assetNameContainsAny?: unknown }
  const raw = config.assetNameContainsAny
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function buildTaskContext(rule: RuleWithCard, generatedForYmd: string, mode: string): Prisma.JsonObject {
  const config = parseRuleConfig(rule.config)
  return {
    generatedBy: 'fcp-task-generator',
    generatedForDate: generatedForYmd,
    generationMode: mode,
    dashboardCategory: config.dashboardCategory ?? null,
  }
}

async function taskExistsForDueDate(input: {
  ruleId: string
  dueYmd: string
  assetId?: string
  orderId?: string
}): Promise<boolean> {
  const { start, end } = getNZDateRangeForYmd(input.dueYmd)
  const existing = await prisma.fcpTask.findFirst({
    where: {
      ruleId: input.ruleId,
      assetId: input.assetId ?? null,
      orderId: input.orderId ?? null,
      dueAt: {
        gte: start,
        lte: end,
      },
    },
    select: { id: true },
  })
  return Boolean(existing)
}

async function createTask(input: {
  rule: RuleWithCard
  dueYmd: string
  assetId?: string
  orderId?: string
  context?: Prisma.JsonObject
  mode: string
}): Promise<boolean> {
  const exists = await taskExistsForDueDate({
    ruleId: input.rule.id,
    dueYmd: input.dueYmd,
    assetId: input.assetId,
    orderId: input.orderId,
  })
  if (exists) return false

  const { start, end } = getNZDateRangeForYmd(input.dueYmd)
  const dueAt = input.rule.frequency === FcpFrequency.CLOSING ? end : start

  await prisma.fcpTask.create({
    data: {
      ruleId: input.rule.id,
      assetId: input.assetId ?? null,
      orderId: input.orderId ?? null,
      dueAt,
      status: 'OPEN',
      context: {
        ...buildTaskContext(input.rule, input.dueYmd, input.mode),
        ...(input.context ?? {}),
      },
    },
  })
  return true
}

function periodicFrequencyToDays(frequency: FcpPeriodicFrequency): number {
  if (frequency === 'WEEKLY') return 7
  if (frequency === 'FORTNIGHTLY') return 14
  if (frequency === 'MONTHLY') return 30
  return 90
}

async function generatePeriodicCleaningTasks(
  targetDate: Date,
  targetYmd: string,
  rule: RuleWithCard | null
): Promise<Pick<GenerationStats, 'createdTasks' | 'skippedExisting'>> {
  if (!rule) return { createdTasks: 0, skippedExisting: 0 }

  const defaults: Array<{
    taskName: string
    area: string
    frequency: FcpPeriodicFrequency
    notes?: string
    applyToCars?: boolean
    applyToAssetType?: FcpAssetType
  }> = [
    { taskName: 'Fridge deep clean and inspection', area: 'Fridges', frequency: 'MONTHLY', applyToAssetType: 'FRIDGE' },
    { taskName: 'Oven deep clean and inspection', area: 'Kitchen', frequency: 'QUARTERLY' },
    { taskName: 'Bathroom deep clean', area: 'Bathroom', frequency: 'MONTHLY' },
    { taskName: 'Cars checked for cleanliness', area: 'Fleet', frequency: 'WEEKLY', applyToCars: true },
    { taskName: 'Outside bin area clean', area: 'Outside bin area', frequency: 'WEEKLY' },
    { taskName: 'Cardboard room clean', area: 'Cardboard room', frequency: 'FORTNIGHTLY' },
    { taskName: 'Dessert room clean', area: 'Dessert room', frequency: 'WEEKLY' },
    { taskName: 'Dining area clean', area: 'Dining area', frequency: 'WEEKLY' },
    { taskName: 'Roller door entrance clean', area: 'Roller door entrance', frequency: 'WEEKLY' },
  ]
  for (const item of defaults) {
    const exists = await prisma.fcpPeriodicCleaningTask.findFirst({
      where: { taskName: item.taskName, area: item.area },
      select: { id: true },
    })
    if (!exists) {
      await prisma.fcpPeriodicCleaningTask.create({
        data: {
          taskName: item.taskName,
          area: item.area,
          frequency: item.frequency,
          notes: item.notes ?? null,
          isActive: true,
          applyToCars: item.applyToCars ?? false,
          applyToAssetType: item.applyToAssetType ?? null,
        },
      })
    }
  }

  const defs = await prisma.fcpPeriodicCleaningTask.findMany({
    where: { isActive: true },
    orderBy: [{ area: 'asc' }, { taskName: 'asc' }],
  })
  if (!defs.length) return { createdTasks: 0, skippedExisting: 0 }

  const assets = await prisma.fcpAsset.findMany({ where: { isActive: true }, select: { id: true, name: true, type: true } })
  const cars = await prisma.car.findMany({
    select: { id: true, name: true, rego: true },
    orderBy: [{ name: 'asc' }],
  })

  let createdTasks = 0
  let skippedExisting = 0
  const targetTime = new Date(getNZDateRangeForYmd(targetYmd).start).getTime()

  for (const def of defs) {
    let dueThisRun = true
    const intervalDays = periodicFrequencyToDays(def.frequency)
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000
    if (def.lastGeneratedAt) {
      const anchor = def.lastGeneratedAt.getTime()
      if (targetTime < anchor || (targetTime - anchor) % intervalMs !== 0) dueThisRun = false
    }
    if (!dueThisRun) continue

    const createFor = async (orderId: string, context: Prisma.JsonObject) => {
      const created = await createTask({
        rule,
        dueYmd: targetYmd,
        orderId,
        mode: 'PERIODIC_CLEANING',
        context,
      })
      if (created) createdTasks += 1
      else skippedExisting += 1
    }

    if (def.applyToCars) {
      for (const car of cars) {
        await createFor(`periodic:${def.id}:car:${car.id}`, {
          taskTitle: `${def.taskName} (${car.name}${car.rego ? ` · ${car.rego}` : ''})`,
          area: def.area,
          periodicTaskId: def.id,
          carId: car.id,
        })
      }
      await prisma.fcpPeriodicCleaningTask.update({
        where: { id: def.id },
        data: { lastGeneratedAt: getNZDateRangeForYmd(targetYmd).start },
      })
      continue
    }

    if (def.applyToAssetType) {
      const matched = assets.filter((asset) => asset.type === def.applyToAssetType)
      for (const asset of matched) {
        await createFor(`periodic:${def.id}:asset:${asset.id}`, {
          taskTitle: `${def.taskName} (${asset.name})`,
          area: def.area,
          periodicTaskId: def.id,
          assetId: asset.id,
        })
      }
      await prisma.fcpPeriodicCleaningTask.update({
        where: { id: def.id },
        data: { lastGeneratedAt: getNZDateRangeForYmd(targetYmd).start },
      })
      continue
    }

    await createFor(`periodic:${def.id}:base`, {
      taskTitle: def.taskName,
      area: def.area,
      periodicTaskId: def.id,
    })
    await prisma.fcpPeriodicCleaningTask.update({
      where: { id: def.id },
      data: { lastGeneratedAt: getNZDateRangeForYmd(targetYmd).start },
    })
  }

  return { createdTasks, skippedExisting }
}

async function generateEquipmentTasksForRule(
  rule: RuleWithCard,
  targetDate: Date,
  targetYmd: string
): Promise<Pick<GenerationStats, 'createdTasks' | 'skippedExisting'>> {
  const assetTypes = getRuleAssetTypes(rule)
  const assetNameContains = getRuleAssetNameContains(rule).map((value) => value.toLowerCase())
  const assets = await prisma.fcpAsset.findMany({
    where: {
      isActive: true,
      ...(assetTypes.length ? { type: { in: assetTypes } } : {}),
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
  const matchedAssets = assetNameContains.length
    ? assets.filter((asset) => {
        const haystack = `${asset.name || ''} ${asset.code || ''}`.toLowerCase()
        return assetNameContains.some((needle) => haystack.includes(needle))
      })
    : assets

  let createdTasks = 0
  let skippedExisting = 0
  const weekStartYmd = getNzWeekStartYmd(targetDate)
  const { end: targetDayEnd } = getNZDateRangeForYmd(targetYmd)

  for (const asset of matchedAssets) {
    let dueYmd: string | null = targetYmd

    if (rule.frequency === FcpFrequency.WEEKLY) {
      dueYmd = weekStartYmd
    } else if (rule.frequency === FcpFrequency.SIX_MONTHLY) {
      const lastCheckedAt = getAssetLastCheckedAt(asset)
      const nextDue = addMonths(lastCheckedAt, 6)
      if (nextDue > targetDayEnd) {
        continue
      }
      dueYmd = targetYmd
    }

    if (!dueYmd) continue

    const created = await createTask({
      rule,
      dueYmd,
      assetId: asset.id,
      mode: 'EQUIPMENT_BASED',
    })
    if (created) {
      createdTasks += 1
    } else {
      skippedExisting += 1
    }
  }

  return { createdTasks, skippedExisting }
}

export async function generateFcpTasksForDate(date: Date): Promise<GenerationStats> {
  const stats: GenerationStats = {
    createdTasks: 0,
    skippedExisting: 0,
    placeholders: 0,
  }

  const activePlan = await prisma.fcpPlan.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (!activePlan) return stats
  await ensureRequiredRules(activePlan.id)

  const targetYmd = formatNZYMD(date)
  const weekStartYmd = getNzWeekStartYmd(date)

  const rules = await prisma.fcpRule.findMany({
    where: {
      isActive: true,
      card: {
        planId: activePlan.id,
      },
    },
    include: {
      card: true,
    },
    orderBy: [{ severity: 'desc' }, { name: 'asc' }],
  })

  const periodicRule =
    rules.find((rule) => rule.code === 'periodic_cleaning_task') ??
    rules.find((rule) => rule.code === 'daily_cleaning_tasks') ??
    null
  const periodicStats = await generatePeriodicCleaningTasks(date, targetYmd, periodicRule)
  stats.createdTasks += periodicStats.createdTasks
  stats.skippedExisting += periodicStats.skippedExisting

  for (const rule of rules) {
    if (rule.triggerType === FcpTriggerType.ORDER_BASED) {
      stats.placeholders += 1
      continue
    }

    if (rule.triggerType === FcpTriggerType.MANUAL) {
      continue
    }

    if (rule.triggerType === FcpTriggerType.EQUIPMENT_BASED) {
      const equipmentStats = await generateEquipmentTasksForRule(rule, date, targetYmd)
      stats.createdTasks += equipmentStats.createdTasks
      stats.skippedExisting += equipmentStats.skippedExisting
      continue
    }

    if (rule.triggerType === FcpTriggerType.WEEKLY || rule.frequency === FcpFrequency.WEEKLY) {
      const created = await createTask({
        rule,
        dueYmd: weekStartYmd,
        mode: 'WEEKLY',
      })
      if (created) stats.createdTasks += 1
      else stats.skippedExisting += 1
      continue
    }

    if (
      rule.triggerType === FcpTriggerType.DAILY ||
      rule.frequency === FcpFrequency.DAILY ||
      rule.frequency === FcpFrequency.CLOSING
    ) {
      const created = await createTask({
        rule,
        dueYmd: targetYmd,
        mode: 'DAILY',
      })
      if (created) stats.createdTasks += 1
      else stats.skippedExisting += 1
      continue
    }

    if (rule.frequency === FcpFrequency.SIX_MONTHLY) {
      // Six-monthly currently relies on asset schedule checks and is handled
      // in EQUIPMENT_BASED mode only.
      continue
    }
  }

  return stats
}
