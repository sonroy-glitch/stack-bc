/*
  Warnings:

  - The `upvote` column on the `Question` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `downvote` column on the `Question` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Question" DROP COLUMN "upvote",
ADD COLUMN     "upvote" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
DROP COLUMN "downvote",
ADD COLUMN     "downvote" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;
