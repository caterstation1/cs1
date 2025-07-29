# Migration Guide: Firestore → Prisma

## Overview
Your codebase already has a complete Prisma schema and generated client. This guide shows you how to migrate from Firestore adapters to direct Prisma usage.

## Key Differences

### 1. Database Connection
**Firestore (Current):**
```typescript
import { db } from '@/lib/firebase'
```

**Prisma (New):**
```typescript
import { prisma } from '@/lib/prisma'
```

### 2. Fetching Data

**Firestore (Current):**
```typescript
// Using adapters
const orders = await orderAdapter.findMany()
const staff = await staffAdapter.findUnique({ id: '123' })
```

**Prisma (New):**
```typescript
// Direct Prisma queries
const orders = await prisma.order.findMany({
  orderBy: { createdAt: 'desc' }
})

const staff = await prisma.staff.findUnique({
  where: { id: '123' }
})
```

### 3. Creating Data

**Firestore (Current):**
```typescript
const newOrder = await orderAdapter.create(orderData)
```

**Prisma (New):**
```typescript
const newOrder = await prisma.order.create({
  data: orderData
})
```

### 4. Updating Data

**Firestore (Current):**
```typescript
await orderAdapter.update({ id: '123' }, updates)
```

**Prisma (New):**
```typescript
await prisma.order.update({
  where: { id: '123' },
  data: updates
})
```

### 5. Complex Queries

**Firestore (Current):**
```typescript
// Limited query capabilities
const orders = await orderAdapter.findMany()
// Filter in JavaScript
const todayOrders = orders.filter(order => 
  order.deliveryDate === today
)
```

**Prisma (New):**
```typescript
// Rich query capabilities
const todayOrders = await prisma.order.findMany({
  where: {
    deliveryDate: today
  },
  include: {
    parsedOrder: true
  },
  orderBy: {
    createdAt: 'desc'
  }
})
```

## Migration Steps

### Step 1: Setup Database
```bash
# Run the setup script
node scripts/setup-prisma.mjs

# Or manually:
npx prisma generate
npx prisma db push
```

### Step 2: Update API Routes
Replace Firestore adapters with Prisma in your API routes:

**Before (Firestore):**
```typescript
import { orderAdapter } from '@/lib/firestore-adapters'

export async function GET() {
  const orders = await orderAdapter.findMany()
  return NextResponse.json(orders)
}
```

**After (Prisma):**
```typescript
import { prisma } from '@/lib/prisma'

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(orders)
}
```

### Step 3: Update Components
Replace any direct Firestore calls in components:

**Before:**
```typescript
const response = await fetch('/api/orders')
const orders = await response.json()
```

**After:**
```typescript
// Same API call, but now uses Prisma backend
const response = await fetch('/api/orders')
const orders = await response.json()
```

## Benefits of Prisma

1. **Type Safety**: Full TypeScript support with generated types
2. **Better Queries**: Rich query capabilities with relations
3. **Migrations**: Proper database schema versioning
4. **Performance**: Direct SQL queries instead of NoSQL
5. **Relationships**: Easy handling of related data
6. **Transactions**: ACID compliance for complex operations

## Common Prisma Patterns

### Fetching with Relations
```typescript
const ordersWithDetails = await prisma.order.findMany({
  include: {
    parsedOrder: {
      include: {
        lineItems: true
      }
    }
  }
})
```

### Complex Filtering
```typescript
const todayOrders = await prisma.order.findMany({
  where: {
    AND: [
      { deliveryDate: today },
      { isDispatched: false }
    ]
  }
})
```

### Transactions
```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: orderData
  })
  
  await tx.parsedOrder.create({
    data: {
      ...parsedData,
      shopifyOrderId: order.id
    }
  })
})
```

## Files to Update

### API Routes (Priority Order)
1. `/src/app/api/orders/route.ts` ✅ (Updated)
2. `/src/app/api/staff/route.ts` ✅ (Updated)
3. `/src/app/api/products/route.ts`
4. `/src/app/api/roster/route.ts`
5. `/src/app/api/timesheet/route.ts`
6. `/src/app/api/shopify/sync-orders/route.ts`
7. `/src/app/api/bidfood/route.ts`
8. `/src/app/api/gilmours/route.ts`

### Components (Low Priority)
- Most components use API routes, so they'll work automatically
- Update any direct Firestore calls in components

## Testing Your Migration

1. **Start with one route**: Update `/api/orders` first
2. **Test thoroughly**: Ensure data flows correctly
3. **Check relationships**: Verify related data works
4. **Performance test**: Compare query speeds
5. **Gradually migrate**: Update one module at a time

## Rollback Plan

If you need to rollback:
1. Keep the Firestore adapters as backup
2. Use feature flags to switch between databases
3. Maintain both implementations during transition

## Environment Variables

Make sure you have:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/caterstation"
```

## Next Steps

1. ✅ Update `src/lib/prisma.ts` (Done)
2. ✅ Update `/api/orders/route.ts` (Done)
3. ✅ Update `/api/staff/route.ts` (Done)
4. 🔄 Update remaining API routes
5. 🔄 Test thoroughly
6. 🔄 Remove Firestore dependencies
7. 🔄 Update deployment scripts