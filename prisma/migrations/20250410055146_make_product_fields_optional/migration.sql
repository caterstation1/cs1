-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
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
    "ingredients" JSONB,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL,
    "realizedMargin" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("addon", "createdAt", "description", "handle", "id", "ingredients", "meat1", "meat2", "name", "option1", "option2", "realizedMargin", "sellingPrice", "serveware", "skuSearch", "timerA", "timerB", "totalCost", "updatedAt", "variantSku") SELECT "addon", "createdAt", "description", "handle", "id", "ingredients", "meat1", "meat2", "name", "option1", "option2", "realizedMargin", "sellingPrice", "serveware", "skuSearch", "timerA", "timerB", "totalCost", "updatedAt", "variantSku" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
