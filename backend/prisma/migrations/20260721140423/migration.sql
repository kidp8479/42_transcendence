/*
  Warnings:

  - Changed the type of `section` on the `EvaluationChecklistItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EvaluationChecklistItemSection" AS ENUM ('MANDATORY', 'BONUS', 'SUPPLEMENTAL');

-- AlterTable
ALTER TABLE "EvaluationChecklistItem" DROP COLUMN "section",
ADD COLUMN     "section" "EvaluationChecklistItemSection" NOT NULL;
