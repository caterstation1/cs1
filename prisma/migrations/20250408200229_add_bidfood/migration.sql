-- CreateTable
CREATE TABLE "BidfoodProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "ctnQty" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "lastPricePaid" REAL NOT NULL,
    "totalExGST" REAL NOT NULL,
    "contains" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BidfoodProduct_productCode_key" ON "BidfoodProduct"("productCode");
