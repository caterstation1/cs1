-- AlterTable
ALTER TABLE "Component" ADD COLUMN     "cookedWeight" DOUBLE PRECISION,
ADD COLUMN     "costPerOutputUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "normalizedOutputUnit" TEXT NOT NULL DEFAULT 'unit',
ADD COLUMN     "producedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "producedUnit" TEXT NOT NULL DEFAULT 'unit',
ADD COLUMN     "rawWeight" DOUBLE PRECISION,
ADD COLUMN     "trimWasteWeight" DOUBLE PRECISION,
ADD COLUMN     "weightUnit" TEXT;
