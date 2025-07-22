-- CreateTable
CREATE TABLE "product_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "matchPattern" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'contains',
    "setMeat1" TEXT,
    "setMeat2" TEXT,
    "setTimer1" INTEGER,
    "setTimer2" INTEGER,
    "setOption1" TEXT,
    "setOption2" TEXT,
    "setServeware" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_rules_pkey" PRIMARY KEY ("id")
);
