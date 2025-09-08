-- CreateEnum
CREATE TYPE "DeliveryDateResolvedSource" AS ENUM ('FIELD', 'NOTE', 'TAG', 'CREATED_AT');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryDateResolved" DATE,
ADD COLUMN     "deliveryDateResolvedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryDateResolvedSource" "DeliveryDateResolvedSource";

-- CreateIndex
CREATE INDEX "Order_deliveryDateResolved_idx" ON "Order"("deliveryDateResolved");
