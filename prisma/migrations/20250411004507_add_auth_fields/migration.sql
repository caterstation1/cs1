/*
  Warnings:

  - A unique constraint covering the columns `[resetToken]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "lastLogin" DATETIME;
ALTER TABLE "Staff" ADD COLUMN "password" TEXT;
ALTER TABLE "Staff" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "Staff" ADD COLUMN "resetTokenExpiry" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_resetToken_key" ON "Staff"("resetToken");
