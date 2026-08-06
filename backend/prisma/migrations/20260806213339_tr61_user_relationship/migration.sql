-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('PENDING_APPROVAL', 'ACCEPTED', 'BLOCKED');

-- CreateTable
CREATE TABLE "UserRelationship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRelationship_addresseeId_idx" ON "UserRelationship"("addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRelationship_requesterId_addresseeId_key" ON "UserRelationship"("requesterId", "addresseeId");

-- AddForeignKey
ALTER TABLE "UserRelationship" ADD CONSTRAINT "UserRelationship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelationship" ADD CONSTRAINT "UserRelationship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
