// Edge-safe auth secret resolver (only reads env vars, no Node built-ins) so it
// can be imported from both middleware (Edge runtime) and Node route handlers.
//
// SECURITY: there is deliberately NO hardcoded production fallback. If the
// secret is missing in production we fail closed by throwing, rather than
// silently signing/verifying sessions with a publicly-known string.

let cachedSecret: string | null = null

export function getAuthSecret(): string {
  if (cachedSecret) return cachedSecret

  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
  if (secret && secret.trim().length > 0) {
    cachedSecret = secret
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXTAUTH_SECRET (or JWT_SECRET) must be set in production. Refusing to use an insecure fallback.'
    )
  }

  // Development-only value. Never reached in production because of the throw above.
  cachedSecret = 'dev-only-insecure-secret-change-me'
  return cachedSecret
}
