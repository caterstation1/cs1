import { FcpFrequency, FcpTaskStatus, FcpTriggerType, type Prisma } from '@/generated/prisma'
import { getNZDateRangeForYmd } from '@/lib/date-utils'
import { prisma } from '@/lib/prisma'

type UnknownRecord = Record<string, unknown>

type RuleCondition = {
  field?: string
  equals?: unknown
  operator?: string
  value?: unknown
}

type RuleConfig = {
  dashboardCategory?: string
  failCondition?: RuleCondition
  failConditionAny?: RuleCondition[]
  passCondition?: RuleCondition
  passConditionAll?: RuleCondition[]
  onFail?: string[]
}

export function parseEnumParam<T extends string>(
  value: string | null,
  enumLike: Record<string, T>
): T | null {
  if (!value) return null
  return Object.values(enumLike).includes(value as T) ? (value as T) : null
}

export function parseTriggerType(value: string | null): FcpTriggerType | null {
  return parseEnumParam(value, FcpTriggerType)
}

export function parseFrequency(value: string | null): FcpFrequency | null {
  return parseEnumParam(value, FcpFrequency)
}

export function parseTaskStatus(value: string | null): FcpTaskStatus | null {
  return parseEnumParam(value, FcpTaskStatus)
}

export function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function toJsonObject(value: unknown): Record<string, Prisma.JsonValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, Prisma.JsonValue>
}

export async function getActiveFcpPlan() {
  return prisma.fcpPlan.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: [{ updatedAt: 'desc' }],
  })
}

export function getDateWhereClause(ymd: string): { gte: Date; lte: Date } {
  const { start, end } = getNZDateRangeForYmd(ymd)
  return { gte: start, lte: end }
}

export function parseRuleConfig(raw: Prisma.JsonValue): RuleConfig {
  const config = toJsonObject(raw)
  if (!config) return {}

  return {
    dashboardCategory:
      typeof config.dashboardCategory === 'string' ? config.dashboardCategory : undefined,
    failCondition: toRuleCondition(config.failCondition),
    failConditionAny: toConditionArray(config.failConditionAny),
    passCondition: toRuleCondition(config.passCondition),
    passConditionAll: toConditionArray(config.passConditionAll),
    onFail: Array.isArray(config.onFail)
      ? config.onFail.filter((v): v is string => typeof v === 'string')
      : undefined,
  }
}

function toRuleCondition(value: unknown): RuleCondition | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as RuleCondition
}

function toConditionArray(value: unknown): RuleCondition[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((entry): entry is RuleCondition => !!entry && typeof entry === 'object')
}

function compareWithOperator(actual: unknown, operator: string, expected: unknown): boolean {
  if (operator === '=' || operator === '==') return actual === expected
  if (operator === '!=') return actual !== expected

  const actualNum =
    typeof actual === 'number'
      ? actual
      : typeof actual === 'string'
        ? Number(actual)
        : Number.NaN
  const expectedNum =
    typeof expected === 'number'
      ? expected
      : typeof expected === 'string'
        ? Number(expected)
        : Number.NaN

  if (Number.isNaN(actualNum) || Number.isNaN(expectedNum)) return false

  switch (operator) {
    case '<':
      return actualNum < expectedNum
    case '<=':
      return actualNum <= expectedNum
    case '>':
      return actualNum > expectedNum
    case '>=':
      return actualNum >= expectedNum
    default:
      return false
  }
}

function evaluateCondition(data: UnknownRecord, condition: RuleCondition): boolean {
  if (!condition.field || !(condition.field in data)) return false
  const actual = data[condition.field]

  if (typeof condition.operator === 'string' && 'value' in condition) {
    return compareWithOperator(actual, condition.operator, condition.value)
  }

  if ('equals' in condition) {
    return actual === condition.equals
  }

  return false
}

export function evaluateRuleFailure(
  configRaw: Prisma.JsonValue,
  dataRaw: Record<string, Prisma.JsonValue>
): { failed: boolean; reason: string | null; shouldCreateIncident: boolean } {
  const config = parseRuleConfig(configRaw)
  const data = dataRaw as UnknownRecord
  const onFailCreatesIncident = Boolean(config.onFail?.includes('CREATE_INCIDENT'))

  if (config.failCondition && evaluateCondition(data, config.failCondition)) {
    return {
      failed: true,
      reason: `Failed failCondition on field "${config.failCondition.field ?? 'unknown'}"`,
      shouldCreateIncident: onFailCreatesIncident,
    }
  }

  if (config.failConditionAny?.length) {
    const matched = config.failConditionAny.find((condition) => evaluateCondition(data, condition))
    if (matched) {
      return {
        failed: true,
        reason: `Failed failConditionAny on field "${matched.field ?? 'unknown'}"`,
        shouldCreateIncident: onFailCreatesIncident,
      }
    }
  }

  if (config.passCondition && !evaluateCondition(data, config.passCondition)) {
    return {
      failed: true,
      reason: `Did not satisfy passCondition on field "${config.passCondition.field ?? 'unknown'}"`,
      shouldCreateIncident: onFailCreatesIncident,
    }
  }

  if (config.passConditionAll?.length) {
    const failedPass = config.passConditionAll.find(
      (condition) => !evaluateCondition(data, condition)
    )
    if (failedPass) {
      return {
        failed: true,
        reason: `Did not satisfy passConditionAll on field "${failedPass.field ?? 'unknown'}"`,
        shouldCreateIncident: onFailCreatesIncident,
      }
    }
  }

  return { failed: false, reason: null, shouldCreateIncident: false }
}
