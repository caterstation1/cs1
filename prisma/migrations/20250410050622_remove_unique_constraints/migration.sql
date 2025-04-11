/*
  Warnings:

  - You are about to drop the column `listOfIngredients` on the `Product` table. All the data in the column will be lost.
  - You are about to alter the column `timerA` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `timerB` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Made the column `description` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "addon" TEXT,
    "handle" TEXT,
    "meat1" TEXT,
    "meat2" TEXT,
    "option1" TEXT,
    "option2" TEXT,
    "serveware" TEXT,
    "timerA" INTEGER,
    "timerB" INTEGER,
    "skuSearch" TEXT,
    "variantSku" TEXT,
    "ingredients" JSONB NOT NULL,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL,
    "realizedMargin" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("addon", "createdAt", "description", "handle", "id", "ingredients", "meat1", "meat2", "name", "option1", "option2", "realizedMargin", "sellingPrice", "serveware", "skuSearch", "timerA", "timerB", "totalCost", "updatedAt", "variantSku") SELECT "addon", "createdAt", "description", "handle", "id", "ingredients", "meat1", "meat2", "name", "option1", "option2", "realizedMargin", "sellingPrice", "serveware", "skuSearch", "timerA", "timerB", "totalCost", "updatedAt", "variantSku" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_variantSku_key" ON "Product"("variantSku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
