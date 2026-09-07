/** Compact schema reference for the AI query planner. PostgreSQL, public schema. */
export const SCHEMA_CATALOG = `
CaterStation database (PostgreSQL). Use double-quoted identifiers for PascalCase tables/columns.
IMPORTANT: Shopify orders table is "Order" (quoted, singular) — NOT orders, NOT order.

## Orders
Table: "Order"
Key columns: id, "orderNumber" (int, indexed), "createdAt", "deliveryDate", "deliveryTime",
  "deliveryDateTime", "deliveryDateResolved" (date), "pickupDate", "pickupTime",
  "financialStatus", "fulfillmentStatus", region (AKL|WLG|OTHER),
  "customerFirstName", "customerLastName", "customerEmail", "customerPhone" (PII),
  "shippingAddress" (jsonb), "lineItems" (jsonb array: title, quantity, variant_id, sku),
  "driverId", "carId", "isDispatched", "totalPrice", tags, note

## Staff
Table: "Staff"
Key columns: id, "firstName", "lastName", phone (PII), email (PII), "accessLevel",
  "isDriver", "isActive", "payRate", "payMode"

## Menu products (Shopify)
Table: shopify_products
Key columns: id, "shopifyProductId", "productTitle", "displayName", "baseIngredients" (jsonb),
  "dietaryMarker", bakery, "isActive"

Table: product_variants
Key columns: id, "productId" (FK shopify_products), "variantId", "shopifySku",
  "shopifyName", "shopifyTitle", "displayName", ingredients (jsonb), "totalCost"

Ingredient jsonb shape: [{ "name": "...", "source": "Components"|"Other"|"Bidfood", "id": "...", "quantity": N }]

## Components (recipes / prep items)
Table: "Component"
Key columns: id, name (unique), description, ingredients (jsonb), "totalCost",
  "hasGluten", "hasDairy", "hasSoy", "hasOnionGarlic", "hasSesame", "hasNuts", "hasEgg",
  "isVegetarian", "isVegan", "isHalal", "prepCategory", "prepCategories" (jsonb)

## Other / preferred supplier products
Table: "OtherProduct"
Key columns: id, name, supplier, "preferredAllergens" (text[]), "listOnLabel",
  "isVegetarian", "isVegan", "isHalal", cost

## Stock purchasing
Table: "StockOrder" — id, "createdAt", supplier fields
Table: "StockOrderItem" — "orderId", "nameSnapshot", "descriptionSnapshot", "sku", qty, "unitPriceExGst", "lineTotalExGst"

## Companies / CRM
Table: companies — id, name, domain, region, lifecycle fields
Table: company_contacts — companyId, email, name, phone (PII)
Table: company_orders — links orders to companies

## Suppliers
Table: "Supplier" — id, name, email, phone, "mpiNumber", "accountNumber"

## Vehicles
Table: "Car" — id, name, registration, "isActive"

## Shifts / roster
Table: "Shift" — staffId, "clockIn", "clockOut", date, status, approved
Table: "RosterAssignment" — staffId, date, shiftTypeId

## Tips
- Search names with ILIKE '%term%'
- Order numbers: WHERE "orderNumber" = 12375
- Staff by name: WHERE "firstName" ILIKE '%john%' OR "lastName" ILIKE '%smith%'
- Allergen on component: check "hasGluten" etc. on "Component"
- For menu item allergens: join product_variants → expand ingredients jsonb → join "Component" or "OtherProduct"
- lineItems in orders: CROSS JOIN LATERAL jsonb_array_elements("lineItems"::jsonb) li, use li->>'title', (li->>'quantity')::numeric
- Always use LIMIT (max 50)
`.trim()

export const PII_FIELD_PATTERN =
  /^(phone|email|customerEmail|customerPhone|password|resetToken|addressLine1|recipientEmail|senderEmail)$/i

export function redactPii(rows: Record<string, unknown>[], includePII: boolean): Record<string, unknown>[] {
  if (includePII) return rows
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row }
    for (const key of Object.keys(out)) {
      if (PII_FIELD_PATTERN.test(key) || /email|phone/i.test(key)) {
        out[key] = '[hidden — enable Include PII]'
      }
      if (key === 'shippingAddress' || key === 'billingAddress') {
        out[key] = '[hidden — enable Include PII]'
      }
    }
    return out
  })
}
