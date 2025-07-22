-- CreateTable
CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "parsedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedOrder" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "deliveryAddress" JSONB NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerCompany" TEXT,
    "customerPhone" TEXT NOT NULL,
    "orderNotes" TEXT,
    "travelTime" INTEGER,
    "leaveTime" TEXT,
    "driverId" TEXT,
    "isDispatched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParsedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedLineItem" (
    "id" TEXT NOT NULL,
    "parsedOrderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" TEXT NOT NULL,
    "handle" TEXT,
    "meat1" TEXT,
    "meat2" TEXT,
    "serveware" TEXT,
    "ovenTimer1" INTEGER,
    "ovenTimer2" INTEGER,
    "option1" TEXT,
    "option2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParsedLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrder_parsedOrderId_key" ON "ShopifyOrder"("parsedOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ParsedOrder_shopifyOrderId_key" ON "ParsedOrder"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "ParsedLineItem_parsedOrderId_idx" ON "ParsedLineItem"("parsedOrderId");

-- CreateIndex
CREATE INDEX "ParsedLineItem_sku_idx" ON "ParsedLineItem"("sku");

-- AddForeignKey
ALTER TABLE "ParsedOrder" ADD CONSTRAINT "ParsedOrder_shopifyOrderId_fkey" FOREIGN KEY ("shopifyOrderId") REFERENCES "ShopifyOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedLineItem" ADD CONSTRAINT "ParsedLineItem_parsedOrderId_fkey" FOREIGN KEY ("parsedOrderId") REFERENCES "ParsedOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
