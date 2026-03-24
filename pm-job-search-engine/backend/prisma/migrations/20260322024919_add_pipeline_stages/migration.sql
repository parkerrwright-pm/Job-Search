-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStage" ADD VALUE 'PHONE_SCREEN';
ALTER TYPE "JobStage" ADD VALUE 'TAKE_HOME';
ALTER TYPE "JobStage" ADD VALUE 'NEGOTIATION';
ALTER TYPE "JobStage" ADD VALUE 'ACCEPTED';
ALTER TYPE "JobStage" ADD VALUE 'WITHDRAWN';
ALTER TYPE "JobStage" ADD VALUE 'ARCHIVED';
