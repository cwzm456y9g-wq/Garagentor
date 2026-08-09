-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('GESENDET', 'FEHLGESCHLAGEN');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "debtorAccount" INTEGER;

-- CreateTable
CREATE TABLE "mail_logs" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType",
    "entityId" TEXT,
    "reference" TEXT,
    "recipient" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" TEXT[],
    "status" "MailStatus" NOT NULL,
    "error" TEXT,
    "messageId" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_logs_entityType_entityId_idx" ON "mail_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "mail_logs_createdAt_idx" ON "mail_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "mail_logs" ADD CONSTRAINT "mail_logs_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
