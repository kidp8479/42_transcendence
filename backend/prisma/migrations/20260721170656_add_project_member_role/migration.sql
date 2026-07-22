-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER';
