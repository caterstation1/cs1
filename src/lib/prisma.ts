import { PrismaClient } from '../generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Add a retry wrapper for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
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
      
      // Check if it's a connection error that we should retry
      const errorMessage = lastError.message.toLowerCase()
      const isConnectionError = errorMessage.includes('connection') || 
                              errorMessage.includes('timeout') ||
                              errorMessage.includes('network')
      
      if (isConnectionError) {
        console.log(`🔄 Database connection failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        delayMs *= 2 // Exponential backoff
      } else {
        // If it's not a connection error, don't retry
        throw lastError
      }
    }
  }
  
  throw lastError
} 