const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'GRANT', 'REVOKE', 'EXECUTE', 'EXEC', 'COPY', 'VACUUM', 'REINDEX',
  'CALL', 'DO', 'LOCK', 'UNLOCK',
]

/** Strip trailing semicolon; reject only if semicolons remain (multiple statements). */
export function normalizeSql(query: string): string {
  let trimmed = query.trim()
  while (trimmed.endsWith(';')) {
    trimmed = trimmed.slice(0, -1).trim()
  }
  return trimmed
}

export function validateReadOnlySql(query: string): { ok: true } | { ok: false; error: string } {
  if (!query || typeof query !== 'string') {
    return { ok: false, error: 'Query must be a non-empty string' }
  }

  const trimmed = normalizeSql(query)
  if (trimmed.length > 8000) {
    return { ok: false, error: 'Query is too long' }
  }

  if (trimmed.includes(';')) {
    return { ok: false, error: 'Multiple statements are not allowed' }
  }

  if (/--|\/\*/.test(trimmed)) {
    return { ok: false, error: 'SQL comments are not allowed' }
  }

  const upper = trimmed.toUpperCase()
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return { ok: false, error: 'Only SELECT queries are allowed' }
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`).test(upper)) {
      return { ok: false, error: `Forbidden keyword: ${keyword}` }
    }
  }

  return { ok: true }
}

export function enforceLimit(query: string, max = 50): string {
  const normalized = normalizeSql(query)
  const upper = normalized.toUpperCase()
  if (/\bLIMIT\s+\d+/i.test(upper)) return normalized
  return `${normalized} LIMIT ${max}`
}

export function serializeRows(rows: unknown[]): unknown[] {
  return JSON.parse(
    JSON.stringify(rows, (_key, value) => {
      if (typeof value === 'bigint') return value.toString()
      if (value instanceof Date) return value.toISOString()
      return value
    }),
  )
}
