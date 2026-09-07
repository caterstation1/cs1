import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { ToolResult, AllergenKey, ALLERGEN_VALUES, AskRequest } from './schemas'
import { SCHEMA_CATALOG, redactPii } from './schema-catalog'
import { enforceLimit, normalizeSql, serializeRows, validateReadOnlySql } from './sql-guard'
import { routeToTool, RoutedTool } from './router-llm'
import { toolSearchPeople } from './tools/search-people'
import { toolLookupOrder } from './tools/lookup-order'
import { toolCheckAllergen, toolPrintLabels, toolProposeOrderUpdate } from './tools/order-tools'
import { toolCompareSalesPeriods, toolGetSalesKpis } from './tools/analytics-tools'
import { toolOrdersForDay } from './tools/calendar-tools'
import { toolStaffOnShift, toolFcpTasksToday } from './tools/operations-tools'
import { logAiQuery } from './query-log'
import { env } from '@/env.mjs'

const model = process.env.AI_MODEL || env.AI_MODEL || 'gpt-4.1-mini'

function getClient(): OpenAI | null {
  if (!env.AI_ENABLED || !env.OPENAI_API_KEY) return null
  return new OpenAI({ apiKey: env.OPENAI_API_KEY })
}

async function executeSql(sql: string, includePII: boolean, limit = 10): Promise<ToolResult> {
  const normalized = normalizeSql(sql)
  const validation = validateReadOnlySql(normalized)
  if (!validation.ok) {
    return { answer: `Query blocked: ${validation.error}`, confidence: 0.2 }
  }

  const safeSql = enforceLimit(normalized, limit)
  try {
    const result = await prisma.$queryRawUnsafe(safeSql)
    const rows = serializeRows(Array.isArray(result) ? result : [result]) as Record<string, unknown>[]
    const displayRows = redactPii(rows, includePII)

    if (rows.length === 0) {
      return {
        answer: 'No matching records found.',
        confidence: 0.4,
        evidence: { sql: safeSql },
      }
    }

    return {
      answer: `Found ${rows.length} result${rows.length === 1 ? '' : 's'}. See details below.`,
      confidence: 0.75,
      evidence: {
        sql: safeSql,
        tables: [{ name: 'Query results', rows: displayRows }],
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed'
    return { answer: `Query failed: ${message}`, confidence: 0.2, evidence: { sql: safeSql } }
  }
}

async function planSql(client: OpenAI, question: string, includePII: boolean, priorError?: string): Promise<string | null> {
  const res = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: [
          'Write ONE read-only PostgreSQL SELECT. JSON: { "sql": "..." }',
          'No semicolons. LIMIT 10. Quote PascalCase tables.',
          'Orders table is "Order" with columns "orderNumber", "totalPrice", "createdAt", "deliveryDate".',
          includePII ? 'Include phone/email when relevant.' : 'Omit phone/email columns.',
          priorError ? `Previous error: ${priorError}. Simplify or use correct table names.` : '',
          `Schema:\n${SCHEMA_CATALOG}`,
        ].join('\n'),
      },
      { role: 'user', content: question },
    ],
    temperature: 0,
    response_format: { type: 'json_object' } as any,
  } as any)

  const content = res.choices?.[0]?.message?.content
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as { sql?: string }
    return parsed.sql ? normalizeSql(parsed.sql) : null
  } catch {
    return null
  }
}

async function runSqlWithRetry(client: OpenAI, question: string, includePII: boolean): Promise<ToolResult> {
  let sql = await planSql(client, question, includePII)
  if (!sql) {
    return {
      answer: 'I couldn\'t find a typed tool or safe query for that question. Try rephrasing, or ask about orders, people, sales, deliveries, or allergens.',
      confidence: 0.2,
    }
  }

  let result = await executeSql(sql, includePII)
  if (result.answer.startsWith('Query failed') || result.answer.startsWith('Query blocked')) {
    const retrySql = await planSql(client, question, includePII, result.answer)
    if (retrySql) {
      sql = retrySql
      result = await executeSql(retrySql, includePII)
    }
  }
  return result
}

/** If SQL failed on a sales-like question, retry with typed analytics tools. */
function isSalesLikeQuestion(q: string): boolean {
  return /\b(sales|revenue|profit|margin|cogs|turnover|compared|vs|week|month|ytd)\b/i.test(q)
}

