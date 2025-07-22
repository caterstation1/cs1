-- AlterTable
ALTER TABLE "product_rules" ADD COLUMN     "setDisplayName" TEXT,
ADD COLUMN     "setIngredients" JSONB,
ADD COLUMN     "setTotalCost" DOUBLE PRECISION;
