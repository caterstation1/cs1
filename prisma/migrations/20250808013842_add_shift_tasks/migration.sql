-- AlterTable
ALTER TABLE "Component" ADD COLUMN     "isComponentListItem" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ShiftTask" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterAssignmentTask" (
    "id" TEXT NOT NULL,
    "rosterAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterAssignmentTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftTask_shiftId_idx" ON "ShiftTask"("shiftId");

-- CreateIndex
CREATE INDEX "RosterAssignmentTask_rosterAssignmentId_idx" ON "RosterAssignmentTask"("rosterAssignmentId");

-- AddForeignKey
ALTER TABLE "ShiftTask" ADD CONSTRAINT "ShiftTask_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterAssignmentTask" ADD CONSTRAINT "RosterAssignmentTask_rosterAssignmentId_fkey" FOREIGN KEY ("rosterAssignmentId") REFERENCES "RosterAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
