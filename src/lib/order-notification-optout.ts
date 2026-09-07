import crypto from 'crypto'

const TOKEN_EXPIRY_DAYS = 3650 // effectively long-lived for unsubscribe links

function getSecret(): string {
  return (
    process.env.ORDER_NOTIFICATION_OPTOUT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET ||
    'dev-order-notification-secret'
  )
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

export function createOptOutToken(email: string): string {
  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    exp: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  })
  const encodedPayload = b64url(payload)
  const sig = crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${sig}`
}

export function verifyOptOutToken(token: string): { valid: boolean; email?: string; error?: string } {
  if (!token || !token.includes('.')) return { valid: false, error: 'Invalid token format' }
  const [encodedPayload, providedSig] = token.split('.')
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url')
  if (providedSig !== expectedSig) return { valid: false, error: 'Invalid signature' }

  try {
    const parsed = JSON.parse(b64urlDecode(encodedPayload)) as { email?: string; exp?: number }
    if (!parsed.email) return { valid: false, error: 'Missing email in token' }
    if (parsed.exp && Date.now() > parsed.exp) return { valid: false, error: 'Token expired' }
    return { valid: true, email: parsed.email.trim().toLowerCase() }
  } catch {
    return { valid: false, error: 'Malformed token' }
  }
}
