import { PrismaClient } from '../generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function withPrismaConnectionGuards(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl
  try {
    const url = new URL(rawUrl)
    // Keep per-runtime pool small to avoid exhausting Postgres client slots
    // under high serverless concurrency.
    if (!url.searchParams.get('connection_limit')) url.searchParams.set('connection_limit', '2')
    if (!url.searchParams.get('pool_timeout')) url.searchParams.set('pool_timeout', '20')
    if (!url.searchParams.get('connect_timeout')) url.searchParams.set('connect_timeout', '15')
    return url.toString()
  } catch {
    return rawUrl
  }
}

const prismaDatasourceUrl = withPrismaConnectionGuards(process.env.DATABASE_URL)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(prismaDatasourceUrl
      ? {
          datasources: {
            db: {
              url: prismaDatasourceUrl,
            },
          },
        }
      : {}),
  })

// Reuse the same Prisma client in every environment to reduce connection churn
// across warm serverless/runtime instances.
globalForPrisma.prisma = prisma

// Add a retry wrapper for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError
      }
      
      const errorMessage = lastError.message.toLowerCase()
      const isConnectionError =
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('prisma')
      const isConnectionSaturation =
        errorMessage.includes('too many clients') ||
        errorMessage.includes('too many connections') ||
        errorMessage.includes('remaining connection slots are reserved') ||
        errorMessage.includes('p2037') ||
        errorMessage.includes('p2024')
      
      // Avoid retry storms when the DB is already saturated.
      if (isConnectionSaturation) {
        throw lastError
      }

      if (isConnectionError) {
        const jitterMs = Math.floor(Math.random() * 250)
        const waitMs = delayMs + jitterMs
        console.log(`🔄 Database connection failed (attempt ${attempt}/${maxRetries}), retrying in ${waitMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitMs))
        delayMs = Math.min(delayMs * 2, 8000) // Exponential backoff with cap
      } else {
        // If it's not a connection error, don't retry
        throw lastError
      }
    }
  }
  
  throw lastError
} 