async function retrySalesFallback(question: string): Promise<ToolResult | null> {
  if (!isSalesLikeQuestion(question)) return null
  const compareLike = /\b(compare|compared|vs|versus|up|down|last week|prior)\b/i.test(question)
  if (compareLike) {
    return toolCompareSalesPeriods({ currentPeriod: 'this_week_wtd', comparePeriod: 'last_week_same_days' })
  }
  if (/\btoday\b/i.test(question)) {
    return toolGetSalesKpis({ period: 'today' })
  }
  if (/\b(30\s*days?|month)\b/i.test(question)) {
    return toolGetSalesKpis({ period: 'last_30d' })
  }
  return toolGetSalesKpis({ period: 'this_week_wtd' })
}

export async function executeRoutedTool(
  routed: RoutedTool,
  question: string,
  includePII: boolean,
  actorEmail?: string | null,
  client?: OpenAI | null,
): Promise<ToolResult> {
  switch (routed.tool) {
    case 'search_people':
      return toolSearchPeople(String(routed.args.query || question), includePII)
    case 'lookup_order':
      return toolLookupOrder(Number(routed.args.orderNumber), includePII)
    case 'check_allergen': {
      const raw = String(routed.args.allergen || 'gluten').toLowerCase()
      const allergen = (ALLERGEN_VALUES.includes(raw as AllergenKey) ? raw : 'gluten') as AllergenKey
      return toolCheckAllergen(String(routed.args.product || ''), allergen)
    }
    case 'print_labels':
      return toolPrintLabels(Number(routed.args.orderNumber))
    case 'propose_order_update':
      return toolProposeOrderUpdate(
        Number(routed.args.orderNumber),
        {
          deliveryTime: routed.args.deliveryTime as string | undefined,
          deliveryDate: routed.args.deliveryDate as string | undefined,
          internalNote: routed.args.internalNote as string | undefined,
        },
        actorEmail,
      )
    case 'compare_sales_periods':
      return toolCompareSalesPeriods({
        currentPeriod: routed.args.currentPeriod as string | undefined,
        comparePeriod: routed.args.comparePeriod as string | undefined,
        dateField: routed.args.dateField as 'createdAt' | 'deliveryDate' | undefined,
      })
    case 'get_sales_kpis':
      return toolGetSalesKpis({
        period: routed.args.period as string | undefined,
        dateField: routed.args.dateField as 'createdAt' | 'deliveryDate' | undefined,
      })
    case 'orders_for_day':
      return toolOrdersForDay({
        date: routed.args.date as string | undefined,
        region: routed.args.region as string | undefined,
      })
    case 'staff_on_shift':
      return toolStaffOnShift()
    case 'fcp_tasks_today':
      return toolFcpTasksToday()
    case 'sql_query':
      if (routed.args.sql) {
        const sqlResult = await executeSql(String(routed.args.sql), includePII)
        if (sqlResult.confidence < 0.3) {
          const fallback = await retrySalesFallback(question)
          if (fallback) return fallback
        }
        return sqlResult
      }
      if (client) {
        const sqlResult = await runSqlWithRetry(client, question, includePII)
        if (sqlResult.confidence < 0.3 || sqlResult.answer.startsWith('Query failed')) {
          const fallback = await retrySalesFallback(question)
          if (fallback) return fallback
        }
        return sqlResult
      }
      return { answer: 'SQL query could not be run.', confidence: 0.2 }
    default:
      return { answer: 'Unknown tool.', confidence: 0.1 }
  }
}

function isSuccess(result: ToolResult): boolean {
  return result.confidence >= 0.4 &&
    !result.answer.startsWith('Query failed') &&
    !result.answer.startsWith('Query blocked') &&
    !result.answer.startsWith('Unknown tool') &&
    !result.answer.includes('could not be run')
}

export async function askQuestion(payload: AskRequest, actorEmail?: string | null): Promise<ToolResult> {
  const client = getClient()
  if (!client) {
    if (!env.AI_ENABLED) return { answer: 'AI is currently disabled.', confidence: 0.1 }
    return { answer: 'OpenAI key not configured.', confidence: 0.1 }
  }

  const question = payload.question.trim()
  const includePII = Boolean(payload.includePII)

  const routed = await routeToTool(client, question)
  let result: ToolResult

  if (routed) {
    result = await executeRoutedTool(routed, question, includePII, actorEmail, client)
  } else {
    result = await runSqlWithRetry(client, question, includePII)
    if (!isSuccess(result)) {
      const fallback = await retrySalesFallback(question)
      if (fallback) result = fallback
    }
  }

  logAiQuery({
    question,
    tool: routed?.tool ?? (result.evidence?.sql ? 'sql_query' : null),
    confidence: result.confidence,
    success: isSuccess(result),
    errorHint: isSuccess(result) ? undefined : result.answer.slice(0, 200),
  })

  return result
}
