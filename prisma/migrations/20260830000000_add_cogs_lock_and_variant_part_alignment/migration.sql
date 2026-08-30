-- Signed-off cost of sales for a delivery day. Live pricing means a past day's
-- COGS would otherwise move whenever a supplier price changes.
CREATE TABLE "DailyCogsLock" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "revenueExGst" DOUBLE PRECISION NOT NULL,
    "costOfSales" DOUBLE PRECISION NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "cogsCoveragePct" INTEGER NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedByUserId" TEXT,
    "lockedByName" TEXT,

    CONSTRAINT "DailyCogsLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyCogsLock_date_key" ON "DailyCogsLock"("date");
CREATE INDEX "DailyCogsLock_date_idx" ON "DailyCogsLock"("date");

-- The item(s) a variant title part is meant to carry, so Verify & Fix All can
-- add a missing aligned item to every variant containing that part.
CREATE TABLE "VariantPartAlignment" (
    "id" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantPartAlignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VariantPartAlignment_partName_key" ON "VariantPartAlignment"("partName");
