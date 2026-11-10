-- Lets a variant override the SKU-derived addon/product split on the order card.
-- Null keeps the existing SKU-prefix derivation.
ALTER TABLE "product_variants" ADD COLUMN "lineKind" TEXT;
