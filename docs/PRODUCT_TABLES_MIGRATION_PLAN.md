# Product Tables Migration Plan

## Problem Summary

You have **two overlapping database tables** storing product variant data:

1. **`ProductWithCustomData`** (mapped to `product_with_custom_data`) - **OLD/LEGACY**
2. **`ProductVariant`** (mapped to `product_variants`) - **NEW** (part of `ShopifyProduct` architecture)

Both tables store similar data (variantId, displayName, meat1, meat2, timer1/timer2, option1/option2, serveware, ingredients, totalCost, etc.), but they're being used inconsistently across the codebase, causing:

- **Edits saving to one table but not the other**
- **Code reading from different tables in different places**
- **Data inconsistency and confusion**

## Current State Analysis

### ✅ **Correctly Using ProductVariant (NEW table):**
- `/api/products/variant/[variantId]/route.ts` - Main variant CRUD (reads/writes ProductVariant)
- `/api/shopify/products/route.ts` - Shopify sync creates/updates ProductVariant
- `/api/shopify/products/custom-data/route.ts` - Updates ProductVariant
- `/api/products/route.ts` - Main products endpoint (reads ProductVariant, with fallback to legacy)
- Most new/modern code

### ⚠️ **Still Using ProductWithCustomData (OLD table):**
- `/api/cron/wlg-outlook/route.ts` - **READS** ProductWithCustomData directly
- `/api/test-wlg-email/route.ts` - **READS** ProductWithCustomData directly
- `/api/labels/route.ts` - **READS** ProductWithCustomData directly
- `/api/shopify/products/fix-titles/route.ts` - **READS & WRITES** ProductWithCustomData
- `/api/product-rules/[id]/reverse/route.ts` - **READS & WRITES** ProductWithCustomData
- `/lib/product-rules-engine.ts` - **READS & WRITES** ProductWithCustomData (used by product rules)
- `/api/test-populate-products/route.ts` - Test file (creates ProductWithCustomData)

### 🔄 **Using Both (Fallback Pattern):**
- `/api/products/route.ts` - Reads ProductVariant, falls back to ProductWithCustomData for ingredients/totalCost
- `/api/products/variant/[variantId]/route.ts` - Reads ProductVariant, falls back to ProductWithCustomData
- `/api/dashboard/route.ts` - Reads ProductVariant, falls back to ProductWithCustomData
- `/api/dashboard/series/route.ts` - Reads ProductVariant, falls back to ProductWithCustomData
- `/api/dashboard/cost-breakdown/route.ts` - Reads ProductVariant, falls back to ProductWithCustomData
- `/lib/accounting.ts` - Reads ProductVariant, falls back to ProductWithCustomData
- `/lib/runsheet-data.ts` - Reads ProductVariant, falls back to ProductWithCustomData

## Solution: Complete Migration to ProductVariant

### Phase 1: Data Migration Script
Create a script to migrate all data from `ProductWithCustomData` to `ProductVariant`:

1. For each record in `ProductWithCustomData`:
   - Find matching `ProductVariant` by `variantId`
   - If variant exists: Merge data (prefer ProductVariant if both have values)
   - If variant doesn't exist: Log warning (orphaned legacy data)
   - Update ProductVariant with merged data

