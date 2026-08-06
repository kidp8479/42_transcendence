-- DropIndex
DROP INDEX "ChatMessage_projectId_idx";

-- CreateIndex
CREATE INDEX "ChatMessage_projectId_createdAt_id_idx" ON "ChatMessage"("projectId", "createdAt", "id");
