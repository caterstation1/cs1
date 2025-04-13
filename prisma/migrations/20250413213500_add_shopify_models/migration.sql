-- CreateTable
CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "deliveryDate" DATETIME NOT NULL,
    "deliveryTime" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryNotes" TEXT,
    "status" TEXT NOT NULL,
    "totalPrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isModified" BOOLEAN NOT NULL DEFAULT false,
    "modifications" JSONB,
    CONSTRAINT "ShopifyOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopifyCustomer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopifyLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantId" TEXT,
    "variantTitle" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "modifications" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopifyLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopifyOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopifyCustomer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "defaultAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrder_shopifyId_key" ON "ShopifyOrder"("shopifyId");

-- CreateIndex
CREATE INDEX "ShopifyOrder_deliveryDate_idx" ON "ShopifyOrder"("deliveryDate");

-- CreateIndex
CREATE INDEX "ShopifyOrder_shopifyId_idx" ON "ShopifyOrder"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyLineItem_shopifyId_key" ON "ShopifyLineItem"("shopifyId");

-- CreateIndex
CREATE INDEX "ShopifyLineItem_orderId_idx" ON "ShopifyLineItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyCustomer_shopifyId_key" ON "ShopifyCustomer"("shopifyId");

-- CreateIndex
CREATE INDEX "ShopifyCustomer_shopifyId_idx" ON "ShopifyCustomer"("shopifyId");
