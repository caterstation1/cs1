-- AlterTable
ALTER TABLE "shopify_products" ADD COLUMN IF NOT EXISTS "bakery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "emailSettings" JSONB;
