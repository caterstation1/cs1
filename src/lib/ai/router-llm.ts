import OpenAI from 'openai'
import { env } from '@/env.mjs'
import { AiToolName, buildToolRegistryPrompt, ROUTER_RULES } from './capabilities'

const model = process.env.AI_MODEL || env.AI_MODEL || 'gpt-4.1-mini'

const ROUTER_SYSTEM = [
  'You are CaterStation\'s AI router. Interpret the user question and pick the best tool.',
  'Output JSON only: { "tool": "<name>", "args": { ... } }',
  '',
  'Rules:',
  ROUTER_RULES,
  '',
  buildToolRegistryPrompt(),
].join('\n')

export type RoutedTool = {
  tool: AiToolName
  args: Record<string, unknown>
}

export async function routeToTool(client: OpenAI, question: string): Promise<RoutedTool | null> {
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: ROUTER_SYSTEM },
      { role: 'system', content: 'Respond with valid json only.' },
      { role: 'user', content: question },
    ],
    temperature: 0,
    response_format: { type: 'json_object' } as any,
  } as any)

  const content = res.choices?.[0]?.message?.content
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as { tool?: string; args?: Record<string, unknown> }
    if (!parsed.tool || !parsed.args) return null
    return { tool: parsed.tool as AiToolName, args: parsed.args }
  } catch {
    return null
  }
}
