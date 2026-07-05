-- AlterTable
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "includeInOpsLabour" BOOLEAN NOT NULL DEFAULT true;

-- Sofia is admin/overhead staff, not operational labour
UPDATE "Staff" SET "includeInOpsLabour" = false WHERE lower("firstName") = 'sofia';
