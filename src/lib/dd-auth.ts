import crypto from 'crypto'
import { env } from '@/env.mjs'

const SECRET = env.DD_JWT_SECRET || 'insecure-dev-secret'

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function signDriverToken(driverId: string, ttlSeconds = 3600): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ sub: driverId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }))
  const data = `${header}.${payload}`
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${data}.${sig}`
}

export function verifyDriverToken(token: string): { valid: boolean; driverId?: string } {
  try {
    const [headerB64, payloadB64, sig] = token.split('.')
    if (!headerB64 || !payloadB64 || !sig) return { valid: false }
    const data = `${headerB64}.${payloadB64}`
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    if (expected !== sig) return { valid: false }
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return { valid: false }
    const driverId = payload.sub as string
    if (!driverId) return { valid: false }
    return { valid: true, driverId }
  } catch {
    return { valid: false }
  }
}

