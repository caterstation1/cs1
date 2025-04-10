-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL,
    "totalCost" REAL NOT NULL,
    "hasGluten" BOOLEAN NOT NULL DEFAULT false,
    "hasDairy" BOOLEAN NOT NULL DEFAULT false,
    "hasSoy" BOOLEAN NOT NULL DEFAULT false,
    "hasOnionGarlic" BOOLEAN NOT NULL DEFAULT false,
    "hasSesame" BOOLEAN NOT NULL DEFAULT false,
    "hasNuts" BOOLEAN NOT NULL DEFAULT false,
    "hasEgg" BOOLEAN NOT NULL DEFAULT false,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isHalal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Component_name_key" ON "Component"("name");
