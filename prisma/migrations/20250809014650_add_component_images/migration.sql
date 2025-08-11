-- CreateTable
CREATE TABLE "ComponentImage" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComponentImage_componentId_idx" ON "ComponentImage"("componentId");

-- AddForeignKey
ALTER TABLE "ComponentImage" ADD CONSTRAINT "ComponentImage_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
