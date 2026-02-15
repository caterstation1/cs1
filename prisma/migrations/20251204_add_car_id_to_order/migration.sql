-- Add optional carId column to Order for vehicle assignment
-- Safe to run multiple times: check existence before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'carId'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "carId" TEXT;
  END IF;
END $$;


