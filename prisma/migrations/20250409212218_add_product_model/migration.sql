-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "addon" TEXT,
    "handle" TEXT,
    "listOfIngredients" TEXT,
    "meat1" TEXT,
    "meat2" TEXT,
    "option1" TEXT,
    "option2" TEXT,
    "serveware" TEXT,
    "timerA" TEXT,
    "timerB" TEXT,
    "skuSearch" TEXT,
    "variantSku" TEXT,
    "ingredients" JSONB NOT NULL,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL,
    "realizedMargin" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_handle_key" ON "Product"("handle");
