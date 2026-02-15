import { NextRequest, NextResponse } from 'next/server'
import { askRequestSchema } from '@/lib/ai/schemas'
import { routeQuestion } from '@/lib/ai/router'
import { getAccessLevel } from '@/lib/authz'
import { ZodError } from 'zod'

// very simple in-memory rate limiter (best-effort)
const limiter = new Map<string, { count: number; ts: number }>()
function rateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = limiter.get(key)
  if (!entry || now - entry.ts > windowMs) {
    limiter.set(key, { count: 1, ts: now })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    const access = await getAccessLevel()
    if (!access || (access !== 'owner' && access !== 'admin' && access !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const json = await req.json()
    // Validate and capture useful diagnostics without leaking PII
    const payload = askRequestSchema.parse(json)
    if (process.env.NODE_ENV !== 'production') {
      console.log('AI ask request', {
        access,
        ip,
        questionLen: (payload.question || '').length,
        includePII: Boolean((payload as any).includePII),
        aiEnabled: process.env.AI_ENABLED,
        hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
      })
    }

    const result = await routeQuestion(payload)

    return NextResponse.json(result)
  } catch (err) {
    // Handle validation errors clearly
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: err.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 }
      )
    }
    const details = err instanceof Error ? err.message : 'Unknown error'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('AI ask error', details, process.env.NODE_ENV !== 'production' ? stack : undefined)
    return NextResponse.json(
      { error: 'AI failed', details, ...(process.env.NODE_ENV !== 'production' ? { stack } : {}) },
      { status: 500 }
    )
  }
}



