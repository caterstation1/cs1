-- DataDrivers
CREATE TABLE "DataDriver" (
  "id" TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL UNIQUE,
  "email" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "availability" BOOLEAN NOT NULL DEFAULT FALSE,
  "vehicleMake" TEXT,
  "vehicleModel" TEXT,
  "vehiclePlate" TEXT,
  "vehiclePhotoUrl" TEXT,
  "licencePhotoUrl" TEXT,
  "bankAccountEnc" TEXT,
  "baseSuburb" TEXT,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "DataDriverApplication" (
  "id" TEXT PRIMARY KEY,
  "driverId" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "decision" TEXT NOT NULL DEFAULT 'pending',
  "adminNotes" TEXT
);
CREATE INDEX "DataDriverApplication_driverId_idx" ON "DataDriverApplication"("driverId");
ALTER TABLE "DataDriverApplication" ADD CONSTRAINT "DataDriverApplication_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DataDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Delivery Dispatch
CREATE TABLE "DeliveryJob" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "pickupAddress" TEXT NOT NULL,
  "dropoffAddress" TEXT NOT NULL,
  "deliveryWindowStart" TIMESTAMP(3),
  "deliveryWindowEnd" TIMESTAMP(3),
  "payout" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "assignedDriverId" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "deliveredNote" TEXT,
  "deliveredProofUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "DeliveryJob_orderId_idx" ON "DeliveryJob"("orderId");
CREATE INDEX "DeliveryJob_status_idx" ON "DeliveryJob"("status");
CREATE INDEX "DeliveryJob_assignedDriverId_idx" ON "DeliveryJob"("assignedDriverId");

CREATE TABLE "JobOffer" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'offered',
  "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3)
);
CREATE INDEX "JobOffer_jobId_idx" ON "JobOffer"("jobId");
CREATE INDEX "JobOffer_driverId_idx" ON "JobOffer"("driverId");
CREATE INDEX "JobOffer_status_idx" ON "JobOffer"("status");

CREATE TABLE "JobEvent" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "data" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "JobEvent_jobId_idx" ON "JobEvent"("jobId");
CREATE INDEX "JobEvent_timestamp_idx" ON "JobEvent"("timestamp");

