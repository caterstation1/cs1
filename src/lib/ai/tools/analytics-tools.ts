import { ToolResult } from '../schemas'
import { compareSalesPeriods, getSalesKpisForPeriod } from '../analytics/sales-metrics'
import { normalizePeriodKey, PeriodKey, resolvePeriod } from '../analytics/periods'

function kpisToRows(kpis: Awaited<ReturnType<typeof getSalesKpisForPeriod>>) {
  return [{
    period: kpis.periodLabel,
    orders: kpis.orderCount,
    revenueExGst: `$${kpis.revenueExGst.toLocaleString()}`,
    grossProfit: `$${kpis.grossProfit.toLocaleString()}`,
    grossMargin: `${kpis.grossMarginPct}%`,
  }]
}

export async function toolCompareSalesPeriods(args: {
  currentPeriod?: string
  comparePeriod?: string
  dateField?: 'createdAt' | 'deliveryDate'
}): Promise<ToolResult> {
  const currentKey = normalizePeriodKey(args.currentPeriod, 'this_week_wtd')
  const compareKey = normalizePeriodKey(args.comparePeriod, 'last_week_same_days')
  const dateField = args.dateField === 'deliveryDate' ? 'deliveryDate' : 'createdAt'

  const current = resolvePeriod(currentKey, { dateField })
  const compare = resolvePeriod(compareKey, { dateField })

  const result = await compareSalesPeriods(current, compare)
  const direction = result.deltaRevenueExGst >= 0 ? 'up' : 'down'
  const pctPart =
    result.deltaRevenuePct != null
      ? ` (${result.deltaRevenuePct >= 0 ? '+' : ''}${result.deltaRevenuePct}%)`
      : ''

  return {
    answer: `Sales are ${direction} $${Math.abs(result.deltaRevenueExGst).toLocaleString()} ex GST${pctPart} vs ${compare.label}. ${result.current.orderCount} orders now vs ${result.compare.orderCount} then.`,
    confidence: 0.92,
    evidence: {
      totals: {
        currentRevenueExGst: result.current.revenueExGst,
        compareRevenueExGst: result.compare.revenueExGst,
        deltaRevenueExGst: result.deltaRevenueExGst,
        deltaRevenuePct: result.deltaRevenuePct ?? 'n/a',
        deltaOrderCount: result.deltaOrderCount,
      },
      tables: [
        { name: current.label, rows: kpisToRows(result.current) },
        { name: compare.label, rows: kpisToRows(result.compare) },
      ],
    },
  }
}

export async function toolGetSalesKpis(args: {
  period?: string
  dateField?: 'createdAt' | 'deliveryDate'
}): Promise<ToolResult> {
  const periodKey = normalizePeriodKey(args.period, 'last_30d')
  const dateField = args.dateField === 'deliveryDate' ? 'deliveryDate' : 'createdAt'
  const period = resolvePeriod(periodKey as PeriodKey, { dateField })
  const kpis = await getSalesKpisForPeriod(period)

  return {
    answer: `${period.label}: $${kpis.revenueExGst.toLocaleString()} ex GST across ${kpis.orderCount} orders. Gross profit $${kpis.grossProfit.toLocaleString()} (${kpis.grossMarginPct}% margin).`,
    confidence: 0.9,
    evidence: {
      totals: {
        revenueExGst: kpis.revenueExGst,
        orderCount: kpis.orderCount,
        grossProfit: kpis.grossProfit,
        grossMarginPct: kpis.grossMarginPct,
      },
      tables: [{ name: period.label, rows: kpisToRows(kpis) }],
    },
  }
}
