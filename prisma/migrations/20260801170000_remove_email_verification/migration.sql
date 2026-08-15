-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'PENDING';

-- DropForeignKey
ALTER TABLE "PendingReview" DROP CONSTRAINT "PendingReview_clubId_fkey";

-- DropIndex
DROP INDEX "Review_clubId_posterKey_key";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "posterKey",
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- DropTable
DROP TABLE "PendingReview";
