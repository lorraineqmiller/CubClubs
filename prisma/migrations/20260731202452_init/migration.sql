-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('CURATED', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('APPROVED', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Affiliation" AS ENUM ('COLUMBIA_CC', 'COLUMBIA_SEAS', 'COLUMBIA_GS', 'BARNARD', 'GRADUATE', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('CURRENT_MEMBER', 'FORMER_MEMBER', 'BOARD_MEMBER');

-- CreateEnum
CREATE TYPE "FlagReason" AS ENUM ('HARASSMENT', 'IDENTIFYING_INFO', 'SPAM', 'OFF_TOPIC', 'FACTUALLY_WRONG', 'OTHER');

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "sourcePath" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "avgOverall" DOUBLE PRECISION,
    "avgSelectivity" DOUBLE PRECISION,
    "avgProfessional" DOUBLE PRECISION,
    "avgSocial" DOUBLE PRECISION,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blurb" TEXT,
    "emoji" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubCategory" (
    "clubId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClubCategory_pkey" PRIMARY KEY ("clubId","categoryId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubTag" (
    "clubId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "source" "TagSource" NOT NULL DEFAULT 'CURATED',
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClubTag_pkey" PRIMARY KEY ("clubId","tagId")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ratingOverall" INTEGER NOT NULL,
    "ratingSelectivity" INTEGER NOT NULL,
    "ratingProfessional" INTEGER NOT NULL,
    "ratingSocial" INTEGER NOT NULL,
    "affiliation" "Affiliation",
    "role" "MemberRole",
    "yearInvolved" INTEGER,
    "status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "posterKey" TEXT NOT NULL,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "moderatedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTag" (
    "reviewId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ReviewTag_pkey" PRIMARY KEY ("reviewId","tagId")
);

-- CreateTable
CREATE TABLE "PendingReview" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ratingOverall" INTEGER NOT NULL,
    "ratingSelectivity" INTEGER NOT NULL,
    "ratingProfessional" INTEGER NOT NULL,
    "ratingSocial" INTEGER NOT NULL,
    "affiliation" "Affiliation",
    "role" "MemberRole",
    "yearInvolved" INTEGER,
    "tagSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailHash" TEXT NOT NULL,
    "emailDomain" TEXT NOT NULL,
    "posterKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,

    CONSTRAINT "PendingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewFlag" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reason" "FlagReason" NOT NULL,
    "note" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_sourceId_key" ON "Club"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE INDEX "Club_reviewCount_idx" ON "Club"("reviewCount");

-- CreateIndex
CREATE INDEX "Club_avgOverall_idx" ON "Club"("avgOverall");

-- CreateIndex
CREATE INDEX "Club_sortName_idx" ON "Club"("sortName");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "ClubCategory_categoryId_idx" ON "ClubCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ClubTag_tagId_idx" ON "ClubTag"("tagId");

-- CreateIndex
CREATE INDEX "Review_clubId_status_createdAt_idx" ON "Review"("clubId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_clubId_posterKey_key" ON "Review"("clubId", "posterKey");

-- CreateIndex
CREATE INDEX "ReviewTag_tagId_idx" ON "ReviewTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingReview_tokenHash_key" ON "PendingReview"("tokenHash");

-- CreateIndex
CREATE INDEX "PendingReview_emailHash_idx" ON "PendingReview"("emailHash");

-- CreateIndex
CREATE INDEX "PendingReview_expiresAt_idx" ON "PendingReview"("expiresAt");

-- CreateIndex
CREATE INDEX "ReviewFlag_reviewId_idx" ON "ReviewFlag"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewFlag_resolvedAt_idx" ON "ReviewFlag"("resolvedAt");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_ipHash_kind_createdAt_idx" ON "SubmissionAttempt"("ipHash", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_createdAt_idx" ON "SubmissionAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "ClubCategory" ADD CONSTRAINT "ClubCategory_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubCategory" ADD CONSTRAINT "ClubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTag" ADD CONSTRAINT "ClubTag_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTag" ADD CONSTRAINT "ClubTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTag" ADD CONSTRAINT "ReviewTag_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTag" ADD CONSTRAINT "ReviewTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingReview" ADD CONSTRAINT "PendingReview_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFlag" ADD CONSTRAINT "ReviewFlag_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
