-- DropForeignKey
ALTER TABLE "RosterAssignment" DROP CONSTRAINT "RosterAssignment_shiftTypeId_fkey";

-- AlterTable
ALTER TABLE "RosterAssignment" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT,
ALTER COLUMN "shiftTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "RosterAssignment" ADD CONSTRAINT "RosterAssignment_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "ShiftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
