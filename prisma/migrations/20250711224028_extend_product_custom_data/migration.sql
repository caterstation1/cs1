/*
  Warnings:

  - You are about to drop the column `allergens` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `components` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `cookTime` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `dietaryInfo` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `prepTime` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `servingSize` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `shorthand` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `timerA` on the `ProductCustomData` table. All the data in the column will be lost.
  - You are about to drop the column `timerB` on the `ProductCustomData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductCustomData" DROP COLUMN "allergens",
DROP COLUMN "components",
DROP COLUMN "cookTime",
DROP COLUMN "dietaryInfo",
DROP COLUMN "notes",
DROP COLUMN "prepTime",
DROP COLUMN "servingSize",
DROP COLUMN "shorthand",
DROP COLUMN "timerA",
DROP COLUMN "timerB",
ADD COLUMN     "handle" TEXT,
ADD COLUMN     "timer1" INTEGER,
ADD COLUMN     "timer2" INTEGER;
