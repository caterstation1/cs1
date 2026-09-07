import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { evaluateRuleFailure, toJsonObject } from '@/lib/fcp/bridge'
import { prisma } from '@/lib/prisma'
import type { CreateFcpRecordInput, FcpApiResponse } from '@/types/fcp'
import { getDateWhereClause, isYmd } from '@/lib/fcp/bridge'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')
  const ruleCode = searchParams.get('ruleCode')?.trim() || undefined
  const status = searchParams.get('status')?.trim() || undefined

  if (dateParam && !isYmd(dateParam)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const where: Prisma.FcpRecordWhereInput = {
    ...(dateParam ? { recordedAt: getDateWhereClause(dateParam) } : {}),
    ...(status ? { status: status as any } : {}),
    ...(ruleCode ? { rule: { code: ruleCode } } : {}),
  }

  const records = await prisma.fcpRecord.findMany({
    where,
    include: {
      rule: true,
      asset: true,
      task: true,
    },
    orderBy: [{ recordedAt: 'desc' }],
    take: 300,
  })

  return NextResponse.json({ data: records })
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload: CreateFcpRecordInput
  try {
    payload = (await request.json()) as CreateFcpRecordInput
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ruleCode = payload.ruleCode?.trim()
  const recordTypeCode = payload.recordType?.trim()
  const recordedById = payload.recordedById?.trim()
  const taskId = payload.taskId?.trim()
  const relatedOrderId = payload.relatedOrderId?.trim() || undefined
  const relatedAssetId = payload.relatedAssetId?.trim() || undefined
  const data = toJsonObject(payload.data)

  if (!recordedById) {
    return NextResponse.json({ error: 'recordedById is required' }, { status: 400 })
  }
  if (!ruleCode && !recordTypeCode) {
    return NextResponse.json(
      { error: 'Provide at least one of ruleCode or recordType' },
      { status: 400 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'data must be a JSON object' }, { status: 400 })
  }

  try {
    let rule = null as Awaited<ReturnType<typeof prisma.fcpRule.findUnique>>
    let recordType = null as Awaited<ReturnType<typeof prisma.fcpRecordType.findFirst>>

    if (ruleCode) {
      rule = await prisma.fcpRule.findUnique({
        where: { code: ruleCode },
      })
      if (!rule && ruleCode === 'staff_training_quiz') {
        const card = await prisma.fcpCard.findUnique({
          where: { code: 'starting_health' },
          select: { id: true },
        })
        if (card) {
          rule = await prisma.fcpRule.create({
            data: {
              cardId: card.id,
              code: 'staff_training_quiz',
              name: 'Training / staff competency quiz',
              description: 'Food safety competency quiz record.',
              triggerType: 'MANUAL',
              frequency: 'PER_BATCH',
              severity: 'MEDIUM',
              isActive: true,
              config: {
                dashboardCategory: 'Audit',
                taskTitle: 'Training competency quiz',
              },
            },
          })
        }
      }
      if (!rule || !rule.isActive) {
        return NextResponse.json({ error: 'Active ruleCode not found' }, { status: 404 })
      }
    }

    if (recordTypeCode) {
      if (rule) {
        recordType = await prisma.fcpRecordType.findFirst({
          where: {
            code: recordTypeCode,
            ruleId: rule.id,
            isActive: true,
          },
        })
      } else {
        const matches = await prisma.fcpRecordType.findMany({
          where: {
            code: recordTypeCode,
            isActive: true,
            rule: {
              isActive: true,
            },
          },
          include: {
            rule: true,
          },
          take: 2,
        })

        if (matches.length === 0) {
          return NextResponse.json({ error: 'recordType not found' }, { status: 404 })
        }
        if (matches.length > 1) {
          return NextResponse.json(
            { error: 'recordType is ambiguous across rules; provide ruleCode' },
            { status: 400 }
          )
        }

        recordType = matches[0]
        rule = matches[0].rule
      }

      if (!recordType) {
        return NextResponse.json(
          { error: 'recordType not found for the selected ruleCode' },
          { status: 404 }
        )
      }
    }

    if (!rule) {
      return NextResponse.json({ error: 'Unable to resolve active rule' }, { status: 400 })
    }

    let task:
      | {
          id: string
          ruleId: string
        }
      | null = null

    if (taskId) {
      task = await prisma.fcpTask.findUnique({
        where: { id: taskId },
        select: { id: true, ruleId: true },
      })
      if (!task) {
        return NextResponse.json({ error: 'taskId not found' }, { status: 404 })
      }
      if (task.ruleId !== rule.id) {
        return NextResponse.json(
          { error: 'taskId does not belong to provided ruleCode/recordType' },
          { status: 400 }
        )
      }
    }

    if (relatedAssetId) {
      const asset = await prisma.fcpAsset.findUnique({
        where: { id: relatedAssetId },
        select: { id: true },
      })
      if (!asset) {
        return NextResponse.json({ error: 'relatedAssetId not found' }, { status: 404 })
      }
    }

    const failureResult = evaluateRuleFailure(rule.config, data)
    const supplierIssueFlag =
      rule.code === 'supplier_delivery_check' &&
      (data.somethingWentWrong === true || data.tempCheckOkay === 'no')
    const complaintSafetyIssueFlag = rule.code === 'customer_complaint' && data.foodSafetyIssue === true
    const shouldCreateSupplierIncident = supplierIssueFlag || complaintSafetyIssueFlag

    const { record, incident } = await prisma.$transaction(async (tx) => {
      const createdRecord = await tx.fcpRecord.create({
        data: {
          ruleId: rule.id,
          recordTypeId: recordType?.id ?? null,
          taskId: task?.id ?? null,
          assetId: relatedAssetId ?? null,
          orderId: relatedOrderId ?? null,
          status: 'SUBMITTED',
          data: data as Prisma.InputJsonValue,
          recordedById,
        },
      })

      if (task) {
        await tx.fcpTask.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        })
      }

      if (rule.code === 'staff_training_quiz') {
        const result = typeof data.result === 'string' ? data.result.toUpperCase() : ''
        const latestFoodSafetyQuizStatus = result === 'PASS' || result === 'FAIL' ? result : null
        const latestScore = Number.isFinite(Number(data.score)) ? Number(data.score) : null
        const completedAtRaw = typeof data.completedAt === 'string' ? new Date(data.completedAt) : null
        const latestCompletedAt =
          completedAtRaw && !Number.isNaN(completedAtRaw.getTime()) ? completedAtRaw : new Date()

        await tx.staff.update({
          where: { id: recordedById },
          data: {
            latestFoodSafetyQuizStatus,
            latestScore,
            latestCompletedAt,
          },
        })
      }

      let createdIncident: Awaited<ReturnType<typeof tx.fcpIncident.create>> | null = null
      if ((failureResult.failed && failureResult.shouldCreateIncident) || shouldCreateSupplierIncident) {
        const supplierIssueDetails =
          typeof data.issueDetails === 'string' ? data.issueDetails : 'Supplier delivery issue reported.'
        const supplierActionTaken = typeof data.actionTaken === 'string' ? data.actionTaken : ''
        createdIncident = await tx.fcpIncident.create({
          data: {
            ruleId: rule.id,
            assetId: relatedAssetId ?? null,
            orderId: relatedOrderId ?? null,
            title: supplierIssueFlag
              ? `Supplier issue: ${rule.name}`
              : complaintSafetyIssueFlag
                ? 'Customer complaint - food safety issue'
                : `FCP rule failed: ${rule.name}`,
            description: supplierIssueFlag
              ? `${supplierIssueDetails}${supplierActionTaken ? `\nAction taken: ${supplierActionTaken}` : ''}`
              : complaintSafetyIssueFlag
                ? String(data.complaintDetails || 'Food safety complaint reported.')
                : (failureResult.reason ?? 'Rule failure detected at record submission.'),
            severity: rule.severity,
            status: 'OPEN',
          },
        })
      }

      return { record: createdRecord, incident: createdIncident }
    })

    const response: FcpApiResponse<{
      record: typeof record
      incident: typeof incident
    }> = {
      data: {
        record,
        incident,
      },
      meta: {
        ruleCode: rule.code,
        failed: failureResult.failed || supplierIssueFlag || complaintSafetyIssueFlag,
        taskCompleted: Boolean(task),
      },
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('fcp records POST error', error)
    return NextResponse.json({ error: 'Failed to create FCP record' }, { status: 500 })
  }
}
