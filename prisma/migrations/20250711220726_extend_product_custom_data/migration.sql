-- AlterTable
ALTER TABLE "ProductCustomData" ADD COLUMN     "allergens" JSONB,
ADD COLUMN     "components" JSONB,
ADD COLUMN     "cookTime" INTEGER,
ADD COLUMN     "dietaryInfo" JSONB,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "prepTime" INTEGER,
ADD COLUMN     "servingSize" TEXT,
ADD COLUMN     "shorthand" TEXT;
