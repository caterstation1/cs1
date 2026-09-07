/** Best-effort in-memory log of AI queries for gap analysis (dev / ops). */

export type AiQueryLogEntry = {
  ts: number
  question: string
  tool: string | null
  confidence: number
  success: boolean
  errorHint?: string
}

const MAX_ENTRIES = 200
const recent: AiQueryLogEntry[] = []

export function logAiQuery(entry: Omit<AiQueryLogEntry, 'ts'>): void {
  recent.unshift({ ...entry, ts: Date.now() })
  if (recent.length > MAX_ENTRIES) recent.pop()

  const level = entry.success ? 'info' : 'warn'
  const payload = {
    tool: entry.tool,
    confidence: entry.confidence,
    success: entry.success,
    questionLen: entry.question.length,
    ...(entry.errorHint ? { errorHint: entry.errorHint } : {}),
  }
  if (level === 'warn') {
    console.warn('[Ask AI]', payload)
  } else if (process.env.NODE_ENV !== 'production') {
    console.log('[Ask AI]', payload)
  }
}

export function getRecentAiQueries(limit = 50): AiQueryLogEntry[] {
  return recent.slice(0, limit)
}
