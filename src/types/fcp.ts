import type { Prisma, FcpFrequency, FcpIncidentStatus, FcpRecordStatus, FcpSeverity, FcpTaskStatus, FcpTriggerType } from '@/generated/prisma'

export type FcpJsonRecord = Record<string, Prisma.JsonValue>

export type FcpApiResponse<T> = {
  data: T
  meta?: Record<string, Prisma.JsonValue>
}

export type FcpRulesQuery = {
  category?: string
  triggerType?: FcpTriggerType
  frequency?: FcpFrequency
}

export type FcpTasksQuery = {
  status?: FcpTaskStatus
  date?: string
  category?: string
  relatedOrderId?: string
}

export type CreateFcpRecordInput = {
  recordType?: string
  ruleCode?: string
  taskId?: string
  recordedById?: string
  relatedOrderId?: string
  relatedAssetId?: string
  data?: Prisma.JsonValue
}

export type CreateFcpIncidentInput = {
  title?: string
  description?: string
  severity?: FcpSeverity
  status?: FcpIncidentStatus
  relatedOrderId?: string
  sourceRecordId?: string
  openedById?: string
}

export type RecordSubmissionResult = {
  record: {
    id: string
    ruleId: string
    status: FcpRecordStatus
  } & Record<string, Prisma.JsonValue>
  incident: ({ id: string } & Record<string, Prisma.JsonValue>) | null
}
