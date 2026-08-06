-- Immutable, redacted evidence for public API token task writes. No foreign
-- keys: evidence must survive resource, project, or credential deletion.
CREATE TABLE "MachineTaskActionAudit" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineTaskActionAudit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MachineTaskActionAudit_action_chk"
        CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE'))
);

CREATE INDEX "MachineTaskActionAudit_projectId_createdAt_idx"
    ON "MachineTaskActionAudit"("projectId", "createdAt");
CREATE INDEX "MachineTaskActionAudit_tokenId_createdAt_idx"
    ON "MachineTaskActionAudit"("tokenId", "createdAt");
CREATE INDEX "MachineTaskActionAudit_taskId_createdAt_idx"
    ON "MachineTaskActionAudit"("taskId", "createdAt");
