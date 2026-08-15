-- CreateEnum
CREATE TYPE "School" AS ENUM ('COLUMBIA', 'BARNARD');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "school" "School" NOT NULL DEFAULT 'COLUMBIA';

