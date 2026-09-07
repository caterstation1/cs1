import { prisma, withRetry } from '@/lib/prisma'
import { addDaysNZ, parseLocalDate } from '@/lib/date-utils'
import { getDayWindowForYmd, getRangeWindowForYmd, type CalendarRegion } from '@/lib/calendar-query'

type ExpectedOrderRow = {
  id: string
  orderNumber: number
  ymd: string
  deliveryDateTime: Date | null
  deliveryDateResolved: Date | null
  createdAt: Date
  hasLocalEdits: boolean | null
  dbUpdatedAt: Date | null
}

type MismatchDetail = {
  date: string
  missingOrderIds: string[]
  extraOrderIds: string[]
  missingOrderNumbers: number[]
  extraOrderNumbers: number[]
}

type RegionWatchdogResult = {
  region: CalendarRegion
  daysChecked: number
  expectedTotal: number
  byDayTotal: number
  mismatchCount: number
  mismatches: MismatchDetail[]
  oldFutureOrdersCount: number
  oldFutureOrdersSample: Array<{
    id: string
    orderNumber: number
    ymd: string
    createdAt: string
  }>
}

export type CalendarIntegrityWatchdogResult = {
  start: string
  endExclusive: string
  generatedAt: string
  regions: RegionWatchdogResult[]
  totalMismatchCount: number
}

function toYmd(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getFallbackResolvedRange(ymd: string) {
  const fallbackResolvedStart = parseLocalDate(ymd) || new Date(ymd)
  const fallbackResolvedEnd = new Date(
    fallbackResolvedStart.getFullYear(),
    fallbackResolvedStart.getMonth(),
    fallbackResolvedStart.getDate() + 1
  )
  return {
    gte: fallbackResolvedStart,
    lt: fallbackResolvedEnd,
  }
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

export async function runCalendarIntegrityWatchdog(params: {
  start: string
  endExclusive: string
  regions: CalendarRegion[]
  maxMismatchDetails?: number
  oldOrderDaysThreshold?: number
}): Promise<CalendarIntegrityWatchdogResult> {
  const {
    start,
    endExclusive,
    regions,
    maxMismatchDetails = 40,
    oldOrderDaysThreshold = 30,
  } = params

  const range = getRangeWindowForYmd({ startYmd: start, endYmdExclusive: endExclusive })
  const oldCutoff = new Date(Date.now() - oldOrderDaysThreshold * 24 * 60 * 60 * 1000)
  const regionResults: RegionWatchdogResult[] = []

  for (const region of regions) {
    const expectedRows = await withRetry(async () => {
      return await prisma.$queryRaw<ExpectedOrderRow[]>`
        SELECT
          o."id",
          o."orderNumber",
          COALESCE(
            TO_CHAR(DATE(o."deliveryDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland'), 'YYYY-MM-DD'),
            TO_CHAR(o."deliveryDateResolved", 'YYYY-MM-DD')
          ) as ymd,
          o."deliveryDateTime",
          o."deliveryDateResolved",
          o."createdAt",
          o."hasLocalEdits",
          o."dbUpdatedAt"
        FROM "Order" o
        WHERE
          o."region" = ${region}
          AND o."cancelledAt" IS NULL
          AND (
            (
              o."deliveryDateTime" IS NOT NULL
              AND o."deliveryDateTime" >= ${range.start}
              AND o."deliveryDateTime" < ${range.endExclusive}
            )
            OR
            (
              o."deliveryDateTime" IS NULL
              AND o."deliveryDateResolved" IS NOT NULL
              AND o."deliveryDateResolved" >= CAST(${start} AS DATE)
              AND o."deliveryDateResolved" < CAST(${endExclusive} AS DATE)
            )
          )
      `
    })

    const rowsById = new Map(expectedRows.map((r) => [r.id, r]))
    const expectedByDay = new Map<string, Set<string>>()
    for (const row of expectedRows) {
      if (!expectedByDay.has(row.ymd)) expectedByDay.set(row.ymd, new Set())
      expectedByDay.get(row.ymd)!.add(row.id)
    }

    const oldFutureOrdersSample = expectedRows
      .filter((row) => row.createdAt < oldCutoff)
      .slice(0, 20)
      .map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        ymd: row.ymd,
        createdAt: row.createdAt.toISOString(),
      }))

    const mismatches: MismatchDetail[] = []
    let byDayTotal = 0
    let daysChecked = 0

    for (let ymd = start; ymd < endExclusive; ymd = addDaysNZ(ymd, 1)) {
      daysChecked++
      const expectedIds = expectedByDay.get(ymd) || new Set<string>()
      const dayWindow = getDayWindowForYmd(ymd)
      const fallbackResolvedRange = getFallbackResolvedRange(ymd)

      const dayOrders = await withRetry(async () => {
        return await prisma.order.findMany({
          where: {
            region,
            cancelledAt: null,
            OR: [
              {
                deliveryDateTime: {
                  gte: dayWindow.start,
                  lt: dayWindow.endExclusive,
                },
              },
              {
                deliveryDateTime: null,
                deliveryDateResolved: fallbackResolvedRange as any,
              },
            ],
          },
          select: {
            id: true,
            orderNumber: true,
          },
        })
      })

      byDayTotal += dayOrders.length
      const byDayIds = new Set(dayOrders.map((o) => o.id))

      const missing = [...expectedIds].filter((id) => !byDayIds.has(id))
      const extra = [...byDayIds].filter((id) => !expectedIds.has(id))

      if (missing.length > 0 || extra.length > 0) {
        mismatches.push({
          date: ymd,
          missingOrderIds: missing.slice(0, maxMismatchDetails),
          extraOrderIds: extra.slice(0, maxMismatchDetails),
          missingOrderNumbers: unique(
            missing
              .map((id) => rowsById.get(id)?.orderNumber)
              .filter((n): n is number => typeof n === 'number')
          ).slice(0, maxMismatchDetails),
          extraOrderNumbers: unique(
            dayOrders
              .filter((o) => extra.includes(o.id))
              .map((o) => o.orderNumber)
          ).slice(0, maxMismatchDetails),
        })
      }
    }

    regionResults.push({
      region,
      daysChecked,
      expectedTotal: expectedRows.length,
      byDayTotal,
      mismatchCount: mismatches.length,
      mismatches,
      oldFutureOrdersCount: expectedRows.filter((row) => row.createdAt < oldCutoff).length,
      oldFutureOrdersSample,
    })
  }

  return {
    start,
    endExclusive,
    generatedAt: new Date().toISOString(),
    totalMismatchCount: regionResults.reduce((sum, r) => sum + r.mismatchCount, 0),
    regions: regionResults,
  }
}
