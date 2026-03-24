-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "selectedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
