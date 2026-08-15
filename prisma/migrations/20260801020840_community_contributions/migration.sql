-- CreateEnum
CREATE TYPE "ClubOrigin" AS ENUM ('DIRECTORY', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "editedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "origin" "ClubOrigin" NOT NULL DEFAULT 'DIRECTORY',
ALTER COLUMN "sourcePath" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ClubEditSuggestion" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "submitterEmail" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "moderatorNote" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "ClubEditSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "submitterEmail" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "moderatorNote" TEXT,
    "ipHash" TEXT,
    "createdClubId" TEXT,

    CONSTRAINT "ClubSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubEditSuggestion_status_createdAt_idx" ON "ClubEditSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClubEditSuggestion_clubId_status_idx" ON "ClubEditSuggestion"("clubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClubSubmission_createdClubId_key" ON "ClubSubmission"("createdClubId");

-- CreateIndex
CREATE INDEX "ClubSubmission_status_createdAt_idx" ON "ClubSubmission"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ClubEditSuggestion" ADD CONSTRAINT "ClubEditSuggestion_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
