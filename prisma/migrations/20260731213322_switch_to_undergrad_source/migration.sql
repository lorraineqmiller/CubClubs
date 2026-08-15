-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('SOURCE', 'INTEREST');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "kind" "CategoryKind" NOT NULL DEFAULT 'SOURCE';

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Category_kind_sortOrder_idx" ON "Category"("kind", "sortOrder");
