-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryDateTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deliveryDateSource" TEXT,
ADD COLUMN IF NOT EXISTS "needsSchedulingReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "region" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_region_deliveryDateTime_idx" ON "Order"("region", "deliveryDateTime");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_needsSchedulingReview_idx" ON "Order"("needsSchedulingReview");
