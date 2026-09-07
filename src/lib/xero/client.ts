import { XeroClient as XeroClientSDK } from 'xero-node'
import { env } from '@/env.mjs'

const PAYROLL_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'payroll.employees',
  'payroll.payruns',
  'payroll.settings',
  'payroll.timesheets',
].join(' ')

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

export function resolveXeroRedirectUri(originOverride?: string): string | null {
  const fromOrigin = originOverride ? `${normalizeOrigin(originOverride)}/api/xero/callback` : null
  if (fromOrigin) return fromOrigin
  if (env.XERO_REDIRECT_URI) return env.XERO_REDIRECT_URI
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/xero/callback`
  return null
}

export function getXeroClient(originOverride?: string): XeroClientSDK | null {
  const clientId = env.XERO_CLIENT_ID
  const clientSecret = env.XERO_CLIENT_SECRET
  const redirectUri = resolveXeroRedirectUri(originOverride)
  if (!clientId || !clientSecret || !redirectUri) return null

  return new XeroClientSDK({
    clientId,
    clientSecret,
    redirectUris: [redirectUri],
    scopes: PAYROLL_SCOPES.split(' '),
  })
}

export function isXeroConfigured(): boolean {
  return !!(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && resolveXeroRedirectUri())
}
