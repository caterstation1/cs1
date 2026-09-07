// Shared by one-off scripts and seeds. Caps Prisma's connection pool so
// ad-hoc runs against production Postgres don't open the default-sized pool
// (num_physical_cpus * 2 + 1, often ~20 connections) and exhaust client slots.
//
// CJS on purpose: consumable via require() from .js/.cjs scripts, via
// `import` from .mjs scripts (Node CJS named-export interop), and from .ts
// scripts run with tsx.

function withConnectionLimit(rawUrl, limit) {
  if (!rawUrl) return rawUrl
  try {
    const url = new URL(rawUrl)
    if (!url.searchParams.get('connection_limit')) {
      url.searchParams.set('connection_limit', String(limit))
    }
    return url.toString()
  } catch {
    return rawUrl
  }
}

// Returns PrismaClient constructor options with a capped pool (or undefined
// when DATABASE_URL is unset, falling back to PrismaClient's own env
// resolution). Call this AFTER any dotenv loading so process.env.DATABASE_URL
// is populated.
function scriptPrismaOptions(limit = 5) {
  const url = withConnectionLimit(process.env.DATABASE_URL, limit)
  return url ? { datasources: { db: { url } } } : undefined
}

module.exports = { scriptPrismaOptions, withConnectionLimit }
