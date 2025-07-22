-- CreateTable
CREATE TABLE "ProductCustomData" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "meat1" TEXT,
    "meat2" TEXT,
    "option1" TEXT,
    "option2" TEXT,
    "serveware" TEXT,
    "timerA" INTEGER,
    "timerB" INTEGER,
    "ingredients" JSONB,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCustomData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCustomData_variantId_key" ON "ProductCustomData"("variantId");

-- CreateIndex
CREATE INDEX "ProductCustomData_variantId_idx" ON "ProductCustomData"("variantId");
