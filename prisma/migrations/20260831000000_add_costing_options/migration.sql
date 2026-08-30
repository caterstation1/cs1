-- Cost the option, not the variant.
--
-- A variant's recipe was stored as a flat bag on each of ~1,300 variants and
-- kept in sync by substring-matching rules. The same ~99 choices underlie all
-- of them, so they are costed once here and summed per variant instead.

ALTER TABLE "shopify_products" ADD COLUMN "portionSize" DOUBLE PRECISION NOT NULL DEFAULT 1;

CREATE TABLE "CostingOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'choice',
    "items" JSONB NOT NULL DEFAULT '[]',
    "noIngredients" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostingOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CostingOption_name_key" ON "CostingOption"("name");

CREATE TABLE "CostingOptionAlias" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "CostingOptionAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CostingOptionAlias_value_key" ON "CostingOptionAlias"("value");
CREATE INDEX "CostingOptionAlias_optionId_idx" ON "CostingOptionAlias"("optionId");

CREATE TABLE "ProductOptionQuantity" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductOptionQuantity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductOptionQuantity_productId_optionId_key" ON "ProductOptionQuantity"("productId", "optionId");
CREATE INDEX "ProductOptionQuantity_productId_idx" ON "ProductOptionQuantity"("productId");
CREATE INDEX "ProductOptionQuantity_optionId_idx" ON "ProductOptionQuantity"("optionId");

ALTER TABLE "CostingOptionAlias" ADD CONSTRAINT "CostingOptionAlias_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "CostingOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOptionQuantity" ADD CONSTRAINT "ProductOptionQuantity_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "shopify_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOptionQuantity" ADD CONSTRAINT "ProductOptionQuantity_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "CostingOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
