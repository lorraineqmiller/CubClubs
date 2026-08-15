-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'AWAITING_VERIFICATION');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('AGREE', 'DISAGREE');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'SUGGESTION');

-- DropIndex
DROP INDEX "Club_avgOverall_idx";

-- AlterTable
ALTER TABLE "Club" DROP COLUMN "avgOverall",
DROP COLUMN "avgSelectivity",
ADD COLUMN     "activityStatus" "ActivityStatus" NOT NULL DEFAULT 'AWAITING_VERIFICATION',
ADD COLUMN     "activityVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "avgCommitment" DOUBLE PRECISION,
ADD COLUMN     "avgOrganization" DOUBLE PRECISION,
ADD COLUMN     "howToJoinCounts" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "pctGladJoined" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "helpfulCount",
DROP COLUMN "ratingOverall",
DROP COLUMN "ratingSelectivity",
ADD COLUMN     "agreeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "disagreeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "displayId" SERIAL NOT NULL,
ADD COLUMN     "gladJoined" BOOLEAN NOT NULL,
ADD COLUMN     "howToJoin" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ratingCommitment" INTEGER NOT NULL,
ADD COLUMN     "ratingOrganization" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ReviewVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "value" "VoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteFeedback" (
    "id" TEXT NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "message" TEXT NOT NULL,
    "contactEmail" TEXT,
    "pageUrl" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "moderatorNote" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "SiteFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVote_reviewId_ipHash_key" ON "ReviewVote"("reviewId", "ipHash");

-- CreateIndex
CREATE INDEX "SiteFeedback_status_createdAt_idx" ON "SiteFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Club_avgProfessional_idx" ON "Club"("avgProfessional");

-- CreateIndex
CREATE INDEX "Club_avgSocial_idx" ON "Club"("avgSocial");

-- CreateIndex
CREATE UNIQUE INDEX "Review_displayId_key" ON "Review"("displayId");

-- AddForeignKey
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