2. Handle conflicts:
   - If ProductVariant has data, keep it (it's newer)
   - If only ProductWithCustomData has data, copy it to ProductVariant
   - If both have data, prefer ProductVariant (newer architecture)

### Phase 2: Update All Code to Use ProductVariant Only

**Files to update:**

1. **`/api/cron/wlg-outlook/route.ts`**
   - Change `prisma.productWithCustomData.findMany` → `prisma.productVariant.findMany`
   - Update field mappings (shopifySku → shopifySku, etc.)

2. **`/api/test-wlg-email/route.ts`**
   - Change `prisma.productWithCustomData.findMany` → `prisma.productVariant.findMany`
   - Update field mappings

3. **`/api/labels/route.ts`**
   - Change `prisma.productWithCustomData.findUnique` → `prisma.productVariant.findUnique`
   - Update to use `variantId` lookup

4. **`/api/shopify/products/fix-titles/route.ts`**
   - Change all `productWithCustomData` operations → `productVariant`
   - Update field mappings

5. **`/api/product-rules/[id]/reverse/route.ts`**
   - Change all `productWithCustomData` operations → `productVariant`
   - Update field mappings

6. **`/lib/product-rules-engine.ts`**
   - Change `prisma.productWithCustomData.findMany` → `prisma.productVariant.findMany`
   - Change `prisma.productWithCustomData.update` → `prisma.productVariant.update`
   - Update field mappings (shopifyName → shopifyName, shopifyTitle → shopifyTitle)

7. **Remove fallback patterns:**
   - Remove all `productWithCustomData` fallback reads from:
     - `/api/products/route.ts`
     - `/api/products/variant/[variantId]/route.ts`
     - `/api/dashboard/route.ts`
     - `/api/dashboard/series/route.ts`
     - `/api/dashboard/cost-breakdown/route.ts`
     - `/lib/accounting.ts`
     - `/lib/runsheet-data.ts`

### Phase 3: Schema Cleanup

1. **Mark ProductWithCustomData as deprecated** in schema (add comment)
2. **Keep table for now** (don't delete immediately - safety net)
3. **Monitor for 1-2 weeks** to ensure no issues
4. **Remove table** after confirmation (optional - can keep as archive)

## Field Mapping Reference

| ProductWithCustomData (OLD) | ProductVariant (NEW) |
|----------------------------|----------------------|
| `variantId` | `variantId` (same) |
| `displayName` | `displayName` (same) |
| `meat1` | `meat1` (same) |
| `meat2` | `meat2` (same) |
| `timer1` | `timer1` (same) |
| `timer2` | `timer2` (same) |
| `option1` | `option1` (same) |
| `option2` | `option2` (same) |
| `serveware` | `serveware` (same) |
| `ingredients` | `ingredients` (same) |
| `totalCost` | `totalCost` (same) |
| `shopifySku` | `shopifySku` (same) |
| `shopifyName` | `shopifyName` (same) |
| `shopifyTitle` | `shopifyTitle` (same) |
| `shopifyPrice` | `shopifyPrice` (same) |
| `shopifyInventory` | `shopifyInventory` (same) |
| `isDraft` | `isDraft` (same) |
| `heroImageUrl` | (in parent `ShopifyProduct`) |
| `shopifyVendor` | (in parent `ShopifyProduct`) |
| `shopifyMarket` | (in parent `ShopifyProduct`) |

**Note:** ProductVariant has additional fields not in ProductWithCustomData:
- `meats` (Json array - preferred over meat1/meat2)
- `timers` (Json array - preferred over timer1/timer2)
- `options` (Json array - preferred over option1/option2)
- `isPartyPack`, `bundleItems` (party pack support)
- Relationship to `ShopifyProduct` parent

## Implementation Steps

1. ✅ Create migration script
2. ✅ Run migration script (test in dev first)
3. ✅ Update all code files to use ProductVariant only
4. ✅ Remove fallback patterns
5. ✅ Test thoroughly
6. ✅ Deploy to production
7. ⏳ Monitor for issues
8. ⏳ Remove ProductWithCustomData table (optional, after monitoring)

## Risk Assessment

**Low Risk:**
- Migration script can be run multiple times (idempotent)
- ProductVariant is already the primary table for new operations
- Fallback patterns provide safety net during transition

**Medium Risk:**
- Some legacy code paths might break if migration incomplete
- Need to ensure all variantIds match between tables

**Mitigation:**
- Keep ProductWithCustomData table for 1-2 weeks after migration
- Add logging to track any remaining reads from ProductWithCustomData
- Test thoroughly in dev/staging before production
