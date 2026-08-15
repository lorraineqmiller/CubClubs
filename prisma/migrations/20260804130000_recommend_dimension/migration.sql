-- AlterTable
ALTER TABLE "Club" DROP COLUMN "pctGladJoined",
ADD COLUMN     "avgRecommend" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "gladJoined",
ADD COLUMN     "howToJoinOther" TEXT,
ADD COLUMN     "ratingRecommend" INTEGER NOT NULL;

