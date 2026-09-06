-- Produce Co order confirmations carry a pack size and the unit the price is
-- per. Without somewhere to store them, produceCoEntry has to assume "per each",
-- which prices a 12kg case of chicken as though it were one item.
ALTER TABLE "ProduceCoProduct" ADD COLUMN "packSize" TEXT;
ALTER TABLE "ProduceCoProduct" ADD COLUMN "uom" TEXT;
