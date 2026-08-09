-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "entityRef" TEXT;

-- CreateIndex
CREATE INDEX "documents_entityType_entityId_entityRef_idx" ON "documents"("entityType", "entityId", "entityRef");
