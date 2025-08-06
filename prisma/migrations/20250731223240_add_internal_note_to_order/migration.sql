/*
  Warnings:

  - Added the required column `endTime` to the `ShiftType` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "internalNote" TEXT;

-- AlterTable
ALTER TABLE "ShiftType" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#3B82F6',
ADD COLUMN     "endTime" TEXT NOT NULL;
