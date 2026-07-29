-- CreateEnum
CREATE TYPE "EvaluationChecklistItemSection" AS ENUM ('MANDATORY', 'BONUS', 'SUPPLEMENTAL');

-- AlterTable
-- Prisma's default output here is `DROP COLUMN` + `ADD COLUMN`, which fails
-- (or silently loses data) on any table that already has rows, since the old
-- `section` was a plain TEXT column. The existing values already match the
-- enum's own labels one-for-one, so a direct cast via USING converts them
-- in place instead of discarding them.
ALTER TABLE "EvaluationChecklistItem"
  ALTER COLUMN "section" TYPE "EvaluationChecklistItemSection"
  USING ("section"::"EvaluationChecklistItemSection");
