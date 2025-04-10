/*
  Warnings:

  - A unique constraint covering the columns `[handle]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN "addon" TEXT;
ALTER TABLE "Product" ADD COLUMN "handle" TEXT;
ALTER TABLE "Product" ADD COLUMN "listOfIngredients" TEXT;
ALTER TABLE "Product" ADD COLUMN "meat1" TEXT;
ALTER TABLE "Product" ADD COLUMN "meat2" TEXT;
ALTER TABLE "Product" ADD COLUMN "option1" TEXT;
ALTER TABLE "Product" ADD COLUMN "option2" TEXT;
ALTER TABLE "Product" ADD COLUMN "serveware" TEXT;
ALTER TABLE "Product" ADD COLUMN "skuSearch" TEXT;
ALTER TABLE "Product" ADD COLUMN "timerA" TEXT;
ALTER TABLE "Product" ADD COLUMN "timerB" TEXT;
ALTER TABLE "Product" ADD COLUMN "variantSku" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_handle_key" ON "Product"("handle");
