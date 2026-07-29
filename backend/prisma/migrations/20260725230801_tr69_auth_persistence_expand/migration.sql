-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'DISABLED');

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "OAuthTransactionPurpose" AS ENUM ('LOGIN', 'LINK');

-- AlterTable
ALTER TABLE "AuthEvent" ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "newGlobalRole" "GlobalRole",
ADD COLUMN     "previousGlobalRole" "GlobalRole",
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "targetUserId" TEXT;

-- AlterTable
ALTER TABLE "OAuthTransaction" ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "initiatingUserId" TEXT,
ADD COLUMN     "purpose" "OAuthTransactionPurpose" NOT NULL DEFAULT 'LOGIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "RefreshTokenFamily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authenticationMethod" "AuthProvider" NOT NULL,
    "assuranceLevel" INTEGER NOT NULL DEFAULT 1,
    "csrfTokenHash" TEXT NOT NULL,
    "authenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshTokenFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRefreshToken" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "graceExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "replacedById" TEXT,

    CONSTRAINT "AuthRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebSocketTicket" (
    "id" TEXT NOT NULL,
    "ticketHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshFamilyId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "WebSocketTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_absoluteExpiresAt_idx" ON "RefreshTokenFamily"("absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_idleExpiresAt_idx" ON "RefreshTokenFamily"("idleExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshTokenFamily_id_userId_key" ON "RefreshTokenFamily"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRefreshToken_tokenHash_key" ON "AuthRefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRefreshToken_replacedById_key" ON "AuthRefreshToken"("replacedById");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_familyId_issuedAt_idx" ON "AuthRefreshToken"("familyId", "issuedAt");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_expiresAt_idx" ON "AuthRefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebSocketTicket_ticketHash_key" ON "WebSocketTicket"("ticketHash");

-- CreateIndex
CREATE INDEX "WebSocketTicket_expiresAt_idx" ON "WebSocketTicket"("expiresAt");

-- CreateIndex
CREATE INDEX "WebSocketTicket_refreshFamilyId_idx" ON "WebSocketTicket"("refreshFamilyId");

-- CreateIndex
CREATE INDEX "AuthEvent_actorUserId_createdAt_idx" ON "AuthEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_targetUserId_createdAt_idx" ON "AuthEvent"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OAuthTransaction_initiatingUserId_idx" ON "OAuthTransaction"("initiatingUserId");

-- AddForeignKey
ALTER TABLE "RefreshTokenFamily" ADD CONSTRAINT "RefreshTokenFamily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RefreshTokenFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "AuthRefreshToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthTransaction" ADD CONSTRAINT "OAuthTransaction_initiatingUserId_fkey" FOREIGN KEY ("initiatingUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebSocketTicket" ADD CONSTRAINT "WebSocketTicket_refreshFamilyId_userId_fkey" FOREIGN KEY ("refreshFamilyId", "userId") REFERENCES "RefreshTokenFamily"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
