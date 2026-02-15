# Manual Date Change Safety

## ✅ Your Manual Date Changes Are Safe

### How It Works

1. **Manual Date Changes Are Stored in `deliveryDate`**
   - When you manually change a delivery date, it's saved in the `deliveryDate` field
   - This is the source of truth for manual edits

2. **`deliveryDateTime` is Calculated from `deliveryDate`**
   - The `deliveryDateTime` field is automatically calculated from `deliveryDate`
   - When you update `deliveryDate`, the system recalculates `deliveryDateTime` from it
   - So your manual changes are preserved and used correctly

3. **Backfill Only Updates NULL Fields**
   - The backfill script checks: `if (order.deliveryDateTime === null)`
   - If `deliveryDateTime` already exists (from a manual edit), it's **NOT touched**
   - Only orders with NULL `deliveryDateTime` get populated

### Example Flow

**Scenario: You manually change an order's delivery date**

1. You update order #1234: change `deliveryDate` to "2025-02-20"
2. System automatically:
   - Saves `deliveryDate = "2025-02-20"` ✅
   - Calculates `deliveryDateTime` from "2025-02-20" ✅
   - Sets `deliveryDateSource = "field"` ✅
3. Backfill runs later:
   - Checks: `order.deliveryDateTime === null?` → **NO** (it's already set)
   - **Skips this order** - doesn't touch it ✅

**Result: Your manual change is preserved!**

### Database Fields

- `deliveryDate` (string) - Original/manual date (e.g., "2025-02-20")
- `deliveryDateTime` (DateTime) - Calculated canonical datetime for calendar
- `deliveryDateSource` (string) - Where it came from: "field", "noteAttributes", "tags", etc.

### Update Endpoint Behavior

When you update an order via PUT/PATCH:
```typescript
// Takes your manual deliveryDate
deliveryDate: body.deliveryDate ?? existing?.deliveryDate

// Recalculates deliveryDateTime from your deliveryDate
const scheduling = canonicalizeOrderScheduling({
  deliveryDate: body.deliveryDate, // Your manual change
  ...
})
// Updates deliveryDateTime based on your deliveryDate
deliveryDateTime: scheduling.deliveryDateTime
```

**So manual edits are always preserved and used correctly!**
