# How to Run the Backfill

## What is the Backfill?

The backfill script populates the new canonical scheduling fields (`deliveryDateTime`, `region`, `deliveryDateSource`, `needsSchedulingReview`) for existing orders in your database. 

**Important**: New orders automatically get these fields when created, so they work fine. The backfill is only needed for existing orders.

## Will New Orders Show?

**YES!** ✅ 

New orders will show correctly in the reverted calendar because:
- New orders automatically get canonical fields when created (via the sync endpoints)
- The reverted calendar uses the old `/api/orders` endpoint which works with or without canonical fields
- So new orders will appear immediately, regardless of whether backfill has run

## How to Run the Backfill

### Option 1: Using npx (Recommended - No Installation Needed)

```bash
npm run backfill:scheduling
```

This will automatically download `tsx` temporarily and run the script.

### Option 2: Install tsx First, Then Run

```bash
# Install tsx as a dev dependency
npm install --save-dev tsx

# Run the backfill
npm run backfill:scheduling
```

### Option 3: Direct TypeScript Execution

If you have tsx installed globally:
```bash
tsx scripts/backfill-order-scheduling.ts
```

## What the Backfill Does

1. **Finds orders** missing canonical fields:
   - `deliveryDateTime` is NULL
   - `region` is NULL  
   - `deliveryDateSource` is NULL

2. **Processes in batches** of 500 orders at a time

3. **Applies canonicalization logic**:
   - Derives region (AKL/WLG/OTHER) from shipping address
   - Extracts delivery date/time from various sources (deliveryDate field, noteAttributes, tags, etc.)
   - Marks orders as needing review if date can't be confidently extracted

4. **Only updates missing fields** - won't overwrite existing good values

5. **Shows progress** every 1000 orders

## Expected Output

```
🔄 Starting backfill of order scheduling fields...
📊 Found 1234 orders to process
📦 Processing batch 1 (500 orders)...
📈 Progress: 1000/1234 processed, 1000 updated, 45 need review
📦 Processing batch 2 (500 orders)...
📦 Processing batch 3 (234 orders)...

✅ Backfill complete!
📊 Summary:
   - Total processed: 1234
   - Updated: 1234
   - Need review: 45
   - Errors: 0
```

## After Running Backfill

Once the backfill completes:
- All existing orders will have canonical fields
- You can then re-enable the optimized calendar (using summary API)
- Calendar will load much faster (< 2 seconds instead of ~12 seconds)

## Troubleshooting

### Error: "tsx: command not found"
- Use Option 1 (npx) - it will download tsx automatically
- Or install tsx: `npm install --save-dev tsx`

### Error: "Cannot find module"
- Make sure you're in the project root directory
- Run `npm install` to ensure dependencies are installed
- Run `npx prisma generate` to ensure Prisma client is generated

### Script Takes Too Long
- This is normal for large databases
- The script processes 500 orders at a time
- Progress updates every 1000 orders
- You can stop and restart - it will continue from where it left off (only processes NULL fields)

## Safety

✅ **Safe to run multiple times** - only updates NULL fields  
✅ **Won't overwrite existing data** - only fills in missing values  
✅ **Can be stopped and restarted** - processes in batches  
✅ **No data loss** - only adds new fields, doesn't modify existing ones
