import OpenAI from 'openai'
import { env } from '@/env.mjs'
import { AskRequest, ToolResult, spendByItemParams, forecastParams, allergenParams, deliveryDetailsParams, countForDateParams } from './schemas'
import { toolSpendByItem, toolForecastRequirement, toolCheckAllergen, toolOrderDeliveryDetails, toolCountForDate } from './tools'

const model = process.env.AI_MODEL || env.AI_MODEL || 'gpt-4.1-mini'

export type ToolName = 'spendByItem' | 'forecastRequirement' | 'checkAllergen' | 'orderDeliveryDetails' | 'countForDate'

export async function routeQuestion(payload: AskRequest): Promise<ToolResult> {
  // Heuristic fast-path routing to avoid tool-calling runtime issues and reduce latency for common questions.
  const q = (payload.question || '').toLowerCase()
  const orderMatch = q.match(/order\s*(#|no\.?\s*)?(\d{4,6})/)
  if (orderMatch && (q.includes('address') || q.includes('deliver'))) {
    const orderNumber = Number(orderMatch[2])
    return toolOrderDeliveryDetails({ orderNumber })
  }

  if (!env.AI_ENABLED) {
    return { answer: 'AI is currently disabled.', confidence: 0.1 }
  }
  if (!env.OPENAI_API_KEY) {
    return { answer: 'OpenAI key not configured.', confidence: 0.1 }
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })

  // Ask the model which tool to call
  const sys = [
    'You are CaterStation\'s data assistant.',
    'You must output a single valid JSON object only (no prose or markdown).',
    'Answer concisely. If the question appears to be about a specific order number, return just: {"tool":"orderDeliveryDetails","args":{"orderNumber":12345}}',
    'For spend, return: {"tool":"spendByItem","args":{"itemName":"chicken thigh"}}',
    'For forecast, return: {"tool":"forecastRequirement","args":{"product":"plates","growthPct":10}}',
    'For quantity on a specific date, return: {"tool":"countForDate","args":{"product":"gyro boxes","date":"2025-12-15"}}',
    'For allergen, return: {"tool":"checkAllergen","args":{"menuName":"pork belly slider","allergen":"gluten"}}',
    'Never attempt to write to the database.',
  ].join('\n')

  // Ask the model to output a compact routing JSON (no tool-calling API to avoid schema serialization)
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'system', content: 'Respond with a valid json object only.' },
      { role: 'user', content: payload.question },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' } as any,
  } as any)

  const content = res.choices?.[0]?.message?.content
  if (!content) return { answer: 'No answer.', confidence: 0.3 }

  let parsed: any = {}
  try { parsed = JSON.parse(content) } catch {}
  const name = parsed?.tool as ToolName
  const args = parsed?.args || {}

  switch (name) {
    case 'spendByItem':
      return toolSpendByItem(spendByItemParams.parse(args))
    case 'forecastRequirement':
      return toolForecastRequirement(forecastParams.parse(args))
    case 'countForDate':
      return toolCountForDate(countForDateParams.parse(args))
    case 'checkAllergen':
      return toolCheckAllergen(allergenParams.parse(args))
    case 'orderDeliveryDetails':
      return toolOrderDeliveryDetails(deliveryDetailsParams.parse(args))
    default:
      return { answer: 'Sorry, I could not route that question yet.', confidence: 0.2 }
  }
}


