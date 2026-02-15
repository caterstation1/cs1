-- Create enum for SMS template type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SmsTemplateType') THEN
    CREATE TYPE "SmsTemplateType" AS ENUM ('delivery', 'pickup');
  END IF;
END$$;

-- Create SmsTemplate table
CREATE TABLE IF NOT EXISTS "SmsTemplate" (
  "id" TEXT NOT NULL,
  "type" "SmsTemplateType" NOT NULL,
  "content" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on type (one row per template type)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = ANY (current_schemas(false))
      AND indexname = 'SmsTemplate_type_key'
  ) THEN
    CREATE UNIQUE INDEX "SmsTemplate_type_key" ON "SmsTemplate"("type");
  END IF;
END$$;



