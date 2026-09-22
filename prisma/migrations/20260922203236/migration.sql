/*
  Warnings:

  - You are about to drop the column `experienceYear` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `reviewBy` on the `doctors` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "experienceYear",
DROP COLUMN "reviewBy",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "experienceYears" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedBy" TEXT;
