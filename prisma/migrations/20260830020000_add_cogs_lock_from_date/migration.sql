-- First delivery day that should have its cost of sales frozen automatically.
ALTER TABLE "PricingSettings" ADD COLUMN "cogsLockFromDate" DATE;
