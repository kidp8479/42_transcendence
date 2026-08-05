-- Project-bound opaque API-token records are auth-service-owned. NestJS can
-- only manage them through the authenticated internal lifecycle contract.
CREATE TYPE "ProjectApiTokenPermission" AS ENUM ('READ', 'READ_WRITE');

CREATE TABLE "ProjectApiToken" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "secretHmac" TEXT NOT NULL,
    "pepperVersion" INTEGER NOT NULL,
    "permission" "ProjectApiTokenPermission" NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "ProjectApiToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectApiToken_selector_key" UNIQUE ("selector"),
    CONSTRAINT "ProjectApiToken_secret_hmac_chk" CHECK (char_length("secretHmac") = 64),
    CONSTRAINT "ProjectApiToken_pepper_version_chk" CHECK ("pepperVersion" > 0),
    CONSTRAINT "ProjectApiToken_expiry_chk" CHECK ("expiresAt" > "createdAt")
);

CREATE TABLE "ProjectApiTokenEvent" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "projectId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectApiTokenEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectApiToken_projectId_revokedAt_expiresAt_idx"
    ON "ProjectApiToken"("projectId", "revokedAt", "expiresAt");
CREATE INDEX "ProjectApiToken_expiresAt_idx" ON "ProjectApiToken"("expiresAt");
CREATE INDEX "ProjectApiTokenEvent_projectId_createdAt_idx"
    ON "ProjectApiTokenEvent"("projectId", "createdAt");
CREATE INDEX "ProjectApiTokenEvent_tokenId_createdAt_idx"
    ON "ProjectApiTokenEvent"("tokenId", "createdAt");

ALTER TABLE "ProjectApiToken"
    ADD CONSTRAINT "ProjectApiToken_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
