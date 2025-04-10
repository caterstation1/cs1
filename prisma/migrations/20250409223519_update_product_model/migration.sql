/*
  Warnings:

  - You are about to drop the column `addon` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `handle` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `listOfIngredients` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `meat1` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `meat2` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `option1` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `option2` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `serveware` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `skuSearch` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `timerA` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `timerB` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `variantSku` on the `Product` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ingredients" JSONB NOT NULL,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL,
    "realizedMargin" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("createdAt", "description", "id", "ingredients", "name", "realizedMargin", "sellingPrice", "totalCost", "updatedAt") SELECT "createdAt", "description", "id", "ingredients", "name", "realizedMargin", "sellingPrice", "totalCost", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
