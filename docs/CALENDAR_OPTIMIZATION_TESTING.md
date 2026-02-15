# Calendar Optimization - Testing Guide

## 🚀 Pre-Testing Setup

Before testing, you need to:

### 1. Run Database Migration

The new fields need to be added to the database:

```bash
npx prisma migrate deploy
```

Or if you're in development:
```bash
npx prisma migrate dev
```

This adds:
- `deliveryDateTime` (DateTime, indexed)
- `deliveryDateSource` (String)
- `needsSchedulingReview` (Boolean, indexed)
- `region` (String, indexed)
- Composite index on `[region, deliveryDateTime]`

### 2. Backfill Existing Orders

Run the backfill script to populate canonical scheduling fields for existing orders:

```bash
npm run backfill:scheduling
```

This will:
- Process all orders missing canonical fields
- Derive region (AKL/WLG/OTHER)
- Extract delivery date/time
- Mark orders needing review
- Show progress and summary

**Expected output:**
```
📊 Found X orders to process
📦 Processing batch 1...
📈 Progress: 500/X processed, 500 updated, Y need review
✅ Backfill complete!
```

### 3. Regenerate Prisma Client

After migration:

```bash
npx prisma generate
```

## ✅ Testing Checklist

### Calendar Page Load Speed

1. **Open Auckland Calendar** (`/calendar`)
   - [ ] Page loads in < 2 seconds (previously ~12 seconds)
   - [ ] Calendar grid shows immediately
   - [ ] Order counts appear on calendar days
   - [ ] No "Loading orders..." spinner for long periods

2. **Open Wellington Calendar** (`/wlg-calendar`)
   - [ ] Same performance as Auckland calendar
   - [ ] Order counts correct for Wellington region

### Calendar Functionality

3. **Calendar Navigation**
   - [ ] Clicking previous/next month loads quickly
   - [ ] Order counts update for new month
   - [ ] Can navigate 6+ months ahead and see orders
   - [ ] Can navigate to past months

4. **Day Selection**
   - [ ] Clicking a day loads orders for that day
   - [ ] Orders appear in OrderCardList
   - [ ] Loading indicator shows while fetching day orders
   - [ ] Orders load in < 1 second

5. **Order Counts**
   - [ ] Calendar shows correct order counts per day
   - [ ] Counts match actual orders when day is clicked
   - [ ] Days with 0 orders show no count badge

### Needs Review Feature

6. **Needs Review Panel**
   - [ ] "Needs Review" button appears if count > 0
   - [ ] Clicking opens dialog with orders
   - [ ] Orders show order number, customer, created date
   - [ ] "Open Order" button works
   - [ ] Empty state shows "No orders need review"

### Order Updates

7. **Order Modifications**
   - [ ] Updating an order refreshes calendar summary
   - [ ] Day orders refresh after update
   - [ ] Calendar counts update correctly
   - [ ] No need to manually refresh

8. **Creating Orders**
   - [ ] Creating new order updates calendar
   - [ ] Order appears in correct day
   - [ ] Count increments immediately

### Data Accuracy

9. **Order Placement**
   - [ ] Orders appear on correct delivery date
   - [ ] Orders 6+ months ahead appear when navigating
   - [ ] Next-day orders appear immediately
   - [ ] No orders are missing from calendar

10. **Region Filtering**
    - [ ] Auckland calendar shows only AKL orders
    - [ ] Wellington calendar shows only WLG orders
    - [ ] No cross-contamination between regions

## 🔍 Debugging

### If Calendar Shows No Orders

1. Check if migration ran: `SELECT "deliveryDateTime", "region" FROM "Order" LIMIT 1;`
2. Check if backfill ran: Look for orders with `needsSchedulingReview = true`
3. Check API endpoint: `/api/calendar/summary?region=AKL&start=2025-02-01&end=2025-02-28`
4. Check browser console for errors

### If Orders Missing

1. Check `needsSchedulingReview` count - these orders need manual review
2. Check `deliveryDateSource` - orders with `unknown` or `createdAtFallback` may need fixing
3. Verify canonicalization: Check if order has `deliveryDateTime` set

### Performance Issues

1. Check database indexes: `\d "Order"` in PostgreSQL
2. Check API response time: Network tab in browser dev tools
3. Verify caching: Summary should cache for 5 minutes

## 📊 Expected Performance

- **Initial Calendar Load**: < 2 seconds
- **Month Navigation**: < 1 second
- **Day Click (Load Orders)**: < 1 second
- **Order Update**: < 500ms refresh

## 🐛 Known Issues / Limitations

1. **First Load After Migration**: May be slower until backfill completes
2. **Needs Review Orders**: Won't appear in calendar until manually fixed
3. **Cache**: Summary cache is 5 minutes - may show stale counts briefly

## 🎯 Success Criteria

✅ Calendar loads in < 2 seconds  
✅ All orders visible (including 6+ months ahead)  
✅ No missing orders  
✅ Needs Review panel works  
✅ Both AKL and WLG calendars optimized  
