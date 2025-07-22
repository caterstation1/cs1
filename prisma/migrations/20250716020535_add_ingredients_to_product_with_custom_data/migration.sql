-- AlterTable
ALTER TABLE "product_with_custom_data" ADD COLUMN     "ingredients" JSONB,
ADD COLUMN     "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
