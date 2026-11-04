-- CreateTable
CREATE TABLE "RosterAdminNote" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedByEmail" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterAdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RosterAdminNote_region_date_key" ON "RosterAdminNote"("region", "date");
