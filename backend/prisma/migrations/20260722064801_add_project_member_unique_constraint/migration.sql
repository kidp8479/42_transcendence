-- AlterTable
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_projectId_key" UNIQUE ("userId", "projectId");
