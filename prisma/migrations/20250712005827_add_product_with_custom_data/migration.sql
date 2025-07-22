/*
  Warnings:

  - You are about to drop the column `displayName` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `handle` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `timer1` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `timer2` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the `ProductComponent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductComponent" DROP CONSTRAINT "ProductComponent_componentId_fkey";

-- DropForeignKey
ALTER TABLE "ProductComponent" DROP CONSTRAINT "ProductComponent_productCustomDataId_fkey";

-- AlterTable
ALTER TABLE "ProductCustomData" DROP COLUMN "displayName",
DROP COLUMN "handle",
DROP COLUMN "timer1",
DROP COLUMN "timer2",
ADD COLUMN     "timerA" INTEGER,
ADD COLUMN     "timerB" INTEGER,
ALTER COLUMN "serveware" DROP NOT NULL,
ALTER COLUMN "serveware" DROP DEFAULT,
ALTER COLUMN "serveware" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "ProductComponent";

-- CreateTable
CREATE TABLE "product_with_custom_data" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifySku" TEXT,
    "shopifyName" TEXT NOT NULL,
    "shopifyTitle" TEXT NOT NULL,
    "shopifyPrice" DECIMAL(65,30) NOT NULL,
    "shopifyInventory" INTEGER NOT NULL,
    "displayName" TEXT,
    "meat1" TEXT,
    "meat2" TEXT,
    "timer1" INTEGER,
    "timer2" INTEGER,
    "option1" TEXT,
    "option2" TEXT,
    "serveware" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_with_custom_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_with_custom_data_variantId_key" ON "product_with_custom_data"("variantId");
