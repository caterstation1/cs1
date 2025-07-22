-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "lastSmsSent" TIMESTAMP(3),
ADD COLUMN     "smsHistory" JSONB;
