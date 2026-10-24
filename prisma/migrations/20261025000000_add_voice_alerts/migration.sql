-- CreateTable
CREATE TABLE "VoiceAlert" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdByEmail" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "VoiceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceAlert_recipient_acknowledgedAt_createdAt_idx" ON "VoiceAlert"("recipient", "acknowledgedAt", "createdAt");
