# Order Database Structure & Calendar Parsing

## 📋 Table of Contents
1. [Technical Explanation](#technical-explanation)
2. [Lay Person Explanation](#lay-person-explanation)

---

## 🔧 Technical Explanation

### Database Schema (PostgreSQL via Prisma)

#### Order Model Structure

The `Order` model in `prisma/schema.prisma` stores order data with the following key fields:

```prisma
model Order {
  id                   String    @id @default(uuid())
  shopifyId            String    @unique
  orderNumber          Int
  createdAt            DateTime
  deliveryDate         String?   // Text field: "2025-02-16"
  deliveryTime         String?   // Text field: "14:00"
  deliveryDateResolved DateTime? @db.Date  // Computed DATE field
  deliveryDateResolvedSource DeliveryDateResolvedSource?
  
  // Customer data
  customerEmail        String
  customerFirstName    String
  customerLastName     String
  customerPhone        String?
  
  // Address data (stored as JSON)
  shippingAddress      Json?
  billingAddress       Json?
  
  // Order content (stored as JSON)
  lineItems            Json
  noteAttributes       Json?  // Array of {name, value} pairs
  note                 String?
  tags                 String?
  
  // Regional filtering
  // (No explicit region field - computed from address)
  
  // Indexes for performance
  @@index([orderNumber])
  @@index([createdAt])
  @@index([deliveryDateResolved])
}
```

**Key Technical Points:**

1. **Primary Key**: UUID string (`id`)
2. **Shopify Integration**: `shopifyId` is unique, links to Shopify order
3. **Delivery Date Fields**:
   - `deliveryDate`: String (flexible format, e.g., "2025-02-16", "July 17, 2025")
   - `deliveryDateResolved`: DateTime @db.Date (normalized DATE type for querying)
   - `deliveryDateResolvedSource`: Enum tracking where date came from (FIELD, NOTE, TAG, CREATED_AT)

4. **JSON Fields**: 
   - `shippingAddress`: Full address object
   - `lineItems`: Array of order items
   - `noteAttributes`: Array of custom attributes from Shopify

5. **Indexes**: Optimized for queries on `orderNumber`, `createdAt`, and `deliveryDateResolved`

### API Endpoint: `/api/orders`

**Location**: `src/app/api/orders/route.ts`

**GET Handler Flow:**

```typescript
1. Parse query parameters:
   - limit: Max orders to return (default: 100, calendar uses 10000)
   - offset: Pagination offset
   - deliveryDateResolved: Filter by resolved date (YYYY-MM-DD)
   - search: Text search across multiple fields

2. Build Prisma WHERE clause:
   - If deliveryDateResolved provided: Filter by date range
     (>= midnight, < next midnight to avoid UTC timezone issues)
   - If search provided: OR conditions across:
     * orderNumber (exact match)
     * customerFirstName/lastName (case-insensitive contains)
     * customerEmail (case-insensitive contains)
     * customerPhone (case-insensitive contains)
     * shopifyId (case-insensitive contains)

3. Execute Prisma query:
   - prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip })

4. Return JSON response:
   {
     orders: Order[],
     pagination: { total, limit, offset, hasMore }
   }
```

**Performance Considerations:**
- Uses database indexes for fast lookups
- Calendar page requests 10,000 orders (all orders) for client-side filtering
- No server-side region filtering (done client-side for flexibility)

### Calendar Page Data Flow

**Location**: `src/app/calendar/page.tsx`

#### Step 1: Data Fetching

```typescript
// Uses cached fetch hook
const { data: ordersData, loading, error } = useCachedFetch<Order[]>(
  '/api/orders?limit=10000',
  { key: 'orders_akl', ttl: 120000 } // 2 minute cache
)

// Extract orders array (handles both array and {orders: []} formats)
const orders = useMemo(() => {
  if (Array.isArray(ordersData)) return ordersData
  if (ordersData?.orders) return ordersData.orders
  return []
}, [ordersData])
```

#### Step 2: Regional Filtering

```typescript
// Filter to Auckland-only (exclude Wellington)
const aklOrders = useMemo(() => {
  return orders.filter((o: Order) => !isWellingtonOrder(o))
}, [orders])
```

**Regional Detection Logic** (`src/lib/region.ts`):

The `isWellingtonOrder()` function uses a priority-based approach:

1. **Explicit Attributes** (Highest Priority):
   - Check `noteAttributes` array for `{name: 'City', value: 'WLG'}`
   - Check `lineItems[].properties` for City = WLG

2. **Province/Province Code**:
   - `shippingAddress.province_code === 'WGN'` → WLG
   - `shippingAddress.province_code === 'AUK'` → AKL
   - `shippingAddress.province === 'wellington'` → WLG

3. **City Name** (Strict):
   - `city === 'wellington'` → WLG
   - `city === 'mt wellington'` or `'mount wellington'` → AKL (explicit exclusion)

4. **Postal Code Guard**:
   - ZIP codes starting with `10xx` → AKL (Auckland urban codes)

**Why Client-Side Filtering?**
- Allows dynamic switching between regions without API changes
- Handles edge cases (e.g., "Mt Wellington" in Auckland)
- More flexible for future multi-region support

#### Step 3: Delivery Date Extraction

```typescript
function getOrderDeliveryDate(order: Order): Date | null {
  // Priority 1: deliveryDate field (if present)
  if (order.deliveryDate) {
    const localDate = parseLocalDate(order.deliveryDate);
    if (localDate) return localDate;
  }
  
  // Priority 2: note_attributes array
  if (order.note_attributes?.find(a => a.name === 'Delivery Date')) {
    // Parse from attribute value
  }
  
  // Priority 3: Extract from tags (regex: "Thu Jul 17 2025")
  if (order.tags?.match(/\b\w{3,9} \d{1,2} \d{4}\b/)) {
    // Parse matched date string
  }
  
  // Priority 4: Fallback to createdAt
  if (order.createdAt) {
    return parseLocalDate(order.createdAt);
  }
  
  return null;
}
```

**Date Parsing** (`src/lib/date-utils.ts`):
- Handles multiple date formats:
  - ISO: "2025-02-16"
  - US format: "July 17, 2025"
  - Tag format: "Thu Jul 17 2025"
  - ISO datetime: "2025-02-16T14:00:00Z"
- Converts to local Auckland timezone
- Returns `Date` object or `null` if unparseable

#### Step 4: Grouping by Date

```typescript
const ordersByDate = useMemo(() => {
  const map: Record<string, Order[]> = {}
  
  for (const order of aklOrders) {
    const date = getOrderDeliveryDate(order)
    if (!date) continue  // Skip orders without valid date
    
    const key = format(date, 'yyyy-MM-dd')  // "2025-02-16"
    if (!map[key]) map[key] = []
    map[key].push(order)
  }
  
  return map  // { "2025-02-16": [order1, order2, ...], ... }
}, [aklOrders])
```

**Result Structure:**
```typescript
{
  "2025-02-16": [Order, Order, Order],
  "2025-02-17": [Order, Order],
  "2025-02-18": [Order]
}
```

#### Step 5: Calendar Display

```typescript
// Get orders for selected date
const filteredOrders = useMemo(() => {
  const key = format(selectedDate, 'yyyy-MM-dd')
  return ordersByDate[key] || []
}, [ordersByDate, selectedDate])

// Render calendar grid
calendarDays.map(day => {
  const orderCount = ordersByDate[format(day.date, 'yyyy-MM-dd')]?.length || 0
  // Display day with order count badge
})
```

### Performance Optimizations

1. **Caching**: `useCachedFetch` stores orders in localStorage (2 min TTL)
2. **Memoization**: `useMemo` prevents recalculation on every render
3. **Database Indexes**: Fast queries on `deliveryDateResolved`
4. **Client-Side Filtering**: Reduces API round-trips

### Data Flow Diagram

```
┌─────────────────┐
│  PostgreSQL DB  │
│   Order Table   │
└────────┬────────┘
         │
         │ Prisma Query
         │ (with indexes)
         ▼
┌─────────────────┐
│  /api/orders    │
│  GET Handler    │
└────────┬────────┘
         │
         │ JSON Response
         │ (up to 10,000 orders)
         ▼
┌─────────────────┐
│ useCachedFetch  │
│ (localStorage) │
└────────┬────────┘
         │
         │ Cached/New Data
         ▼
┌─────────────────┐
│ Calendar Page   │
│ Component       │
└────────┬────────┘
         │
         ├─► Regional Filter (isWellingtonOrder)
         │
         ├─► Date Extraction (getOrderDeliveryDate)
         │
         ├─► Group by Date (ordersByDate)
         │
         └─► Render Calendar Grid
```

---

## 👤 Lay Person Explanation

### What is the Database?

Think of the database like a **filing cabinet** that stores all your orders. Each order is like a **file folder** with information about:
- Who ordered (customer name, email, phone)
- Where to deliver (address)
- When to deliver (delivery date and time)
- What they ordered (list of items)
- Order number (like a reference number)

### How Orders Get Into the Database

1. **From Shopify**: When someone places an order on your website, it automatically gets saved to the database
2. **Manually Created**: You can also create orders directly in the system

### How the Calendar Works

Imagine you have a **big calendar on the wall** and you want to see which orders need to be delivered on each day.

#### Step 1: Get All Orders
- The system asks the database: "Give me all the orders"
- The database sends back up to 10,000 orders (all of them)
- The system saves a copy in your browser's memory so it doesn't have to ask again for 2 minutes

#### Step 2: Filter by Location
- The system looks at each order's address
- It checks: "Is this order going to Auckland or Wellington?"
- For the Auckland calendar, it only keeps Auckland orders
- For the Wellington calendar, it only keeps Wellington orders

**How does it know?**
- It looks at the address (city, province, postal code)
- It checks special notes on the order
- It's smart enough to know that "Mt Wellington" in Auckland is NOT Wellington!

#### Step 3: Figure Out the Delivery Date
For each order, the system tries to find the delivery date by looking in this order:

1. **First**: Check if there's a delivery date field (like "February 16, 2025")
2. **Second**: Look in special notes/attributes (sometimes the date is stored there)
3. **Third**: Check the order tags (sometimes dates are written in tags)
4. **Last Resort**: Use the date the order was created

#### Step 4: Group Orders by Date
- The system takes all the Auckland orders
- It sorts them into piles by delivery date:
  - All orders for February 16 go in one pile
  - All orders for February 17 go in another pile
  - And so on...

#### Step 5: Show on Calendar
- The calendar shows each day of the month
- On days with orders, it shows a number (like "5" means 5 orders)
- When you click a day, it shows all the orders for that day below

### Why It Can Be Slow

1. **Lots of Data**: Fetching 10,000 orders takes time (like downloading a big file)
2. **Processing**: Figuring out dates and filtering takes time (like sorting through papers)
3. **First Load**: The first time you open the calendar, there's no saved data, so it has to fetch everything

### What We Did to Make It Faster

1. **Caching**: After loading orders once, the system saves them in your browser for 2 minutes. If you switch pages and come back, it uses the saved copy instead of asking the database again.

2. **Background Loading**: The calendar shows up immediately, and orders load in the background. You can see the calendar right away, even if orders are still loading.

3. **Auto-Refresh**: Every 2 minutes, the system quietly checks for new orders in the background, so your calendar stays up-to-date.

### Real-World Analogy

Imagine you're a **delivery manager** with a big calendar:

1. **The Filing Cabinet** (Database): Contains all order forms
2. **Your Assistant** (API): Goes to the filing cabinet and brings you all the order forms
3. **Your Desk** (Browser Cache): You keep the forms on your desk for 2 minutes so you don't have to keep asking your assistant
4. **Sorting** (Filtering & Grouping): You sort the forms by:
   - Location (Auckland vs Wellington)
   - Delivery date
5. **The Calendar**: You write the number of orders on each day
6. **Clicking a Day**: You pull out all the orders for that day to see the details

The system does all of this automatically, but sometimes it takes a few seconds because there are thousands of orders to process!

---

## 🔍 Key Technical Details Summary

- **Database**: PostgreSQL with Prisma ORM
- **Order Storage**: Single `Order` table with JSON fields for flexible data
- **Date Handling**: Multiple fallback methods with timezone normalization
- **Regional Filtering**: Client-side logic with priority-based detection
- **Performance**: Caching, memoization, and database indexes
- **Data Volume**: Up to 10,000 orders fetched per calendar view
- **Cache Strategy**: localStorage with 2-minute TTL and quota management
