// Firestore-compatible stub to replace Prisma
// This prevents build errors while we migrate to Firestore

export const prisma = {
  // Stub methods that might be called during build
  $connect: async () => {},
  $disconnect: async () => {},
  $queryRaw: async () => [],
  $executeRaw: async () => 0,
  
  // Add any other methods that might be called
  // These will be replaced by actual Firestore adapters
} as any; 